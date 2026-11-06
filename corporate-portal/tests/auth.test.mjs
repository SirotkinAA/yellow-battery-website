import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {authRoute,passwordHash,passwordVerify,digest,identity} from '../server/auth.mjs';
import {AuthStore} from '../server/auth-store.mjs';
import worker from '../server/worker.mjs';
import {delivery} from '../server/delivery.mjs';
const origin='https://portal.example',password='correct horse battery staple';
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_employee_auth.sql',import.meta.url),'utf8'));
 const db={prepare(query){return{bind(...args){return{sql:query,args,async first(){return sql.prepare(query).get(...args)||null;},async all(){return{results:sql.prepare(query).all(...args)};},async run(){return{meta:sql.prepare(query).run(...args)};}};}};},async batch(statements){sql.exec('BEGIN');try{const out=statements.map(s=>({results:sql.prepare(s.sql).all(...s.args)}));sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={PORTAL_DB:db,PORTAL_ORIGIN:origin,AUTH_CODE_SECRET:'x'.repeat(48)},store=new AuthStore(db),sent=[];
 const send={ready:true,email:async(to,subject,text)=>sent.push({type:'email',to,text}),sms:async(to,text)=>sent.push({type:'sms',to,text})};
 function req(path,body,session='',requestOrigin=origin){return new Request(origin+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:requestOrigin}:{}),...(session?{Cookie:'__Host-corp_session='+session}:{}),'CF-Connecting-IP':'192.0.2.1'},...(body?{body:JSON.stringify(body)}:{})});}
 async function call(path,body,session='',requestOrigin){return authRoute(req(path,body,session,requestOrigin),env,{store,send});}
 async function seed(roles=['employee'],status='active'){
  const id=crypto.randomUUID(),address=id+'@example.com',phone='+7'+String(Math.floor(1000000000+Math.random()*8000000000));
  sql.prepare('INSERT INTO corp_users(id,email,phone,name,roles,status,password_hash,email_verified,phone_verified,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,address,phone,'Test User',JSON.stringify(roles),status,await passwordHash(password),1,1,1);
  const session='A'.repeat(42)+(roles.includes('admin')?'a':'b');await store.session(digest(session),await store.byId(id),Math.floor(Date.now()/1000)+3600);return{id,email:address,phone,session};
 }
 return {sql,env,store,sent,send,req,call,seed};
}
test('passwords use salted work-factor hashes and reject weak passwords',async()=>{
 const a=await passwordHash(password),b=await passwordHash(password);assert.notEqual(a,b);assert(!a.includes(password));assert(await passwordVerify(password,a));assert(!await passwordVerify('wrong',a));await assert.rejects(passwordHash('short'));
});
test('admin invitation requires both channels before login, and link cannot be replayed',async()=>{
 const f=fixture(),admin=await f.seed(['admin']);
 let r=await f.call('/api/admin/employees/invite',{name:'New Employee',email:'new@example.com',phone:'+79991234567',roles:['employee']},admin.session);assert.equal(r.status,201);
 assert.equal(f.sent.length,1);const token=f.sent[0].text.match(/#invite=([\w-]+)/)[1];
 assert.equal((await f.call('/api/auth/login',{email:'new@example.com',password})).status,401);
 assert.equal((await f.call('/api/auth/set-password',{token,code:'123456',password})).status,400);
 assert.equal((await f.call('/api/auth/confirm-email',{token})).status,200);assert.equal(f.sent[1].to,'+79991234567');
 const code=f.sent[1].text.match(/\d{6}/)[0];
 assert.equal((await f.call('/api/auth/set-password',{token,code,password})).status,200);
 assert.equal((await f.call('/api/auth/set-password',{token,code,password})).status,400);
 r=await f.call('/api/auth/login',{email:'new@example.com',password});assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/Secure; HttpOnly; SameSite=Strict/);
 const u=await f.store.user('new@example.com');assert.equal(u.email_verified,1);assert.equal(u.phone_verified,1);
 assert(!JSON.stringify(f.sql.prepare('SELECT * FROM corp_challenges').all()).includes(token));
});
test('recovery revokes old sessions, consumes all links of the previous version',async()=>{
 const f=fixture(),u=await f.seed();
 await f.call('/api/auth/recover',{email:u.email});await f.call('/api/auth/recover',{email:u.email});
 const tokens=f.sent.map(x=>x.text.match(/#recover=([\w-]+)/)[1]),t=tokens[0];await f.call('/api/auth/confirm-email',{token:t});
 const code=f.sent.at(-1).text.match(/\d{6}/)[0];assert.equal((await f.call('/api/auth/set-password',{token:t,code,password:'a completely different password'})).status,200);
 assert.equal(await identity(f.req('/api/auth/me',null,u.session),f.env),null);
 assert.equal((await f.call('/api/auth/confirm-email',{token:tokens[1]})).status,400);
 assert.equal((await f.call('/api/auth/login',{email:u.email,password})).status,401);
 assert.equal((await f.call('/api/auth/login',{email:u.email,password:'a completely different password'})).status,200);
});
test('fifth wrong code locks the link, and expired code fails',async()=>{
 const f=fixture(),u=await f.seed();await f.call('/api/auth/recover',{email:u.email});const token=f.sent[0].text.match(/#recover=([\w-]+)/)[1];await f.call('/api/auth/confirm-email',{token});const code=f.sent[1].text.match(/\d{6}/)[0],wrong=code==='000000'?'111111':'000000';
 for(let i=0;i<5;i++)assert.equal((await f.call('/api/auth/set-password',{token,code:wrong,password})).status,400);
 assert.equal((await f.call('/api/auth/set-password',{token,code,password})).status,400);
 f.sql.prepare('UPDATE corp_challenges SET attempts=0,code_expires=1').run();assert.equal((await f.call('/api/auth/set-password',{token,code,password})).status,400);
});
test('employees cannot grant roles, disabling revokes sessions, admin is protected',async()=>{
 const f=fixture(),admin=await f.seed(['admin']),u=await f.seed();
 assert.equal((await f.call('/api/admin/employees/access',{id:u.id,roles:['admin'],status:'active'},u.session)).status,403);
 assert.equal((await f.call('/api/admin/employees/access',{id:admin.id,roles:['employee'],status:'disabled'},admin.session)).status,409);
 assert.equal((await f.call('/api/admin/employees/access',{id:u.id,roles:['employee'],status:'disabled'},admin.session)).status,200);
 assert.equal(await identity(f.req('/api/auth/me',null,u.session),f.env),null);assert.equal((await f.call('/api/auth/login',{email:u.email,password})).status,401);
});
test('CSRF, fake identity and direct unauthenticated shell access are rejected',async()=>{
 const f=fixture();assert.equal((await f.call('/api/auth/login',{email:'nobody@example.com',password},'','https://evil.example')).status,403);
 const r=await worker.fetch(new Request(origin+'/',{headers:{'Cf-Access-Authenticated-User-Email':'admin@example.com'}}),f.env);assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/auth/');
 assert.equal((await worker.fetch(new Request(origin+'/api/catalog/products'),f.env)).status,401);
});
test('login is throttled and recovery never confirms whether an address exists',async()=>{
 const f=fixture();for(let i=0;i<8;i++)assert.equal((await f.call('/api/auth/login',{email:'absent@example.com',password})).status,401);
 assert.equal((await f.call('/api/auth/login',{email:'absent@example.com',password})).status,429);
 const r=await f.call('/api/auth/recover',{email:'absent@example.com'});assert.equal(r.status,200);assert.equal(f.sent.length,0);
});
test('admin recovery verifies admin password and both replacement channels',async()=>{
 const f=fixture(),admin=await f.seed(['admin']),u=await f.seed();
 const body={id:u.id,email:'replaced@example.com',phone:'+79991112233',identityChecked:true,adminPassword:'wrong'};
 assert.equal((await f.call('/api/admin/employees/restore',body,admin.session)).status,401);
 body.adminPassword=password;assert.equal((await f.call('/api/admin/employees/restore',body,admin.session)).status,200);
 assert.equal(await identity(f.req('/api/auth/me',null,u.session),f.env),null);
 const changed=await f.store.byId(u.id);assert.equal(changed.status,'invited');assert.equal(changed.email_verified,0);assert.equal(changed.phone_verified,0);
 assert.equal((await f.call('/api/auth/login',{email:body.email,password})).status,401);
});
test('provider errors are detected, secrets and codes never enter request URLs',async()=>{
 const calls=[],env={UNISENDER_GO_KEY:'mail-key',MAIL_FROM:'portal@example.com',SMS_RU_KEY:'sms-key'};
 const send=delivery(env,async(url,opts)=>{calls.push({url,opts});return Response.json(url.includes('sms.ru')?{status:'OK',sms:{'79991234567':{status:'ERROR'}}}:{status:'error'});});
 await assert.rejects(send.email('employee@example.com','subject','link'));await assert.rejects(send.sms('+79991234567','123456'));
 for(const c of calls){assert(!c.url.includes('key'));assert(!c.url.includes('123456'));assert.equal(c.opts.redirect,'error');}
});
