import {identity,permits} from './auth.mjs';
import {json} from './catalog.mjs';

export async function feedbackRoute(request,env) {
 const user=await identity(request,env);
 if(!user)return json({error:'authentication_required'},401);
 const db=env.PORTAL_DB;
 if(request.method==='GET'){
  if(!permits(user,'employees.manage'))return json({error:'forbidden'},403);
  const {results}=await db.prepare(
   'SELECT f.id, f.page_url AS pageUrl, f.excerpt, f.comment, f.created_at AS createdAt, u.name AS author FROM corp_site_feedback f JOIN corp_users u ON u.id=f.author_id ORDER BY f.created_at DESC,f.id DESC LIMIT ?'
  ).bind(100).all();
  return json({items:results});
 }
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(request.headers.get('Origin')!==env.PORTAL_ORIGIN)return json({error:'forbidden'},403);
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
 const reader=request.body?.getReader();
 if(!reader)return json({error:'invalid_feedback'},400);
 const decoder=new TextDecoder();
 let body='',size=0;
 while(true){
  const {value,done}=await reader.read();
  if(done)break;
  size+=value.byteLength;
  if(size>16000){await reader.cancel();return json({error:'body_too_large'},413);}
  body+=decoder.decode(value,{stream:true});
 }
 let draft,page;
 try{draft=JSON.parse(body+decoder.decode());page=new URL(draft.pageUrl);}
 catch{return json({error:'invalid_feedback'},400);}
 const {id,excerpt,comment}=draft;
 if(page.origin!=='https://test.yellow-battery.com'||page.username||page.password||
    !page.pathname.startsWith('/lithium/')||page.search||page.href.length>1024||
    typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id)||
    typeof excerpt!=='string'||!excerpt.trim()||excerpt.length>1200||
    typeof comment!=='string'||!comment.trim()||comment.length>2000){
  return json({error:'invalid_feedback'},400);
 }
 await db.prepare(
  'INSERT INTO corp_site_feedback (id,author_id,page_url,excerpt,comment,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING'
 ).bind(id,user.id,page.href,excerpt.trim(),comment.trim(),Date.now()).run();
 const record=await db.prepare('SELECT author_id FROM corp_site_feedback WHERE id=?').bind(id).first();
 if(record?.author_id!==user.id)return json({error:'feedback_conflict'},409);
 return json({id},201);
}
