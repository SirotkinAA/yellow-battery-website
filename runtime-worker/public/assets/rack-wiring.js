/* Geometry-based preliminary routing. Pure module shared by the browser and tests. */
(function(root){
'use strict';
const finite=(n,label,min=0)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min)throw Error(label);return n;};
const int=(n,label)=>{finite(n,label,1);if(!Number.isInteger(n))throw Error(label);return n;};
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function terminals(box,local,rotation,flip){
 return ['minus','plus'].map(key=>{let [x,y]=local[key];const L=local.length,W=local.width;
  if(flip){x=L-x;y=W-y;}
  if(rotation===90)[x,y]=[W-y,x];
  return [box.x+x,box.y+y,box.z+box.dz];
 });
}
function route(a,b,boxes,clearance){
 const top=Math.max(a[2],b[2])+clearance;
 if(Math.abs(a[2]-b[2])<.01)return [a,[a[0],a[1],top],[b[0],b[1],top],b];
 // Inter-level transitions go outside the whole battery footprint, not through batteries.
 const low=Math.min(...boxes.map(v=>v.y))-clearance,high=Math.max(...boxes.map(v=>v.y+v.dy))+clearance;
 const viaY=Math.abs(a[1]-low)+Math.abs(b[1]-low)<=Math.abs(a[1]-high)+Math.abs(b[1]-high)?low:high;
 return [a,[a[0],a[1],a[2]+clearance],[a[0],viaY,a[2]+clearance],
  [b[0],viaY,b[2]+clearance],[b[0],b[1],b[2]+clearance],b];
}
const length=points=>points.slice(1).reduce((n,p,i)=>n+distance(points[i],p),0);
function candidates(boxes){
 const result=[boxes.map((_,i)=>i)];
 for(const axis of ['x','y'])for(const reverseLevels of [false,true])for(const reverseRows of [false,true]){
  const levels=[...new Set(boxes.map(b=>b.z))].sort((a,b)=>reverseLevels?b-a:a-b),seq=[];
  let rowIndex=0;
  for(const z of levels){const cross=axis==='x'?'y':'x',rows=[...new Set(boxes.filter(b=>b.z===z).map(b=>b[cross]))].sort((a,b)=>reverseRows?b-a:a-b);
   for(const row of rows){const ids=boxes.map((b,i)=>i).filter(i=>boxes[i].z===z&&boxes[i][cross]===row).sort((a,b)=>boxes[a][axis]-boxes[b][axis]);if(rowIndex++%2)ids.reverse();seq.push(...ids);}}
  result.push(seq,seq.slice().reverse());
 }
 return result;
}
function optimize(boxes,local,options){
 if(!boxes.length||boxes.length>200)throw Error('Нужно от 1 до 200 батарей');
 const ns=int(options.series,'Укажите целое число АКБ в линейке'),np=int(options.strings,'Укажите число линеек');
 if(ns*np!==boxes.length)throw Error('АКБ в линейке × число линеек должно совпадать с количеством на стеллаже');
 if(![0,90].includes(options.rotation))throw Error('Поддержан только поворот 0°/90°');
 for(const b of boxes)for(const k of ['x','y','z','dx','dy','dz'])finite(b[k],'Неверная геометрия');
 finite(local.length,'Длина АКБ',1);finite(local.width,'Ширина АКБ',1);
 for(const key of ['minus','plus']){if(!Array.isArray(local[key])||local[key].length!==2)throw Error('Задайте координаты клемм');local[key].forEach(v=>finite(v,'Координаты клемм'));if(local[key][0]>local.length||local[key][1]>local.width)throw Error('Клеммы находятся за габаритами батареи');}
 if(distance(local.minus,local.plus)<1)throw Error('Клеммы не могут совпадать');
 finite(options.clearance,'Запас трассы над клеммами',1);finite(options.allowance,'Монтажный запас');finite(options.rounding,'Шаг округления',1);
 const ts=boxes.map(b=>[terminals(b,local,options.rotation,false),terminals(b,local,options.rotation,true)]);
 const edge=(a,fa,b,fb)=>{const points=route(ts[a][fa][1],ts[b][fb][0],boxes,options.clearance);return {points,route_mm:length(points),allowance_mm:options.allowance,length_mm:Math.ceil((length(points)+options.allowance)/options.rounding)*options.rounding};};
 function evaluate(order,allowFlip){
  const assignments=[],links=[];let total=0;
  for(let s=0;s<np;s++){
   const ids=order.slice(s*ns,(s+1)*ns),states=allowFlip?[0,1]:[0],cost=[[0,0]],prev=[];
   for(let i=1;i<ids.length;i++){cost[i]=[Infinity,Infinity];prev[i]=[];for(const f of states)for(const p of states){const c=cost[i-1][p]+edge(ids[i-1],p,ids[i],f).length_mm;if(c<cost[i][f]){cost[i][f]=c;prev[i][f]=p;}}}
   let f=allowFlip&&cost[ids.length-1][1]<cost[ids.length-1][0]?1:0,flips=[];
   for(let i=ids.length-1;i>=0;i--){flips[i]=f;if(i)f=prev[i][f];}
   for(let i=0;i<ids.length;i++){
    const id=`S${s+1}-B${i+1}`,box=ids[i];assignments.push({id,string:s+1,sequence:i+1,box,flip:!!flips[i],terminals:ts[box][flips[i]]});
    if(i){const e=edge(ids[i-1],flips[i-1],box,flips[i]);links.push({id:`S${s+1}-J${i}`,from:`S${s+1}-B${i}:+`,to:id+':−',...e});total+=e.length_mm;}
   }
  }
  return {assignments,links,total_mm:total};
 }
 const baseline=evaluate(boxes.map((_,i)=>i),false);let best=baseline;
 const orders=candidates(boxes);
 for(const order of orders){const c=evaluate(order,options.allowFlip);if(c.total_mm<best.total_mm)best=c;}
 return {...best,baseline_mm:baseline.total_mm,candidates:orders.length,status:'PRELIMINARY',scope:'internal_links_only'};
}
function materials(rows,heatshrinkPerEndMm){
 finite(heatshrinkPerEndMm,'Термоусадка на конец');
 const wire=new Map(),lugs=new Map();let pieces=0,total=0;
 for(const row of rows){int(row.quantity,'Количество кабелей');finite(row.length_mm,'Длина кабеля',1);finite(row.section,'Сечение',.1);if(!row.end1||!row.end2)throw Error('Задайте оба наконечника');
  const metres=row.quantity*row.length_mm/1000;pieces+=row.quantity;total+=metres;wire.set(row.section,(wire.get(row.section)||0)+metres);
  for(const end of [row.end1,row.end2])lugs.set(end,(lugs.get(end)||0)+row.quantity);
 }
 return {pieces,total_m:Number(total.toFixed(6)),wire:[...wire].map(([section,metres])=>({section,metres:Number(metres.toFixed(6))})),lugs:[...lugs].map(([article,quantity])=>({article,quantity})),heatshrink_m:pieces*2*heatshrinkPerEndMm/1000,ends:pieces*2};
}
const api={terminals,route,optimize,materials};if(typeof module!=='undefined')module.exports=api;else root.RackWiring=api;
})(typeof window==='undefined'?globalThis:window);
