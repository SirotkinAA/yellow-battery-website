/* Assembly schematic: BOM topology and drawing tier levels; no load approval. */
(function(root){
 function model(r,p){
  const m=r.geometry;if(!m)throw Error('Нет данных конструкции для этого артикула');
  if(p&&m.automaticPlacement===false)throw Error('Для этой схемы требуется отдельное подтверждение ориентации батарей или размеров ступеней.');
  const [L,W,H]=r.dimensions.map(Number),levels=m.levels,centers=[30];let position=0;
  m.spans.forEach((span,i)=>{position+=span;centers.push(i===m.spans.length-1?L-30:position);});
  const boxes=[],add=(x,y,z,dx,dy,dz,part,extra={})=>boxes.push({x,y,z,dx,dy,dz,part,kind:'frame',...extra});
  const side=(W-m.frameWidth)/2,postYs=[side+12.5,W-side-12.5];
  for(const x of centers){
   for(const y of postYs){add(x-25,y-25,0,50,50,30,'foot');add(x-12.5,y-12.5,30,25,25,Math.min(m.frameHeight-15,H-30),'post');}
   if(m.layoutKind==='stepped'){
    const width=(postYs[1]-postYs[0])/m.rows;
    for(const z of levels)for(let row=0;row<m.rows;row++){
     const y=postYs[0]+row*width,top=z+(m.rows-1-row)*m.stepRise;
     add(x-12.5,y,top-50,25,width,25,'crossmember');
     if(row<m.rows-1)add(x-12.5,y+width-12.5,top-m.stepRise-50,25,25,m.stepRise,'step-riser');
    }
    add(x-12.5,postYs[0],H-75,25,postYs[1]-postYs[0],25,'crossmember');
   }else for(const z of [...levels,H-25])add(x-12.5,postYs[0],z-50,25,postYs[1]-postYs[0],25,'crossmember');
  }
  // Adjustable rail coordinates are a proposal, not verified factory settings.
  const occupied=p?(m.railMode==='independent'?m.rows:p.rows)*p.battery.w+((m.railMode==='independent'?m.rows:p.rows)-1)*p.gap:W-140;
  const startY=(W-occupied)/2,railYs=[],profiles=[];
  if(m.railMode==='independent'){
   const width=p?p.battery.w:(occupied-(m.rows-1)*10)/m.rows,gap=p?p.gap:10;
   for(let i=0;i<m.rows;i++){railYs.push(startY+i*(width+gap)+10,startY+i*(width+gap)+width-10);profiles.push('H','H');}
  }else{
   railYs.push(startY+10);
   if(p)for(let i=1;i<p.rows;i++)railYs.push(startY+i*p.battery.w+(i-.5)*p.gap);
   railYs.push(startY+occupied-10);
   while(railYs.length<m.hRails+m.cRails){railYs.sort((a,b)=>a-b);let i=0;for(let j=1;j<railYs.length-1;j++)if(railYs[j+1]-railYs[j]>railYs[i+1]-railYs[i])i=j;railYs.push((railYs[i]+railYs[i+1])/2);}
   railYs.sort((a,b)=>a-b);
   for(let i=0;i<railYs.length;i++)profiles.push(i===0||(m.hRails===2&&i===railYs.length-1)?'H':'C');
  }
  for(let i=0;i<centers.length-1;i++)for(const z of levels)for(let j=0;j<railYs.length;j++)add(centers[i],railYs[j]-15,z-25+(m.layoutKind==='stepped'?(m.rows-1-Math.floor(j/2))*m.stepRise:0),centers[i+1]-centers[i],30,25,'rail',{profile:profiles[j],omitLip:true});
  // Braces are illustrative: attachment coordinates are not exposed by the BOM.
  for(let i=0;i<centers.length-1;i++)for(const reverse of [false,true]){
   const z1=reverse?levels[levels.length-1]-50:levels[0],z2=reverse?levels[0]:levels[levels.length-1]-50,dx=centers[i+1]-centers[i],dz=z2-z1;
   add(centers[i],W-side,z1,Math.hypot(dx,dz),8,12,'brace',{angle:Math.atan2(dz,dx)});
  }
  // Panel groups use BOM counts, with schematic segmentation within the envelope.
  for(const family of ['CFP','CSP','CTP','CEK']){
   const entries=m.bom.filter(b=>b.article.startsWith(family));let offset=0;
   if(family==='CFP'||family==='CTP'){
    const factor=family==='CFP'?2:1,total=entries.reduce((sum,b)=>sum+b.dimensions[family==='CFP'?1:0]*b.quantity/factor,0);
    for(const b of entries)for(let n=0;n<Math.round(b.quantity/factor);n++){
     const width=L*b.dimensions[family==='CFP'?1:0]/total;
     if(family==='CFP')for(const y of [0,W-15])add(offset+2,y,75,width-4,15,H-100,'cladding',{article:b.article});
     else add(offset+2,0,H-15,width-4,W,15,'cladding',{article:b.article});
     offset+=width;
    }
   }else if(family==='CSP'){
    let index=0;for(const b of entries)for(let n=0;n<b.quantity;n++,index++)add(index===0?0:L-15,15,75,15,W-30,H-100,'cladding',{article:b.article});
   }else{let index=0;for(const b of entries)for(let n=0;n<b.quantity;n++,index++)add(centers[1+Math.floor(index/2)]-15,index%2?W-15:0,75,30,15,H-100,'cladding',{article:b.article});}
  }
  const warnings=[];
  if(m.layoutKind==='stepped')warnings.push('Высота ступени 140 мм принята условно по изображению: размер на чертеже не указан. Автоподбор батарей отключён.');
  if(m.layoutKind==='horizontal')warnings.push('Серия для горизонтальной установки. Ориентация и допустимость установки выбранной батареи на бок не подтверждены; автоподбор отключён.');
if(m.panelLayoutWarning)warnings.push('Суммарная длина верхних панелей в BOM расходится с длиной шкафа: раскладка облицовки условная.');
  if(m.unplacedRails?.length)warnings.push('В BOM есть дополнительные C-профили; их положение не указано и на схеме не показано.');
  const notices=warnings.slice();
  if(p){
   const dx=(L-p.L)/2;
   for(const b of p.boxes.filter(b=>b.kind==='battery')){const tier=Math.round((b.z-p.base)/p.pitch);boxes.push({...b,x:b.x+dx,y:startY+b.y-p.edge,z:levels[tier]??H});}
   if(p.tiers>m.tiers)warnings.push('Число ярусов превышает число опорных уровней.');
   if(occupied>W-100)warnings.push('Недостаточная внутренняя ширина для опорных дорожек.');
   if(p.rows>m.rows)warnings.push('Число рядов превышает число опорных дорожек.');
   if(p.battery.h+p.clearance>Math.min(...levels.slice(1).map((z,i)=>z-levels[i]-50)))warnings.push('Недостаточно места между уровнями для батареи и зазора.');
   if(levels[p.tiers-1]+p.battery.h+p.clearance>H-50)warnings.push('Недостаточный зазор под верхней рамой.');
   const overlap=(a,b)=>a.x<b.x+b.dx&&a.x+a.dx>b.x&&a.y<b.y+b.dy&&a.y+a.dy>b.y&&a.z<b.z+b.dz&&a.z+a.dz>b.z;
   const structure=boxes.filter(b=>b.kind==='frame'&&b.angle===undefined);
   if(boxes.filter(b=>b.kind==='battery').some(b=>structure.some(s=>overlap(b,s))))warnings.push('Батареи пересекаются с рамой или облицовкой.');
  }
  const rails=boxes.filter(b=>b.part==='rail'),unsupported=boxes.filter(b=>b.kind==='battery'&&!root.RackLayout.supportCheck(b,rails)).length;
  if(unsupported)warnings.push(`${unsupported} батарей без двух непрерывных линий опоры.`);
  return {L,W,H,boxes,reference:r,cladded:true,centers,postYs,levels,railYs,warnings,notices,conflicts:warnings.slice(notices.length),unsupported,count:p?.count||0,battery:p?.battery,rotation:p?.rotation||0,batteryMass:p?.batteryMass||0,tiers:p?.tiers||m.tiers,rows:p?.rows||m.rows,distribution:p?.distribution||[],status:'CLADDED_ASSEMBLY_SCHEMATIC'};
 }
 function candidates(p,references){
  const standard=[],conditional=[];
  for(const r of root.RackMatch.closedCompare(p,references)){
   if(!r.geometry||r.geometry.automaticPlacement===false||p.rows>r.geometry.rows)continue;
   // Automatic recommendations use available levels before increasing rack size.
   if(p.tiers!==Math.min(r.geometry.tiers,p.count))continue;
   const g=model(r,p);
   if(g.conflicts.length)continue;
   (g.notices.length?conditional:standard).push(r);
  }
  return {standard,conditional};
 }
 root.RackCladdedLayout={model,candidates};if(typeof module!=='undefined')module.exports=root.RackCladdedLayout;
})(typeof window==='undefined'?globalThis:window);
