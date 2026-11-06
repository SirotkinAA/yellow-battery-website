// The public YELLOW mirror consumes the same catalogue service and data revision.
// Visitor cookies and Authorization headers are never forwarded to the service.
const SERVICE='https://test.yellow-battery.com';
const PREFIXES=['/catalog','/bms','/lithium','/racks','/cabinets','/runtime','/assets','/downloads'];
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname!=='/admin/api/prices'&&!PREFIXES.some(prefix=>url.pathname===prefix||url.pathname.startsWith(prefix+'/')))return env.ASSETS.fetch(request);
 if(!['GET','HEAD','OPTIONS'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD, OPTIONS'}});
 const upstream=new URL(url.pathname+url.search,SERVICE);
 try{
  const response=await fetch(upstream,{method:request.method,headers:{Accept:request.headers.get('Accept')||'*/*'},redirect:'manual'});
  const headers=new Headers(response.headers);headers.delete('Set-Cookie');
  const location=headers.get('Location');if(location){const target=new URL(location,SERVICE);if(target.origin===SERVICE)headers.set('Location',target.pathname+target.search+target.hash);}
  headers.set('X-Catalogue-Service','shared-d1');
  return new Response(response.body,{status:response.status,headers});
 }catch{return new Response('Catalogue temporarily unavailable. Please retry.',{status:503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});}
}};
