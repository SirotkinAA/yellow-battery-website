import {feedbackRoute} from './feedback.mjs';
import {catalogRoute,json} from './catalog.mjs';
import {authRoute,identity,permits} from './auth.mjs';
export async function authorized(request,env){return permits(await identity(request,env),'catalog.read');}
export default {async fetch(request,env){
 try{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/auth/')||path.startsWith('/api/admin/'))return authRoute(request,env);
  if(path==='/api/catalog/status')return json({configured:!!(env.PORTAL_DB&&env.PORTAL_ORIGIN&&env.AUTH_CODE_SECRET),mode:'read_only'});
  if(path.startsWith('/api/catalog/')){
   if(!env.PORTAL_DB||!env.PORTAL_ORIGIN||!env.AUTH_CODE_SECRET)return json({error:'not_configured'},503);
   const u=await identity(request,env);if(!u)return json({error:'authentication_required'},401);
   if(!permits(u,'catalog.read'))return json({error:'forbidden'},403);
   return catalogRoute(request,env);
  }
  if(path==='/api/feedback')return await feedbackRoute(request,env);
  if(path.startsWith('/api/'))return json({error:'not_found'},404);
  // The portal shell and all demo business modules require a session.
  if(!['/auth/','/auth/index.html','/auth/app.js','/auth/style.css','/feedback/','/feedback/index.html','/feedback/app.js','/feedback/style.css'].includes(path)&&!await identity(request,env))return new Response(null,{status:302,headers:{Location:'/auth/','Cache-Control':'no-store'}});
  const asset=await env.ASSETS.fetch(request),headers=new Headers(asset.headers);
  headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');
  return new Response(asset.body,{status:asset.status,headers});
 }catch{return json({error:'service_unavailable'},503);}
}};
