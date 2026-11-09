/* Deterministic, preliminary single-controller selection. Verified limits are supplied by the page. */
(function(root){
 'use strict';
 function calculate(input,rules){
  const blocks=Number(input.blocks),strings=Number(input.strings),voltage=Number(input.voltage);
  if(!Number.isInteger(blocks)||blocks<1||blocks>120||!Number.isInteger(strings)||strings<1||strings>64||!Number.isFinite(voltage)||voltage<=0||voltage>24)return {ok:false,reason:'input',candidates:[]};
  if(input.chemistry==='other')return {ok:false,reason:'chemistry',candidates:[]};
  if(input.application==='telecom'&&![24,48].some(v=>Math.abs(v-blocks*voltage)<.1))return {ok:false,reason:'telecom',candidates:[]};
  const candidates=[],rejected=[];
  for(const rule of rules){
   const reasons=[];
   if(!rule.chemistries.includes(input.chemistry))reasons.push('chemistry');
   if(!rule.voltages.some(v=>Math.abs(v-voltage)<.01))reasons.push('voltage');
   if(input.chemistry==='nicd'&&Math.abs(voltage-1.2)>.01)reasons.push('voltage');
   if(input.chemistry==='vrla'&&Math.abs(voltage-1.2)<.01)reasons.push('voltage');
   if(rule.id==='BMS9000Pro'&&input.chemistry==='vrla'&&![2,12].includes(voltage))reasons.push('voltage');
   const perString=rule.id==='BMS2000'&&strings>1?60:rule.maxPerString;
   if(strings>rule.maxStrings||blocks>perString||blocks*strings>rule.maxTotal)reasons.push('capacity');
   const stringVoltage=blocks*voltage;
   if(stringVoltage>rule.maxStringVoltage||(rule.id==='BMS9000Pro'&&stringVoltage<20))reasons.push('stringVoltage');
   if(rule.id==='BMS2000'&&![24,48].some(v=>Math.abs(v-stringVoltage)<.1))reasons.push('telecom');
   const normalized=rule.protocols.replace(/\s/g,'');
   if(input.protocol!=='any'&&!(input.protocol==='Modbus TCP'?normalized.includes('TCP'):normalized.includes(input.protocol.replace(/\s/g,''))))reasons.push('protocol');
   if(reasons.length){rejected.push({id:rule.id,reasons:[...new Set(reasons)]});continue;}
   const preference=input.application==='telecom'?['BMS2000','BAT-Gate','BMS9000','BMS9000Pro']:input.application==='power'?['BMS9000Pro','BMS9000','BAT-Gate','BMS2000']:['BAT-Gate','BMS9000','BMS9000Pro','BMS2000'];
   const module=rule.id==='BAT-Gate'?'BAT600Pro':['BMS9000','BMS9000Pro'].includes(rule.id)?'BMS-CM2':null;
   const bom=[{kind:'controller',name:rule.id,count:1},{kind:'sensor',name:rule.sensor,count:blocks*strings},{kind:'current',name:'Hall',count:strings}];
   if(module)bom.push({kind:'module',name:module,count:strings});
   if(input.hmi)bom.push({kind:'hmi',name:'HMI',count:1});
   candidates.push({...rule,bom,stringVoltage,batteries:blocks*strings,score:preference.indexOf(rule.id)});
  }
  candidates.sort((a,b)=>a.score-b.score);
  const requested=input.model&&input.model!=='auto'?candidates.find(c=>c.id===input.model):candidates[0];
  if(!requested)return {ok:false,reason:input.model&&input.model!=='auto'?'selected':'limits',candidates,rejected};
  return {ok:true,selected:requested,candidates,rejected};
 }
 const api={calculate};root.YellowBmsSizing=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
