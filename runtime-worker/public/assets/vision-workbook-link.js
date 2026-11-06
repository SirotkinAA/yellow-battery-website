'use strict';
const VisionLinkWorkbook=typeof module!=='undefined'?require('./vision-workbook-core.js').VisionWorkbook:VisionWorkbook;
// Electrical identity is checked as well as the model name: workbook tables differ.
function visionReadSelection(workbook,row,inputs){
  const get=column=>workbook.get('Tool',column+row),model=get('C'),module=get('D'),racks=get('F'),modules=get('E'),voltage=get('H'),runtime=get('G');
  const capacity=typeof module==='string'?module.match(/([\d.]+)Ah$/i):null;
  if(typeof model!=='string'||!model||!capacity||!Number.isInteger(racks)||racks<1||!Number.isInteger(modules)||modules<1||typeof voltage!=='number'||!Number.isFinite(voltage)||typeof runtime!=='number'||!Number.isFinite(runtime))return null;
  const power=Number(inputs['Tool!H4']),load=Number(inputs['Tool!D4']),efficiency=Number(inputs['Tool!G4']),minutes=Number(inputs['Tool!L4']),aging=String(inputs['Tool!J4']),agingFactor=Number(aging.match(/\d+/)?.[0])/100;
  if(![power,load,efficiency,minutes,agingFactor].every(n=>Number.isFinite(n)&&n>0)||load>1||efficiency>1)return null;
  return {row,model,module,capacityAh:Number(capacity[1]),racks,modules,voltage:Math.round(voltage*10)/10,runtime,power,load,efficiency,minutes,aging,agingFactor,meetsTarget:runtime>=minutes*agingFactor};
}
function visionSelectionLinks(data,selection){
  if(!selection)return null;
  const s=selection,pro=/^TP\d+pro$/i.test(s.model),family=pro?'TPpro':s.model.match(/^(TPH|TPL|TPX|SPL|TP)/)?.[0];
  const heatSeries=pro?'TP2.5pro':family==='TP'?'TP'+s.capacityAh+'Ah':family==='TPL'?'TPL'+s.capacityAh+'Ah':['TPH','TPX'].includes(family)?family:null;
  const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),value=(sheet,address)=>data.cells[sheet+'!'+address]?.v;
  const reference=new VisionLinkWorkbook(data);
  const heatAvailable=heatSeries&&Array.from({length:61},(_,i)=>i+8).some(r=>Math.abs(reference.get('heat','N'+r)-s.voltage)<.001&&same(reference.get('heat','O'+r),heatSeries));
  const desiredConfig=pro?s.model.replace(/pro$/i,'Pro'):s.model;
  const configRow=Array.from({length:44},(_,i)=>i+2).find(r=>same(value('Sheet2 (2)','B'+r),desiredConfig)&&Math.abs(value('Sheet2 (2)','G'+r)-s.voltage)<.001&&value('Sheet2 (2)','H'+r)===s.capacityAh&&value('Sheet2 (2)','F'+r)===s.modules);
  const checkModel=pro?'TPpro'+s.model.match(/\d+/)[0]:s.model;
  const checkAvailable=Object.keys(data.cells).some(k=>/^Selection calculation!O\d+$/.test(k)&&same(data.cells[k].v,checkModel));
  const platform=pro?'TP 2.5 Pro':{'TP':'TP 2.5','TPL':'TPL 2.5','TPH':'TPH 2.5','TPX':'TPX 3.0'}[family];
  return {
    heat:{'heat!H4':s.power,'heat!D4':s.load,'heat!G4':s.efficiency,'heat!E4':s.voltage,'heat!C4':s.racks,'heat!J4':s.minutes,'heat!F4':heatAvailable?heatSeries:''},
    cable:{'Cable!G4':s.power,'Cable!C4':s.load,'Cable!F4':s.efficiency,'Cable!D4':s.voltage,'Cable!K4':s.racks,'Cable!I4':s.minutes,'Cable!E4':heatSeries||family},
    check:{'Selection calculation!E4':s.power,'Selection calculation!C4':s.load,'Selection calculation!D4':s.efficiency,'Selection calculation!I4':s.minutes,'Selection calculation!K6':s.racks,'Selection calculation!G4':s.aging,'Selection calculation!G6':checkAvailable?family:'','Selection calculation!H6':checkAvailable?checkModel.slice(family.length):''},
    config:{'配置确认表!B2':configRow?platform:'','配置确认表!D2':configRow?value('Sheet2 (2)','B'+configRow):'','配置确认表!F2':s.racks,'配置确认表!D3':s.agingFactor,'配置确认表!B4':s.power*s.load,'配置确认表!B5':s.minutes},
    unavailable:{heat:!heatAvailable,check:!checkAvailable,config:!configRow}
  };
}
if(typeof module!=='undefined')module.exports={visionReadSelection,visionSelectionLinks};
