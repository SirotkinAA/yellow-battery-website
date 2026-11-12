/* Shared adapters for placed geometry, cable estimates and drawing groups. */
(function(root){
'use strict';
function cabinetGeometry(cabinet,input,settings){
 const rotation=(typeof CabinetShelf!=='undefined'?CabinetShelf:require('./cabinet-shelf-core.js')).calculate(input).selected.angle;
 const boxes=cabinet.levels.flatMap(level=>level.positions.map(p=>({kind:'battery',x:p.x+input.allowance/2,y:p.y+input.allowance/2,z:level.elevation,dx:rotation?input.width:input.length,dy:rotation?input.length:input.width,dz:settings.height})));
 return {boxes,rotation};
}
function electrical(links,raw){
 if(String(raw.current).trim()==='')return null;
 const i=Number(raw.current),t=Number(raw.temperature),s=Number(raw.section),r=String(raw.r20).trim()===''?1000/(58*s):Number(raw.r20);
 if(!Number.isFinite(i)||i<=0||!Number.isFinite(t)||t< -20||t>120||!Number.isFinite(s)||s<=0||!Number.isFinite(r)||r<=0)throw Error('Проверьте ток, температуру и сопротивление кабеля');
 const groups=new Map();
 for(const link of links){const id=link.from.split('-')[0];if(!Number.isFinite(link.length_mm)||link.length_mm<=0)throw Error('Недопустимая длина');groups.set(id,(groups.get(id)||0)+link.length_mm/1000);}
 return {basis:String(raw.r20).trim()===''?'copper':'datasheet',strings:[...groups].map(([string,length_m])=>{const resistance=r*length_m/1000*(1+.00393*(t-20));return {string,length_m,resistance_ohm:resistance,drop_v:i*resistance,loss_w:i*i*resistance};})};
}
function drawingInput(group,index,model){
 if(group.end1!==group.end2)throw Error('Межбатарейные наконечники должны совпадать');
 return {section_mm2:group.section,length_m:group.length_mm/1000,series_batteries:2,parallel_strings:1,lug_left:group.end1,lug_right:group.end2,connection_type:'interbattery',drawing_scope:'layout_group',drawing_quantity:group.quantity,drawing_code:`YB.PM.${String(index+1).padStart(3,'0')}`,layout_model:model,route_length_mm:group.length_mm};
}
const api={cabinetGeometry,electrical,drawingInput};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LayoutInterconnects=api;
})(typeof window==='undefined'?globalThis:window);
