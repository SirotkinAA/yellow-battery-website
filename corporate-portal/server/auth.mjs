import {pbkdf2,randomBytes,randomInt,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {AuthStore} from './auth-store.mjs';
import {delivery} from './delivery.mjs';
const COOKIE='__Host-corp_session',ttl=8*3600;
export const ROLES=Object.freeze({admin:['employees.manage','catalog.read'],employee:['catalog.read'],catalog_reader:['catalog.read']});
const fail=(error,status=400)=>{throw Object.assign(Error(error),{status});};
const now=()=>Math.floor(Date.now()/1000);
export const digest=s=>createHash('sha256').update(s).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
export function validRoles(roles){return Array.isArray(roles)&&roles.length>0&&roles.length<=3&&new Set(roles).size===roles.length&&roles.every(r=>Object.hasOwn(ROLES,r));}
export function publicUser(u){return {id:u.id,email:u.email,name:u.name,roles:JSON.parse(u.roles),status:u.status};}
export function permits(u,permission){return !!u&&JSON.parse(u.roles).some(r=>ROLES[r]?.includes(permission));}
function passwordCheck(p){if(typeof p!=='string'||p.length<15||p.length>128)fail('password_length');}
function derive(password,salt){return new Promise((resolve,reject)=>pbkdf2(password,salt,600000,32,'sha256',(e,key)=>e?reject(e):resolve(key)));}
export async function passwordHash(p){passwordCheck(p);const salt=randomBytes(16).toString('hex');return 'pbkdf2-sha256$600000$'+salt+'$'+(await derive(p,salt)).toString('hex');}
export async function passwordVerify(p,stored){
 if(typeof p!=='string'||p.length>128)return false;
 const parts=(stored||'').split('$'),valid=parts.length===4&&parts[0]==='pbkdf2-sha256'&&parts[1]==='600000'&&/^[a-f0-9]{32}$/.test(parts[2])&&/^[a-f0-9]{64}$/.test(parts[3]);
 const key=await derive(p,valid?parts[2]:'00000000000000000000000000000000');
 return valid&&timingSafeEqual(key,Buffer.from(parts[3],'hex'));
}
function token(request){const v=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';return /^[A-Za-z0-9_-]{43}$/.test(v)?v:'';}
export async function identity(request,env){return env.PORTAL_DB&&token(request)?new AuthStore(env.PORTAL_DB).sessionUser(digest(token(request)),now()):null;}
function response(data,status=200,headers={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});}
function cookie(value,age){return `${COOKIE}=${value}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;}
function origin(env){try{const u=new URL(env.PORTAL_ORIGIN);if(u.protocol!=='https:'||u.origin!==env.PORTAL_ORIGIN)return null;return u.origin;}catch{return null;}}
async function input(request){
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))fail('json_required',415);
 const reader=request.body?.getReader();if(!reader)fail('invalid_body');let length=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();fail('body_too_large',413);}chunks.push(value);}
 try{const bytes=new Uint8Array(length);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}const b=JSON.parse(new TextDecoder().decode(bytes));if(!b||Array.isArray(b)||typeof b!=='object')fail('invalid_body');return b;}catch{fail('invalid_body');}
}
const email=v=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?v.trim().toLowerCase():fail('invalid_email');
const phone=v=>typeof v==='string'&&/^\+[1-9][0-9]{7,14}$/.test(v)?v:fail('invalid_phone');
function codeHash(env,tokenHash,code){return createHmac('sha256',env.AUTH_CODE_SECRET).update(tokenHash+':'+code).digest('hex');}
function challengeValid(c,purpose=null){return c&&c.consumed===0&&c.expires_at>now()&&c.status!=='disabled'&&c.user_version===c.version&&(!purpose||c.purpose===purpose);}
export async function authRoute(request,env,{store=env.PORTAL_DB?new AuthStore(env.PORTAL_DB):null,send=delivery(env)}={}){
 try{
  const path=new URL(request.url).pathname,configured=!!(store&&origin(env)&&env.AUTH_CODE_SECRET?.length>=32);
  if(path==='/api/auth/status'&&request.method==='GET')return response({configured,delivery:send.ready});
  if(!configured)fail('not_configured',503);
  if(request.method==='GET'){
   if(path==='/api/auth/me'){const u=await identity(request,env);return u?response({user:publicUser(u)}):response({error:'authentication_required'},401);}
   if(path==='/api/admin/employees'){const u=await identity(request,env);if(!permits(u,'employees.manage'))fail('forbidden',403);return response({items:(await store.users()).map(x=>({...publicUser(x),phone:x.phone,emailVerified:!!x.email_verified,phoneVerified:!!x.phone_verified}))});}
   fail('not_found',404);
  }
  if(request.method!=='POST')fail('method_not_allowed',405);
  if(request.headers.get('Origin')!==origin(env))fail('invalid_origin',403);
  const b=await input(request),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  if(!await store.limit('ip:'+digest(ip),now(),600,40))fail('too_many_requests',429);
  if(path==='/api/auth/logout'){await store.logout(digest(token(request)));return response({ok:true},200,{'Set-Cookie':cookie('',0)});}
  if(path==='/api/auth/login'){
   const address=email(b.email);if(!await store.limit('login:'+digest(address),now(),900,8))fail('too_many_requests',429);
   const u=await store.user(address),ok=await passwordVerify(b.password,u?.password_hash);
   if(!ok||u.status!=='active'||!u.email_verified||!u.phone_verified)fail('invalid_credentials',401);
   const session=secret();await store.session(digest(session),u,now()+ttl);await store.audit(u.id,u.id,'login',now());
   return response({user:publicUser(u)},200,{'Set-Cookie':cookie(session,ttl)});
  }
  if(path==='/api/admin/employees/invite'){
   const actor=await identity(request,env);if(!permits(actor,'employees.manage'))fail('forbidden',403);if(!send.ready)fail('delivery_not_configured',503);
   if(!validRoles(b.roles)||b.roles.includes('admin'))fail('invalid_roles');
   if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120)fail('invalid_name');
   const u={id:crypto.randomUUID(),email:email(b.email),phone:phone(b.phone),name:b.name.trim(),roles:b.roles},t=secret(),hash=digest(t);
   if(await store.user(u.email))fail('employee_exists',409);
   await store.invite(u,{token_hash:hash,user_id:u.id,user_version:1,purpose:'invite',expires_at:now()+86400},actor.id,now());
   await send.email(u.email,'Приглашение в корпоративный портал',`Для подтверждения почты и задания пароля откройте ${origin(env)}/auth/#invite=${t}\nСсылка действует 24 часа. Затем потребуется код на телефон.`);
   return response({id:u.id,status:'invited'},201);
  }
  if(path==='/api/admin/employees/access'){
   const actor=await identity(request,env);if(!permits(actor,'employees.manage'))fail('forbidden',403);
   if(!validRoles(b.roles)||b.roles.includes('admin')||!['active','disabled'].includes(b.status)||typeof b.id!=='string')fail('invalid_access');
   const target=await store.byId(b.id);if(!target||target.status==='invited')fail('employee_not_active',409);
   if(!await store.change(actor.id,b.id,b.roles,b.status,now()))fail('administrator_protected',409);
   return response({ok:true});
  }
  if(path==='/api/admin/employees/reinvite'||path==='/api/admin/employees/restore'){
   const actor=await identity(request,env);if(!permits(actor,'employees.manage'))fail('forbidden',403);
   if(!send.ready)fail('delivery_not_configured',503);
   if(!await store.limit('admin-recovery:'+actor.id,now(),900,5))fail('too_many_requests',429);
   if(!await passwordVerify(b.adminPassword,actor.password_hash))fail('invalid_credentials',401);
   const target=typeof b.id==='string'?await store.byId(b.id):null;
   if(!target||JSON.parse(target.roles).includes('admin'))fail('administrator_protected',409);
   const restore=path.endsWith('/restore');if(!restore&&target.status!=='invited')fail('employee_not_invited',409);
   // Administrator checks identity out of band before explicitly replacing either recovery channel.
   if(restore&&b.identityChecked!==true)fail('identity_check_required');
   const contacts=restore?{email:email(b.email),phone:phone(b.phone)}:null,t=secret();
   if(!await store.renew(target,{token_hash:digest(t),expires_at:now()+86400},actor.id,now(),contacts))fail('concurrent_change',409);
   await send.email(contacts?.email||target.email,'Приглашение в корпоративный портал',`Для задания пароля откройте ${origin(env)}/auth/#invite=${t}\nСсылка действует 24 часа. Затем потребуется код на телефон.`);
   return response({ok:true});
  }
  if(path==='/api/auth/recover'){
   if(!send.ready)fail('delivery_not_configured',503);const address=email(b.email);
   if(!await store.limit('recover:'+digest(address),now(),3600,3))fail('too_many_requests',429);
   const u=await store.user(address);
   if(u?.status==='active'&&u.email_verified&&u.phone_verified){
    const t=secret();await store.challenge({token_hash:digest(t),user_id:u.id,user_version:u.version,purpose:'recover',expires_at:now()+900});
    try{await send.email(address,'Восстановление доступа',`Откройте ${origin(env)}/auth/#recover=${t}\nСсылка действует 15 минут. После подтверждения почты потребуется код на телефон.`);}catch{await store.audit(null,u.id,'recovery_delivery_failed',now());}
   }
   return response({ok:true,message:'Если учётная запись существует, письмо будет отправлено.'});
  }
  if(path==='/api/auth/confirm-email'){
   if(!send.ready)fail('delivery_not_configured',503);if(!/^[A-Za-z0-9_-]{43}$/.test(b.token||''))fail('invalid_link');
   const hash=digest(b.token),c=await store.getChallenge(hash);if(!challengeValid(c))fail('invalid_link');
   if(!await store.limit('sms:'+c.user_id,now(),3600,3))fail('too_many_requests',429);
   const code=String(randomInt(0,1000000)).padStart(6,'0');
   if(!await store.emailAndCode(hash,codeHash(env,hash,code),now()))fail('link_already_used');
   await send.sms(c.phone,`Корпоративный портал: код ${code}. Действует 5 минут. Никому не сообщайте.`);
   return response({ok:true,phoneHint:'…'+c.phone.slice(-4)});
  }
  if(path==='/api/auth/set-password'){
   passwordCheck(b.password);if(!/^[A-Za-z0-9_-]{43}$/.test(b.token||'')||!/^\d{6}$/.test(b.code||''))fail('invalid_code');
   const hash=digest(b.token),c=await store.getChallenge(hash);if(!challengeValid(c))fail('invalid_link');
   const attempt=await store.attempt(hash,now());if(!attempt)fail('code_expired_or_locked');
   const code=codeHash(env,hash,b.code);if(!timingSafeEqual(Buffer.from(code),Buffer.from(attempt.code_hash||'')))fail('invalid_code');
   const id=await store.finish(hash,code,await passwordHash(b.password),now());if(!id)fail('invalid_link');
   await store.audit(id,id,c.purpose==='invite'?'invitation_accepted':'password_recovered',now());return response({ok:true});
  }
  fail('not_found',404);
 }catch(e){return response({error:e.status?e.message:'service_unavailable'},e.status||503);}
}
