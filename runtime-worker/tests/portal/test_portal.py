import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from battery_portal.storage import SQLiteStore
from battery_portal.service import Portal,PortalError,COOKIE
from battery_portal.security import password_hash,widget_config,origins
from battery_portal.transport import public_calculation
ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'data/calculator/leaflets-v1.json').read_text())

class PortalTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        asyncio.get_running_loop().set_debug(False)
        self.temp=tempfile.TemporaryDirectory();self.db=SQLiteStore(Path(self.temp.name)/'db.sqlite')
        self.portal=Portal(self.db,DATA,'https://test.example')
        self.origin={'origin':'https://test.example'}
        self.link=await self.portal.bootstrap('admin@example.com')
        await self.call('activate',{'token':self.link.split('=')[1],'password':'fixture password for tests'})
        _,login,headers=await self.call('login',{'email':'admin@example.com','password':'fixture password for tests'})
        self.admin={**self.origin,'cookie':headers['Set-Cookie'].split(';')[0],'x-csrf-token':login['csrf']}
        self.admin_id=login['user']['id']
    async def asyncTearDown(self):self.temp.cleanup()
    async def call(self,path,data=None,headers=None):
        return await self.portal.handle('/admin/api/'+path,'GET' if data is None else 'POST',headers or self.origin,data or {},'test-ip')
    async def partner(self,grants):
        await self.call('apply',{'email':'partner@example.com','company':'Test Partner','website':'https://partner.example','message':'API'})
        _,data,_=await self.call('applications',headers=self.admin)
        _,approved,_=await self.call('application-review',{'id':data['applications'][0]['id'],'decision':'approve','permissions':grants},self.admin)
        await self.call('activate',{'token':approved['activation_url'].split('=')[1],'password':'partner fixture password'})
        _,login,h=await self.call('login',{'email':'partner@example.com','password':'partner fixture password'})
        return login['user']['id'],{**self.origin,'cookie':h['Set-Cookie'].split(';')[0],'x-csrf-token':login['csrf']}
    async def test_activation_single_use_and_no_default_password(self):
        with self.assertRaises(PortalError):await self.call('activate',{'token':self.link.split('=')[1],'password':'another fixture password'})
        row=(await self.db.query('SELECT * FROM portal_users'))[0]
        self.assertNotIn('fixture',row['password_hash']);self.assertTrue(row['password_hash'].startswith('scrypt$32768$8$3$'))
    async def test_csrf_and_partner_cannot_escalate(self):
        uid,partner=await self.partner([])
        for headers in ({**self.admin,'x-csrf-token':'bad'},{**self.admin,'origin':'https://evil.example'},partner):
            with self.assertRaises(PortalError):await self.call('user-update',{'id':uid,'role':'admin','active':True,'permissions':[]},headers)
        with self.assertRaises(PortalError):await self.call('prices',headers=partner)
        with self.assertRaises(PortalError):await self.call('key-create',{'user_id':self.admin_id},partner)
    async def test_last_admin_protected(self):
        with self.assertRaises(PortalError):await self.call('user-update',{'id':self.admin_id,'role':'partner','active':False,'permissions':[]},self.admin)
    async def test_api_scopes_revocation_and_no_prices_leak(self):
        uid,partner=await self.partner(['api:export'])
        with self.assertRaises(PortalError):await self.call('key-create',{'scopes':['catalog:read','prices:read']},partner)
        _,key,_=await self.call('key-create',{'scopes':['catalog:read']},partner)
        headers={'authorization':'Bearer '+key['token']}
        _,catalog,_=await self.portal.handle('/partner-api/v1/catalog','GET',headers,{})
        self.assertEqual(len(catalog['models']),26);self.assertNotIn('prices',catalog)
        self.assertNotIn('source_ref',catalog['models'][0]['curves'][0])
        await self.call('key-revoke',{'id':key['id']},partner)
        with self.assertRaises(PortalError):await self.portal.api_user(headers)
    async def test_permission_revocation_immediate_for_key_and_widget(self):
        uid,partner=await self.partner(['api:export','widget:embed'])
        _,key,_=await self.call('key-create',{},partner)
        _,widget,_=await self.call('widget-save',{'origins':['https://partner.example'],'config':{}},partner)
        self.assertEqual((await self.portal.widget(widget['id']))['origins'],['https://partner.example'])
        await self.call('user-update',{'id':uid,'role':'partner','active':True,'permissions':[]},self.admin)
        with self.assertRaises(PortalError):await self.portal.api_user({'authorization':'Bearer '+key['token']})
        with self.assertRaises(PortalError):await self.portal.widget(widget['id'])
        with self.assertRaises(PortalError):await self.call('me',headers=partner)
    async def test_password_reset_revokes_sessions(self):
        _,link,_=await self.call('password-link',{'id':self.admin_id},self.admin)
        await self.call('activate',{'token':link['activation_url'].split('=')[1],'password':'new fixture password only'})
        with self.assertRaises(PortalError):await self.call('me',headers=self.admin)
    async def test_catalog_validation_rejects_synthetic_and_stale_revision(self):
        data=dict(DATA,revision='new-test')
        with self.assertRaises(PortalError):await self.call('catalog-publish',{'dataset':data,'base_revision':'wrong'},self.admin)
        await self.call('catalog-publish',{'dataset':data,'base_revision':DATA['revision']},self.admin)
        self.assertEqual((await self.portal.dataset())['revision'],'new-test')
        with self.assertRaises(PortalError):await self.call('catalog-validate',{'dataset':dict(data,origin='synthetic')},self.admin)
    async def test_rate_limiting(self):
        for _ in range(10):await self.portal.limit('test',10)
        with self.assertRaises(PortalError) as raised:await self.portal.limit('test',10)
        self.assertEqual(raised.exception.status,429)
    def test_widget_config_rejects_css_and_wildcard_origins(self):
        for cfg in ({'accent':'red;display:none'},{'modes':['admin']},{'radius':True}):
            with self.assertRaises(ValueError):widget_config(cfg)
        for values in (['https://*.example.com'],['http://example.com'],['https://example.com/path'],['https://user:pass@example.com']):
            with self.assertRaises(ValueError):origins(values)
    def test_public_calculation_does_not_export_database(self):
        result=public_calculation({'input_snapshot':{'dataset':DATA,'request':{'operation':'select'}},'dataset_id':'id','dataset_revision':'rev','dataset_sha256':'sha'})
        self.assertNotIn('models',result['input_snapshot']['dataset'])
