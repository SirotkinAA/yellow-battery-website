"""Transport-independent portal. Every privileged action checks current server rights."""
import json
import time
import secrets
import hmac
from http.cookies import SimpleCookie
from .security import email, token, digest, password_hash, password_ok, permissions, origins, widget_config, PERMISSIONS
from battery_calculator.io import read_dataset

COOKIE='yellow_portal_session'
SESSION_SECONDS=8*3600

class PortalError(Exception):
    def __init__(self,status,message):self.status,self.message=status,message

def public_user(user):
    return {k:user[k] for k in ('id','email','role','active')} | {'permissions':json.loads(user['permissions'])}

def allowed(user,permission):return user['role']=='admin' or permission in json.loads(user['permissions'])

class Portal:
    def __init__(self,store,dataset,origin,secure=True):
        self.db,self.base_dataset,self.origin,self.secure=store,dataset,origin,secure
    async def audit(self,actor,action,target='',detail=None):
        await self.db.query('INSERT INTO portal_audit VALUES (?,?,?,?,?,?)',(token(),actor,action,target,json.dumps(detail or {},ensure_ascii=False),int(time.time())))
    async def limit(self,key,maximum,seconds=900):
        now=int(time.time());ident=digest(key+':'+str(now//seconds))
        await self.db.query('DELETE FROM portal_limits WHERE expires_at<?',(now,))
        rows=await self.db.query('INSERT INTO portal_limits(id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',(ident,now+seconds))
        if rows[0]['count']>maximum:raise PortalError(429,'Слишком много попыток. Повторите позднее.')
    async def session(self,headers):
        cookie=SimpleCookie()
        try:cookie.load(headers.get('cookie',''))
        except Exception:return None,None
        raw=cookie.get(COOKIE)
        if not raw:return None,None
        rows=await self.db.query('SELECT u.*,s.csrf,s.token_hash FROM portal_sessions s JOIN portal_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1',(digest(raw.value),int(time.time())))
        return (rows[0],rows[0]['token_hash']) if rows else (None,None)
    def same_origin(self,headers):
        if headers.get('origin')!=self.origin:raise PortalError(403,'Недопустимый источник запроса')
    async def authorize(self,headers,method,admin=False,permission=None):
        user,session=await self.session(headers)
        if not user:raise PortalError(401,'Войдите в кабинет')
        if method not in ('GET','HEAD'):
            self.same_origin(headers)
            if not hmac.compare_digest(headers.get('x-csrf-token',''),user['csrf']):raise PortalError(403,'Обновите страницу и повторите действие')
        if admin and user['role']!='admin':raise PortalError(403,'Требуются права администратора')
        if permission and not allowed(user,permission):raise PortalError(403,'Нет необходимого права доступа')
        return user,session
    def cookie(self,raw,max_age=SESSION_SECONDS):
        return f'{COOKIE}={raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}'+('; Secure' if self.secure else '')
    async def dataset(self):
        rows=await self.db.query("SELECT payload FROM portal_datasets WHERE id=(SELECT value FROM portal_settings WHERE id='active_dataset')")
        return json.loads(rows[0]['payload']) if rows else self.base_dataset
    async def invite(self,user_id,actor):
        raw=token();now=int(time.time())
        await self.db.batch([('DELETE FROM portal_invites WHERE user_id=?',(user_id,)),('INSERT INTO portal_invites VALUES (?,?,?,NULL)',(digest(raw),user_id,now+86400))])
        await self.audit(actor,'password_link_created',user_id)
        return self.origin+'/admin/#activate='+raw
    async def bootstrap(self,address):
        address=email(address)
        # No HTTP bootstrap endpoint. This is an operator-only command.
        rows=await self.db.query('SELECT id FROM portal_users LIMIT 1')
        if rows:raise ValueError('Первый пользователь уже существует')
        ident=token()
        await self.db.query('INSERT INTO portal_users VALUES (?,?,NULL,?,1,?,?)',(ident,address,'admin',json.dumps(list(PERMISSIONS)),int(time.time())))
        return await self.invite(ident,'bootstrap')
    async def api_user(self,headers):
        auth=headers.get('authorization','')
        if not auth.startswith('Bearer '):raise PortalError(401,'Требуется API-ключ')
        rows=await self.db.query('SELECT u.*,k.id AS key_id,k.scopes FROM portal_api_keys k JOIN portal_users u ON u.id=k.user_id WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>? AND u.active=1',(digest(auth[7:]),int(time.time())))
        if not rows or not allowed(rows[0],'api:export'):raise PortalError(403,'API-ключ отозван, истёк или доступ запрещён')
        await self.limit('api:'+rows[0]['key_id'],60,60)
        return rows[0]
    async def widget(self,ident):
        rows=await self.db.query('SELECT w.*,u.role,u.permissions,u.active AS user_active FROM portal_widgets w JOIN portal_users u ON u.id=w.user_id WHERE w.id=? AND w.active=1 AND u.active=1',(ident,))
        if not rows or not allowed(rows[0],'widget:embed'):raise PortalError(404,'Виджет недоступен')
        row=rows[0]
        return {'id':row['id'],'config':json.loads(row['config']),'origins':json.loads(row['origins'])}
    async def handle(self,path,method,headers,data,ip='unknown'):
        now=int(time.time());out_headers={}
        if path=='/admin/api/apply' and method=='POST':
            self.same_origin(headers);await self.limit('apply-ip:'+ip,5,3600)
            address=email(data.get('email',''));company=str(data.get('company','')).strip();website=str(data.get('website','')).strip();message=str(data.get('message',''))
            if not 2<=len(company)<=160 or len(website)>250 or len(message)>2000:raise PortalError(400,'Проверьте название компании и длину полей')
            exists=await self.db.query('SELECT id FROM portal_users WHERE email=?',(address,))
            if not exists:
                await self.db.query("INSERT OR IGNORE INTO portal_applications VALUES (?,?,?,?,?,'pending',?,NULL)",(token(),address,company,website,message,now))
            return 200,{'message':'Заявка принята. Доступ появится после одобрения администратором.'},out_headers
        if path=='/admin/api/login' and method=='POST':
            self.same_origin(headers);await self.limit('login-ip:'+ip,30)
            address=email(data.get('email',''));await self.limit('login-email:'+address,10)
            rows=await self.db.query('SELECT * FROM portal_users WHERE email=?',(address,));user=rows[0] if rows else None
            valid=await password_ok(data.get('password',''),user['password_hash'] if user else None)
            if not valid or not user['active']:raise PortalError(401,'Неверная почта или пароль')
            raw=token();csrf=token()
            await self.db.query('INSERT INTO portal_sessions VALUES (?,?,?,?)',(digest(raw),user['id'],csrf,now+SESSION_SECONDS))
            await self.audit(user['id'],'login')
            return 200,{'user':public_user(user),'csrf':csrf},{'Set-Cookie':self.cookie(raw)}
        if path=='/admin/api/activate' and method=='POST':
            self.same_origin(headers);await self.limit('activate-ip:'+ip,10)
            raw=str(data.get('token',''));hashed=await password_hash(data.get('password',''))
            # D1 batch is transactional; the token is consumed with the password update.
            updates=await self.db.batch([
                ('UPDATE portal_users SET password_hash=? WHERE active=1 AND id IN (SELECT user_id FROM portal_invites WHERE token_hash=? AND expires_at>? AND used_at IS NULL) RETURNING id',(hashed,digest(raw),now)),
                ('DELETE FROM portal_sessions WHERE user_id IN (SELECT user_id FROM portal_invites WHERE token_hash=? AND expires_at>? AND used_at IS NULL)',(digest(raw),now)),
                ('UPDATE portal_invites SET used_at=? WHERE token_hash=? AND expires_at>? AND used_at IS NULL',(now,digest(raw),now))])
            if not updates[0]:raise PortalError(400,'Ссылка недействительна или истекла')
            await self.audit(updates[0][0]['id'],'password_set')
            return 200,{'message':'Пароль установлен. Теперь войдите в кабинет.'},out_headers
        if path.startswith('/partner-api/v1/'):
            if method!='GET':raise PortalError(405,'Разрешён только GET')
            user=await self.api_user(headers);scopes=json.loads(user['scopes'])
            if path=='/partner-api/v1/catalog':
                if 'catalog:read' not in scopes:raise PortalError(403,'Ключ не разрешает выгрузку каталога')
                dataset=await self.dataset()
                # The export deliberately excludes internal provenance and quarantine.
                exported={'schema_version':'1','dataset_id':dataset['dataset_id'],'revision':dataset['revision'],'models':[]}
                for model in dataset['models']:
                    exported['models'].append({k:model[k] for k in ('id','series','nominal_voltage_v','cells','nominal_capacity_ah','capacity_rating')} | {'curves':[{k:v for k,v in c.items() if k not in ('source_ref','approval')} for c in model['curves']]})
                if 'prices:read' in scopes and allowed(user,'prices:read'):exported['prices']=await self.db.query('SELECT * FROM portal_prices')
                await self.audit(user['id'],'api_catalog_export',user['key_id'])
                return 200,exported,out_headers
            raise PortalError(404,'API-метод не найден')
        user,session=await self.authorize(headers,method)
        admin=user['role']=='admin'
        if path=='/admin/api/me' and method=='GET':return 200,{'user':public_user(user),'csrf':user['csrf']},out_headers
        if path=='/admin/api/logout' and method=='POST':
            await self.db.query('DELETE FROM portal_sessions WHERE token_hash=?',(session,))
            return 200,{'ok':True},{'Set-Cookie':self.cookie('',0)}
        if path=='/admin/api/overview' and method=='GET':
            return 200,{'user':public_user(user),'catalog_models':len((await self.dataset())['models']),'prices_ready':False},out_headers
        if path=='/admin/api/prices' and method=='GET':
            if not allowed(user,'prices:read'):raise PortalError(403,'Нет доступа к ценам')
            return 200,{'prices':await self.db.query('SELECT * FROM portal_prices'),'message':'Цены ещё не добавлены'},out_headers
        if path=='/admin/api/applications' and method=='GET' and admin:
            return 200,{'applications':await self.db.query('SELECT * FROM portal_applications ORDER BY created_at DESC LIMIT 200')},out_headers
        if path=='/admin/api/application-review' and method=='POST' and admin:
            rows=await self.db.query("SELECT * FROM portal_applications WHERE id=? AND status='pending'",(data.get('id'),))
            if not rows:raise PortalError(409,'Заявка уже рассмотрена или не найдена')
            app=rows[0];approve=data.get('decision')=='approve'
            if data.get('decision') not in ('approve','reject'):raise PortalError(400,'Укажите решение')
            if approve:
                grants=permissions(data.get('permissions',[]));uid=token()
                await self.db.batch([
                    ('INSERT INTO portal_users(id,email,role,active,permissions,created_at) VALUES (?,?,?,1,?,?) ON CONFLICT(email) DO NOTHING',(uid,app['email'],'partner',json.dumps(grants),now)),
                    ("UPDATE portal_applications SET status='approved',reviewed_by=? WHERE id=? AND status='pending'",(user['id'],app['id']))])
                account=(await self.db.query('SELECT id FROM portal_users WHERE email=?',(app['email'],)))[0]
                link=await self.invite(account['id'],user['id'])
                await self.audit(user['id'],'application_approved',app['id'],{'permissions':grants})
                return 200,{'activation_url':link,'email':app['email']},out_headers
            await self.db.query("UPDATE portal_applications SET status='rejected',reviewed_by=? WHERE id=?",(user['id'],app['id']))
            await self.audit(user['id'],'application_rejected',app['id'])
            return 200,{'ok':True},out_headers
        if path=='/admin/api/users' and method=='GET' and admin:
            return 200,{'users':[public_user(row) for row in await self.db.query('SELECT * FROM portal_users ORDER BY created_at')]},out_headers
        if path=='/admin/api/user-update' and method=='POST' and admin:
            grants=permissions(data.get('permissions',[]));uid=data.get('id');role=data.get('role','partner');active=data.get('active')
            if role not in ('admin','partner') or type(active) is not bool:raise PortalError(400,'Некорректная роль или статус')
            # Cannot disable/demote the last active administrator, including concurrent requests.
            rows=await self.db.query("UPDATE portal_users SET role=?,active=?,permissions=? WHERE id=? AND (role!='admin' OR active=0 OR (?='admin' AND ?=1) OR (SELECT COUNT(*) FROM portal_users WHERE role='admin' AND active=1)>1) RETURNING id",(role,int(active),json.dumps(grants),uid,role,int(active)))
            if not rows:raise PortalError(409,'Нельзя отключить последнего администратора или пользователь не найден')
            await self.db.query('DELETE FROM portal_sessions WHERE user_id=?',(uid,))
            await self.audit(user['id'],'user_updated',uid,{'role':role,'active':active,'permissions':grants})
            return 200,{'ok':True},out_headers
        if path=='/admin/api/password-link' and method=='POST' and admin:
            rows=await self.db.query('SELECT id FROM portal_users WHERE id=? AND active=1',(data.get('id'),))
            if not rows:raise PortalError(404,'Пользователь не найден')
            return 200,{'activation_url':await self.invite(data['id'],user['id'])},out_headers
        if path=='/admin/api/keys' and method=='GET':
            where,args=('',()) if admin else (' WHERE user_id=?',(user['id'],))
            return 200,{'keys':await self.db.query('SELECT id,user_id,name,prefix,scopes,expires_at,revoked_at FROM portal_api_keys'+where,args)},out_headers
        if path=='/admin/api/key-create' and method=='POST':
            uid=data.get('user_id',user['id'])
            if not admin and uid!=user['id']:raise PortalError(403,'Нельзя создать ключ другому пользователю')
            owners=await self.db.query('SELECT * FROM portal_users WHERE id=? AND active=1',(uid,))
            if not owners or not allowed(owners[0],'api:export'):raise PortalError(403,'Владельцу не разрешён API')
            scopes=data.get('scopes',['catalog:read'])
            if not isinstance(scopes,list) or not scopes or any(x not in ('catalog:read','prices:read') for x in scopes):raise PortalError(400,'Некорректные права API')
            if 'prices:read' in scopes and not allowed(owners[0],'prices:read'):raise PortalError(403,'Владельцу не разрешены цены')
            name=str(data.get('name','API'))[:80];raw='ylw_'+token();ident=token()
            await self.db.query('INSERT INTO portal_api_keys VALUES (?,?,?,?,?,?,?,NULL,?)',(ident,uid,digest(raw),raw[:12],name,json.dumps(scopes),now+90*86400,now))
            await self.audit(user['id'],'api_key_created',ident,{'owner':uid,'scopes':scopes})
            return 200,{'id':ident,'token':raw,'expires_at':now+90*86400},out_headers
        if path=='/admin/api/key-revoke' and method=='POST':
            rows=await self.db.query('UPDATE portal_api_keys SET revoked_at=? WHERE id=? AND (user_id=? OR ?=1) RETURNING id',(now,data.get('id'),user['id'],int(admin)))
            if not rows:raise PortalError(404,'Ключ не найден')
            await self.audit(user['id'],'api_key_revoked',data['id'])
            return 200,{'ok':True},out_headers
        if path=='/admin/api/widgets' and method=='GET':
            where,args=('',()) if admin else (' WHERE user_id=?',(user['id'],))
            return 200,{'widgets':await self.db.query('SELECT * FROM portal_widgets'+where,args)},out_headers
        if path=='/admin/api/widget-save' and method=='POST':
            uid=data.get('user_id',user['id']);ident=data.get('id') or token()
            existing=await self.db.query('SELECT * FROM portal_widgets WHERE id=?',(ident,))
            if existing:uid=existing[0]['user_id']
            if not admin and uid!=user['id']:raise PortalError(403,'Нет доступа к виджету')
            owners=await self.db.query('SELECT * FROM portal_users WHERE id=? AND active=1',(uid,))
            if not owners or not allowed(owners[0],'widget:embed'):raise PortalError(403,'Владельцу не разрешены виджеты')
            config=widget_config(data.get('config',{}));hosts=origins(data.get('origins',[]));name=str(data.get('name','Калькулятор'))[:80]
            active=data.get('active',True)
            if type(active) is not bool:raise PortalError(400,'Некорректный статус')
            await self.db.query('INSERT INTO portal_widgets VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,config=excluded.config,origins=excluded.origins,active=excluded.active,updated_at=excluded.updated_at',(ident,uid,name,json.dumps(config,ensure_ascii=False),json.dumps(hosts),int(active),now))
            await self.audit(user['id'],'widget_saved',ident,{'owner':uid,'origins':hosts,'active':active})
            return 200,{'id':ident,'url':self.origin+'/embed/'+ident},out_headers
        if path=='/admin/api/catalog' and method=='GET' and admin:
            return 200,{'dataset':await self.dataset()},out_headers
        if path in ('/admin/api/catalog-validate','/admin/api/catalog-publish') and method=='POST' and admin:
            dataset=data.get('dataset')
            if not isinstance(dataset,dict) or dataset.get('origin')!='new_shared_dataset':raise PortalError(400,'Нужен реальный набор данных')
            models,rejected=read_dataset(dataset)
            if not models or rejected:raise PortalError(400,'Набор не принят: '+json.dumps(rejected,ensure_ascii=False)[:1500])
            if any(not any(c.mode=='constant_power' for c in m.curves) for m in models):raise PortalError(400,'Для каждой модели нужна таблица мощности')
            if any(c.approval!='approved' for m in models for c in m.curves):raise PortalError(400,'Все публикуемые строки должны быть утверждены')
            serialized=json.dumps(dataset,ensure_ascii=False,sort_keys=True);sha=digest(serialized)
            if path.endswith('publish'):
                ident=token();active=await self.dataset()
                if data.get('base_revision')!=active['revision']:raise PortalError(409,'База обновилась. Загрузите свежую версию')
                if dataset['revision']==active['revision']:raise PortalError(400,'Укажите новую ревизию набора')
                current=await self.db.query("SELECT value FROM portal_settings WHERE id='active_dataset'")
                # Check the revision again against the ID used for the atomic compare-and-swap.
                if current:
                    old=await self.db.query('SELECT payload FROM portal_datasets WHERE id=?',(current[0]['value'],))
                    if json.loads(old[0]['payload'])['revision']!=data['base_revision']:raise PortalError(409,'База обновилась. Загрузите свежую версию')
                    switch=("UPDATE portal_settings SET value=? WHERE id='active_dataset' AND value=? RETURNING value",(ident,current[0]['value']))
                else:
                    switch=("INSERT INTO portal_settings VALUES ('active_dataset',?) ON CONFLICT(id) DO NOTHING RETURNING value",(ident,))
                saved=await self.db.batch([('INSERT INTO portal_datasets VALUES (?,?,?,?,?)',(ident,serialized,sha,user['id'],now)),switch])
                if not saved[1]:raise PortalError(409,'База обновилась одновременно. Повторите проверку')
                await self.audit(user['id'],'dataset_published',ident,{'revision':dataset['revision'],'sha256':sha})
            return 200,{'models':len(models),'curves':sum(len(m.curves) for m in models),'sha256':sha},out_headers
        if path=='/admin/api/audit' and method=='GET' and admin:
            return 200,{'events':await self.db.query('SELECT * FROM portal_audit ORDER BY created_at DESC LIMIT 200')},out_headers
        raise PortalError(403 if not admin else 404,'Нет доступа или метод не найден')
