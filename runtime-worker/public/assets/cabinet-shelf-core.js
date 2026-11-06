/* Pure geometry and payload calculation; nominal, uniform-orientation grids. */
(function(root) {
  'use strict';
  const models={"9690.020": {"article": "9690.020", "width": 600, "height": 2000, "depth": 600, "mass": 48, "shelfArticle": "9692.020", "shelfWidth": 509, "shelfDepth": 514, "shelfMass": 7, "shelfLimit": 200, "source": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136611?variantId=9690020", "shelfSource": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136615?variantId=9692020", "checkedAt": "2026-10-07", "mountingVerified": false}, "9690.021": {"article": "9690.021", "width": 600, "height": 2000, "depth": 800, "mass": 51, "shelfArticle": "9692.021", "shelfWidth": 509, "shelfDepth": 714, "shelfMass": 9.1, "shelfLimit": 200, "source": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136611?variantId=9690021", "shelfSource": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136615?variantId=9692021", "checkedAt": "2026-10-07", "mountingVerified": false}, "9690.023": {"article": "9690.023", "width": 800, "height": 2000, "depth": 800, "mass": 67, "shelfArticle": "9692.023", "shelfWidth": 709, "shelfDepth": 714, "shelfMass": 12, "shelfLimit": 200, "source": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136611?variantId=9690023", "shelfSource": "https://www.rittal.com/com-en/products/PG20231215POW101/PG20240930STR301/PRO136615?variantId=9692023", "checkedAt": "2026-10-07", "mountingVerified": false}};
  function modelFor(input){ const m=models[input.modelId || "9690.020"]; if(!m) throw new Error("Неизвестная модель шкафа Rittal."); return m; }
  function calculate(input) {
    const {length, width, mass, count, gap, edge, allowance=0, orientation='auto'} = input;
    for (const [name, value] of Object.entries({length,width,mass,count,gap,edge,allowance})) {
      if (!Number.isFinite(value) || (['gap','edge','allowance'].includes(name) ? value < 0 : value <= 0)) throw new Error('Заполните поля допустимыми положительными числами; зазоры и прибавка могут быть нулевыми.');
    }
    if (!Number.isSafeInteger(count)) throw new Error('Количество АКБ должно быть целым числом.');
    if (!['auto','0','90'].includes(String(orientation))) throw new Error('Неизвестная ориентация.');
    const model=modelFor(input), sw=model.shelfWidth, sd=model.shelfDepth, limit=model.shelfLimit;
    const nx=(d,span)=>Math.max(0,Math.floor((span-2*edge+gap)/(d+gap)));
    const variants=[0,90].map(angle=>{
      const bw=(angle?width:length)+allowance, bd=(angle?length:width)+allowance;
      const columns=nx(bw,sw), rows=nx(bd,sd);
      const geometry=columns*rows, byMass=Math.floor(limit/mass);
      const capacity=Math.min(geometry,byMass), placed=Math.min(count,capacity);
      const positions=[];
      if (placed > 10000 || !Number.isSafeInteger(geometry)) throw new Error('Слишком мелкая сетка для визуализации. Проверьте размеры АКБ.');
      const usedRows=placed?Math.ceil(placed/columns):0;
      const y0=(sd-(usedRows*bd+Math.max(0,usedRows-1)*gap))/2;
      for(let row=0, n=0;row<usedRows;row++) {
        const inRow=Math.min(columns,placed-n), x0=(sw-(inRow*bw+(inRow-1)*gap))/2;
        for(let col=0;col<inRow;col++,n++) positions.push({x:x0+col*(bw+gap),y:y0+row*(bd+gap),w:bw,d:bd,index:n+1});
      }
      return {angle,columns,rows,geometry,byMass,capacity,placed,remaining:count-placed,load:placed*mass,positions};
    });
    const selected=orientation==='auto'?variants.reduce((a,b)=>b.capacity>a.capacity?b:a):variants.find(v=>String(v.angle)===String(orientation));
    return {model,width:sw,depth:sd,limit,variants,selected};
  }
  function calculateCabinet(input, settings) {
    const model=modelFor(input), shelf=calculate(input).selected;
    const {height,clearance,first,ceiling,thickness,extraMass,loadLimit=null}=settings;
    for(const [key,value] of Object.entries({height,clearance,first,ceiling,thickness,extraMass})) {
      if(!Number.isFinite(value) || (['clearance','extraMass'].includes(key)?value<0:value<=0)) throw new Error('Проверьте высоты, зазоры и массу комплектации шкафа.');
    }
    if(first<thickness || ceiling>2000 || first>=ceiling || thickness>2000) throw new Error('Опорная плоскость должна быть выше толщины полки и ниже верхней границы; границы — в пределах 2000 мм.');
    if(loadLimit!==null && (!Number.isFinite(loadLimit)||loadLimit<=0)) throw new Error('Лимит нагрузки должен быть положительным или оставлен пустым.');
    // 25 mm is the frame pitch. The first support plane is a user assumption,
    // not a confirmed mounting hole; thickness includes an assumed fastener envelope.
    const {switchPosition='none',switchHeight=0,cableReserve=0,switchMass=0}=settings;
    if(!['none','top','bottom'].includes(switchPosition)) throw new Error('Неизвестное положение отсека.');
    for(const value of (switchPosition==='none'?[]:[switchHeight,cableReserve,switchMass])) if(!Number.isFinite(value)||value<0) throw new Error('Размеры и масса отсека не могут быть отрицательными.');
    const enabled=switchPosition!=='none', reserve=enabled?switchHeight+cableReserve:0;
    if(enabled && switchHeight<=0) throw new Error('Укажите положительную высоту отсека коммутации.');
    if(reserve>ceiling-first+thickness) throw new Error('Отсек с кабельным резервом превышает доступную высоту шкафа.');
    const batteryFirst=first+(switchPosition==='bottom'?Math.ceil(reserve/25)*25:0);
    const batteryCeiling=ceiling-(switchPosition==='top'?reserve:0);
    const switchZone=enabled?{bottom:switchPosition==='top'?ceiling-reserve:first-thickness,height:reserve,equipmentHeight:switchHeight,cableReserve}:null;
    const step=Math.ceil((height+clearance+thickness)/25)*25;
    const maxLevels=Math.max(0,Math.floor((batteryCeiling-batteryFirst-height-clearance)/step)+1);
    const required=shelf.capacity?Math.ceil(input.count/shelf.capacity):null;
    const used=required===null?0:Math.min(required,maxLevels);
    const levels=[];
    for(let i=0,remaining=input.count;i<used;i++) {
      const count=Math.min(remaining,shelf.capacity);
      const layout=calculate({...input,count,orientation:String(shelf.angle)}).selected;
      levels.push({number:i+1,elevation:batteryFirst+i*step,count,load:count*input.mass,positions:layout.positions});
      remaining-=count;
    }
    const placed=levels.reduce((n,l)=>n+l.count,0), batteryMass=placed*input.mass, shelfMass=used*model.shelfMass;
    const equipmentMass=enabled?switchMass:0;
    const contentsMass=batteryMass+shelfMass+extraMass+equipmentMass;
    return {model,levels,step,maxLevels,required,placed,switchZone,equipmentMass,batteryFirst,batteryCeiling,remaining:input.count-placed,
      capacity:maxLevels*shelf.capacity,batteryMass,shelfMass,contentsMass,totalMass:model.mass+contentsMass,
      loadStatus:loadLimit===null?'unknown':contentsMass>loadLimit?'exceeded':'within-user-limit',loadLimit,
      validated:false};
  }
  function calculateFleet(input,settings) {
    const prototype=calculateCabinet(input,settings);
    if(!prototype.capacity) return {cabinets:[],placed:0,remaining:input.count,totalMass:0,totalShelves:0,capacityPerCabinet:0,validated:false};
    const needed=Math.ceil(input.count/prototype.capacity);
    if(needed>100) throw new Error('Для этой компоновки требуется более 100 шкафов. Уменьшите количество АКБ для просмотра.');
    const cabinets=[];
    for(let remaining=input.count;remaining>0;) {
      const count=Math.min(remaining,prototype.capacity);
      cabinets.push(calculateCabinet({...input,count},settings));remaining-=count;
    }
    return {cabinets,placed:input.count,remaining:0,capacityPerCabinet:prototype.capacity,
      totalMass:cabinets.reduce((sum,c)=>sum+c.totalMass,0),totalShelves:cabinets.reduce((sum,c)=>sum+c.levels.length,0),validated:false};
  }
  if(typeof module!=='undefined'  && module.exports) module.exports={models,calculate,calculateCabinet,calculateFleet};
  else root.CabinetShelf={models,calculate,calculateCabinet,calculateFleet};
})(typeof globalThis!=='undefined'?globalThis:this);
