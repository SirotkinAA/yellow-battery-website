// Shared technical catalogue only. No prices, internal aliases or API secrets.
const ENDPOINT='https://test.yellow-battery.com/catalog/v1/datasets';
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const channels=['invertomatic','yellow'];
const names={'cooling':'Охлаждение','ups-meridian':'ИБП Meridian','batteries':'Аккумуляторы AGM','bms':'Контроль батарей BMS','lithium-cabinets':'Литиевые батарейные шкафы','ready-racks':'Готовые стеллажи','cladded-racks':'Закрытые стеллажи','rack-components':'Компоненты стеллажей','shelf-cabinets':'Шкафы и полки'};
export async function dataset(channel,collection,fetcher=fetch,revision=null,id=null){
 const url=new URL(ENDPOINT);url.searchParams.set('channel',channel);url.searchParams.set('collection',collection);if(revision)url.searchParams.set('revision',revision);if(id)url.searchParams.set('id',id);
 const response=await fetcher(url,{headers:{Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(response.status===404?'not_found':'catalog_unavailable');
 const value=await response.json();if(value.channel!==channel||value.collection!==collection||!value.release_id||(revision&&value.release_id!==revision)||!value.data)throw Error('catalog_unavailable');return value;
}
function normalize(p,channel,revision){return{id:p.model_id,name:p.name,sku:'',aliases:[],extraSkus:[],categoryId:channel+':'+p.collection,brand:channel==='yellow'?'YELLOW':'INVERTOMATIC',archived:false,inStock:false,availabilityStatus:'not_provided',priceStatus:'missing',price:null,composite:['ups-meridian','ready-racks','cladded-racks','lithium-cabinets'].includes(p.collection),component:p.collection==='rack-components',parentId:'',modifications:[],components:[],catalogueRevision:revision,catalogueChannel:channel,catalogueCollection:p.collection,entityId:p.entity_id,technicalStatus:p.status,publicUrl:(channel==='yellow'?'https://test.yellow-battery.com':'https://invertomatic.hggyc7f9tt.chatgpt.site')+p.url};}
async function indices(fetcher){const all=await Promise.all(channels.map(async channel=>{const r=await dataset(channel,'product-index',fetcher);return{channel,revision:r.release_id,rows:Object.values(r.data).map(p=>normalize(p,channel,r.release_id))}}));return all;}
export async function catalogRoute(request,env,fetcher=fetch){
 const url=new URL(request.url),path=url.pathname.replace('/api/catalog','');if(request.method!=='GET')return json({error:'method_not_allowed'},405);
 try{
  const snapshots=await indices(fetcher),items=snapshots.flatMap(x=>x.rows),releases=Object.fromEntries(snapshots.map(x=>[x.channel,x.revision]));
  if(path==='/categories')return json({items:[...new Set(items.map(x=>x.categoryId))].map(id=>({id,name:(id.startsWith('yellow:')?'YELLOW · ':'INVERTOMATIC · ')+(names[id.split(':')[1]]||id)})),releases});
  if(path==='/products'){
   const page=Number(url.searchParams.get('page')||1),category=url.searchParams.get('category')||'',query=(url.searchParams.get('q')||'').trim().toLocaleLowerCase('ru');
   if(!Number.isSafeInteger(page)||page<1||page>10000||query.length>150||(category&&!/^[a-z-]+:[a-z-]+$/.test(category)))return json({error:'invalid_filter'},400);
   const matched=items.filter(p=>(!category||p.categoryId===category)&&(!query||(p.name+' '+p.brand).toLocaleLowerCase('ru').includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'ru',{numeric:true}));
   return json({items:matched.slice((page-1)*100,page*100),page,pages:Math.ceil(matched.length/100),total:matched.length,releases,asOf:new Date().toISOString(),mode:'read_only',source:'shared_cloud_catalogue'});
  }
  const match=path.match(/^\/products\/([0-9a-f-]{36})$/i);
  if(match){
   const product=items.find(p=>p.id===match[1]);if(!product)return json({error:'not_found'},404);
   const record=await dataset(product.catalogueChannel,product.catalogueCollection,fetcher,product.catalogueRevision,product.entityId);
   const hidden=new Set(['source_ref','source','sourceModel','sourceSheet','sourceCell','source_row','key_internal','model_id','id','url','image','drawing','pdf','sha256','geometry','bom']);
   const attributes=Object.entries(record.data).filter(([key,v])=>!hidden.has(key)&&v!==null&&['string','number','boolean'].includes(typeof v)).map(([key,v])=>({id:key,name:key,unit:'',values:[v]}));
   for(const[key,v]of Object.entries(record.data.specifications||{}))attributes.push({id:key,name:key,unit:'',values:[v]});
   return json({...product,attributes,attributeError:null,asOf:new Date().toISOString()});
  }
  return json({error:'not_found'},404);
 }catch(e){return json({error:e.message==='not_found'?'not_found':'catalog_unavailable'},e.message==='not_found'?404:502);}
}
