import copy,json,time,unittest
import test_portal
from battery_portal.pricing import prepare_pricebook
from battery_portal.service import PortalError
from battery_portal.transport import dispatch

BOOK={'revision':'test-1','pricing_method':'margin','rate':'0.15','entries':[{'model_id':'HR 12-18M','cost_minor':10000,'currency':'USD','price_date':'2025-12-24','basis':'FOB; shipping excluded','source':'private-source.xls','source_model':'factory-secret','source_ref':'D19'}]}

class PricingTests(unittest.IsolatedAsyncioTestCase):
    asyncSetUp=test_portal.PortalTests.asyncSetUp
    asyncTearDown=test_portal.PortalTests.asyncTearDown
    call=test_portal.PortalTests.call
    partner=test_portal.PortalTests.partner
    async def publish(self,book=None,revision=''):
        return await self.call('prices-publish',{'pricebook':book or BOOK,'base_revision':revision},self.admin)
    def test_decimal_rounding_and_invalid_input(self):
        self.assertEqual(prepare_pricebook(BOOK,{'HR 12-18M'})['entries'][0]['amount_minor'],11765)
        markup=dict(BOOK,pricing_method='markup')
        self.assertEqual(prepare_pricebook(markup,{'HR 12-18M'})['entries'][0]['amount_minor'],11500)
        half=copy.deepcopy(markup);half['entries'][0]['cost_minor']=10
        self.assertEqual(prepare_pricebook(half,{'HR 12-18M'})['entries'][0]['amount_minor'],12) # 11.5, half up
        for changes in ({'pricing_method':None},{'rate':'NaN'},{'rate':'1'},{'rate':'-0.1'},{'entries':BOOK['entries']*2}):
            with self.assertRaises(ValueError):prepare_pricebook(dict(BOOK,**changes),{'HR 12-18M'})
        for changes in ({'cost_minor':True},{'cost_minor':-1},{'model_id':'unknown'},{'currency':'BAD'},{'price_date':'2025-13-25'}):
            with self.assertRaises(ValueError):prepare_pricebook(dict(BOOK,entries=[dict(BOOK['entries'][0],**changes)]),{'HR 12-18M'})
    async def test_access_and_private_source_never_exposed(self):
        await self.publish()
        uid,partner=await self.partner(['prices:read','api:export'])
        _,prices,_=await self.call('prices',headers=partner)
        self.assertEqual(prices['prices'][0]['amount_minor'],11765)
        for secret in ('cost_minor','private-source','factory-secret','margin','0.15'):
            self.assertNotIn(secret,json.dumps(prices))
        with self.assertRaises(PortalError):await self.call('pricebook',headers=partner)
        with self.assertRaises(PortalError):await self.call('prices-publish',{'pricebook':BOOK,'base_revision':'test-1'},partner)
        status,_,headers=await dispatch(self.portal,'/admin/api/prices','GET',{},b'','test')
        self.assertEqual(status,401);self.assertEqual(headers['Cache-Control'],'no-store')
        _,key,_=await self.call('key-create',{'scopes':['catalog:read','prices:read']},partner)
        auth={'authorization':'Bearer '+key['token']}
        _,export,_=await self.portal.handle('/partner-api/v1/catalog','GET',auth,{})
        self.assertEqual(export['prices'],prices['prices'])
        await self.call('user-update',{'id':uid,'role':'partner','active':True,'permissions':['api:export']},self.admin)
        _,export,_=await self.portal.handle('/partner-api/v1/catalog','GET',auth,{})
        self.assertNotIn('prices',export)
        with self.assertRaises(PortalError):await self.call('prices',headers=partner)
    async def test_validation_does_not_publish_stale_write_and_replacement(self):
        await self.call('prices-validate',{'pricebook':BOOK},self.admin)
        self.assertFalse((await self.call('prices',headers=self.admin))[1]['prices'])
        await self.publish()
        with self.assertRaises(PortalError):await self.publish(dict(BOOK,revision='test-2'))
        malformed=copy.deepcopy(BOOK);malformed['entries'][0]['cost_minor']=0
        with self.assertRaises(ValueError):await self.publish(malformed,'test-1')
        self.assertEqual((await self.portal.pricebook())['revision'],'test-1')
        nextbook=copy.deepcopy(BOOK);nextbook['revision']='test-2';nextbook['entries'][0]['model_id']='HR 12-5M'
        await self.publish(nextbook,'test-1')
        self.assertEqual([p['model_id'] for p in await self.portal.prices()],['HR 12-5M'])
    async def test_csrf_denies_price_publish(self):
        with self.assertRaises(PortalError):await self.call('prices-publish',{'pricebook':BOOK,'base_revision':''},{**self.admin,'x-csrf-token':'bad'})
