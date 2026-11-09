/* Shared geometry for the interactive view and all drawing projections. */
(function(root){
  function geometry(b,n,tiers,rows,gap,clearance,edge=40){
    for(const v of [b.l,b.w,b.h,b.mass,n,tiers,rows])if(!Number.isFinite(v)||v<=0)throw Error('Положительные размеры, масса и количество обязательны');
    if(!Number.isInteger(n)||n>200||!Number.isInteger(tiers)||!Number.isInteger(rows)||tiers*rows>n)throw Error('Количество: целое число от 1 до 200; ячейки не должны быть пустыми');
    if(!Number.isFinite(gap)||gap<0||!Number.isFinite(clearance)||clearance<0)throw Error('Зазоры не могут быть отрицательными');
    const distribution=Array.from({length:tiers*rows},(_,i)=>Math.floor(n/(tiers*rows))+(i<n%(tiers*rows)?1:0));
    const base=190,pitch=b.h+clearance+25,L=Math.max(...distribution)*b.l+(Math.max(...distribution)-1)*gap+2*edge,W=rows*b.w+(rows-1)*gap+2*edge,H=base+(tiers-1)*pitch+b.h;
    const boxes=[];
    const add=(x,y,z,dx,dy,dz,kind)=>boxes.push({x,y,z,dx,dy,dz,kind});
    for(let t=0;t<tiers;t++)for(let r=0;r<rows;r++)for(let i=0;i<distribution[t*rows+r];i++)add(edge+i*(b.l+gap),edge+r*(b.w+gap),base+t*pitch,b.l,b.w,b.h,'battery');
    return {L,W,H,boxes,distribution,tiers,rows,count:n,batteryMass:n*b.mass,pitch,base,edge,battery:b,clearance,gap,status:'CONCEPT_NOT_ENGINEERING_VALIDATED'};
  }
  function supportCheck(b,rails){
    const ys=[...new Set(rails.filter(s=>Math.abs(s.z+s.dz-b.z)<1e-6&&Math.min(s.y+s.dy,b.y+b.dy)>Math.max(s.y,b.y)).map(s=>s.y))];
    return ys.filter(y=>{
      const spans=rails.filter(s=>s.y===y&&Math.abs(s.z+s.dz-b.z)<1e-6).map(s=>[s.x,s.x+s.dx]).sort((a,b)=>a[0]-b[0]);
      let end=b.x;for(const [lo,hi] of spans){if(lo>end+1e-6)break;end=Math.max(end,hi);}return end>=b.x+b.dx-1e-6;
    }).length>=2;
  }
  function reference(r,placement=null){
    const [L,W,H]=r.dimensions_mm, levels=r.levels_mm||[190,632];
    const centers=r.frame_centers_mm||(r.frame_count===3?[30,750,L-30]:[30,L-30]);
    const boxes=[],add=(x,y,z,dx,dy,dz,part,extra={})=>boxes.push({x,y,z,dx,dy,dz,kind:'frame',part,...extra});
    for(const x of centers){
      for(const y of [20,W-20]){add(x-30,y-20,0,60,40,30,'foot');add(x-12.5,y-12.5,30,25,25,H-30,'post');}
      for(const z of levels)add(x-12.5,20,z-50,25,W-40,25,'crossmember');
    }
    // Proposed adjustable rail coordinates, not verified factory settings.
    const occupiedWidth=placement?placement.rows*placement.battery.w+(placement.rows-1)*placement.gap:430;
    const startY=(W-occupiedWidth)/2;
    const railYs=[];
    const railCount=r.rail_count||3;
    if(placement){
      railYs.push(startY+Math.min(12.5,placement.battery.w/4));
      for(let row=1;row<placement.rows;row++)railYs.push(startY+row*placement.battery.w+(row-.5)*placement.gap);
      railYs.push(startY+occupiedWidth-Math.min(12.5,placement.battery.w/4));
    }else for(let j=0;j<railCount;j++)railYs.push(35+j*(W-70)/(railCount-1));
    while(railYs.length<railCount){railYs.sort((a,b)=>a-b);let largest=0;for(let j=1;j<railYs.length-1;j++)if(railYs[j+1]-railYs[j]>railYs[largest+1]-railYs[largest])largest=j;railYs.push((railYs[largest]+railYs[largest+1])/2);}
    railYs.sort((a,b)=>a-b);
    for(let i=0;i<centers.length-1;i++)for(const z of levels)for(let j=0;j<railYs.length;j++)
      add(centers[i],railYs[j]-12.5,z-25,centers[i+1]-centers[i],25,25,'rail',{profile:j===0||j===railYs.length-1?'H':'C'});
    const brace=(x1,z1,x2,z2)=>{const dx=x2-x1,dz=z2-z1;add(x1,W-28,z1,Math.hypot(dx,dz),8,15,'brace',{angle:Math.atan2(dz,dx)});};
    const top=levels[levels.length-1]-50;
    if(centers.length===2){const lo=levels.length>2?levels[1]:levels[0],hi=levels.length>2?levels[levels.length-2]:top;brace(centers[0],lo,centers[1],hi);brace(centers[0],hi,centers[1],lo);}
    else {const mid=(L/2);brace(centers[0],levels[0],mid,top);brace(mid,top,centers[centers.length-1],levels[0]);}
    const warnings=[];
    if(placement){
      const dx=Math.max(0,(L-placement.L)/2),dy=Math.max(0,(W-placement.W)/2);
      const structure=boxes.slice();
      for(const b of placement.boxes.filter(b=>b.kind==='battery')){
        const tier=Math.round((b.z-placement.base)/placement.pitch);
        const z=tier<levels.length?levels[tier]:levels[levels.length-1]+(tier-levels.length+1)*placement.pitch;
        boxes.push({...b,x:b.x+dx,y:b.y+dy,z});
      }
      if(placement.L>L||placement.W>W)warnings.push('Компоновка выходит за план выбранного стеллажа.');
      if(placement.tiers>levels.length)warnings.push('Третий или дополнительный ярус без опор: число ярусов превышает число уровней стеллажа.');
      if(placement.rows>(r.rows||2))warnings.push('Число рядов превышает число опорных дорожек.');
      if(placement.tiers>1&&placement.battery.h+placement.clearance>442-50)warnings.push('Между ярусами недостаточно места для заданной высоты батареи и зазора.');
      const overlap=(a,b)=>a.x<b.x+b.dx&&a.x+a.dx>b.x&&a.y<b.y+b.dy&&a.y+a.dy>b.y&&a.z<b.z+b.dz&&a.z+a.dz>b.z;
      if(boxes.filter(b=>b.kind==='battery').some(b=>structure.some(s=>s.angle===undefined&&overlap(b,s))))warnings.push('Батареи пересекаются с элементами рамы.');
    }
    const unsupported=boxes.filter(b=>b.kind==='battery'&&!supportCheck(b,boxes.filter(s=>s.part==='rail'))).length;
    if(unsupported)warnings.push(`${unsupported} батарей не имеют двух линий опоры по всей длине основания.`);
    return {railYs,unsupported,rotation:placement?.rotation||0,proposedRails:!!placement,L:Math.max(L,...boxes.filter(b=>b.angle===undefined).map(b=>b.x+b.dx)),W:Math.max(W,...boxes.map(b=>b.y+b.dy)),H:Math.max(H,...boxes.filter(b=>b.angle===undefined).map(b=>b.z+b.dz)),boxes,reference:r,centers,levels,warnings,count:placement?.count||0,battery:placement?.battery,status:'REFERENCE_SCHEMATIC'};
  }
  function project(p,view,yaw=.65){
    const [x,y,z]=p;
    if(view==='front')return [x,-z,y];if(view==='side')return [y,-z,-x];if(view==='top')return [x,y,z];
    const a=view==='iso'?Math.PI/4:yaw,c=Math.cos(a),s=Math.sin(a),e=view==='iso'?Math.atan(1/Math.sqrt(2)):.45;
    return [c*x-s*y,Math.sin(e)*(s*x+c*y)-Math.cos(e)*z,Math.cos(e)*(s*x+c*y)+Math.sin(e)*z];
  }
  function detailed(g){
    const parts=[];
    const piece=(b,x,y,z,dx,dy,dz,shade)=>parts.push({...b,x,y,z,dx,dy,dz,shade});
    for(const b of g.boxes){
      if(b.part==='rail'){
        piece(b,b.x,b.y,b.z+b.dz-2,b.dx,b.dy,2,'steel-top');
        piece(b,b.x,b.y,b.z,b.dx,2,b.dz,'steel');
        piece(b,b.x,b.y+b.dy-2,b.z,b.dx,2,b.dz,'steel');
        if(b.profile==='H'&&!b.omitLip)piece(b,b.x,b.y<g.W/2?b.y-2:b.y+b.dy,b.z+b.dz,b.dx,2,12,'lip');
      }else if(b.part==='post'){
        piece(b,b.x,b.y,b.z,2,b.dy,b.dz,'steel');piece(b,b.x+b.dx-2,b.y,b.z,2,b.dy,b.dz,'steel');
        piece(b,b.x+2,b.y,b.z,b.dx-4,2,b.dz,'steel');piece(b,b.x+2,b.y+b.dy-2,b.z,b.dx-4,2,b.dz,'steel');
        piece(b,b.x,b.y,b.z+b.dz, b.dx,b.dy,2,'cap');
      }else if(b.part==='crossmember'){
        piece(b,b.x,b.y,b.z,b.dx, b.dy,2,'steel');piece(b,b.x,b.y,b.z,2,b.dy,b.dz,'steel');piece(b,b.x+b.dx-2,b.y,b.z,2,b.dy,b.dz,'steel');
      }else parts.push({...b,shade:b.part==='cladding'?'cladding':b.part==='foot'?'rubber':b.kind==='battery'?'battery':'steel'});
    }
    if(g.reference&&!g.cladded){
      // Illustrative plates and fasteners: exact hardware sizes/counts are not a BOM.
      for(const x of g.centers)for(const z of g.levels)for(const y of g.railYs){
        parts.push({x:x-18,y:y-18,z:z-28,dx:36,dy:36,dz:3,kind:'frame',shade:'plate'});
        for(const oy of [-9,9])parts.push({x:x-5,y:y+oy-5,z:z-34,dx:10,dy:10,dz:6,kind:'frame',shape:'hex',shade:'bolt'});
      }
      for(const x of g.centers)for(const y of [20,g.W-20])for(const z of g.levels)parts.push({x:x-5,y:y-18,z:z-42,dx:10,dy:6,dz:10,kind:'frame',shade:'bolt'});
    }
    return parts;
  }
  function faces(g,view,yaw){
    const renderBoxes=detailed(g).flatMap(b=>{
      if(b.part==='cladding'){
        const axes=['x','y','z'].sort((a,c)=>b['d'+c]-b['d'+a]),[a,c]=axes,na=Math.ceil(b['d'+a]/50),nc=Math.ceil(b['d'+c]/50);
        return Array.from({length:na*nc},(_,i)=>({...b,[a]:b[a]+Math.floor(i/nc)*b['d'+a]/na,[c]:b[c]+(i%nc)*b['d'+c]/nc,['d'+a]:b['d'+a]/na,['d'+c]:b['d'+c]/nc}));
      }
      if(b.angle!==undefined){const n=Math.ceil(b.dx/25);return Array.from({length:n},(_,i)=>({...b,x:b.x+i*b.dx/n*Math.cos(b.angle),z:b.z+i*b.dx/n*Math.sin(b.angle),dx:b.dx/n}));}
      if(b.kind==='battery'||b.shape)return [b];
      const axis=['x','y','z'].sort((a,c)=>b['d'+c]-b['d'+a])[0],size='d'+axis,parts=Math.min(240,Math.ceil(b[size]/20));
      return Array.from({length:parts},(_,i)=>({...b,[axis]:b[axis]+b[size]*i/parts,[size]:b[size]/parts}));
    });
    const out=[];for(const b of renderBoxes){
      if(b.shape==='hex'){
        const v=[0,1].flatMap(k=>Array.from({length:6},(_,i)=>project([b.x+b.dx/2+Math.cos(i*Math.PI/3)*b.dx/2,b.y+b.dy/2+Math.sin(i*Math.PI/3)*b.dy/2,b.z+k*b.dz],view,yaw)));
        const idsList=[[0,1,2,3,4,5],[6,7,8,9,10,11],...Array.from({length:6},(_,i)=>[i,(i+1)%6,(i+1)%6+6,i+6])];
        for(const ids of idsList){const pts=ids.map(i=>v[i]);out.push({pts,depth:pts.reduce((s,p)=>s+p[2],0)/pts.length,kind:b.kind,shade:b.shade});}continue;
      }
      const v=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(([x,y,z])=>project([b.x+x*b.dx*Math.cos(b.angle||0)-z*b.dz*Math.sin(b.angle||0),b.y+y*b.dy,b.z+x*b.dx*Math.sin(b.angle||0)+z*b.dz*Math.cos(b.angle||0)],view,yaw));
      for(const ids of [[0,1,2,3],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]){const pts=ids.map(i=>v[i]);out.push({pts,depth:pts.reduce((s,p)=>s+p[2],0)/4,kind:b.kind,shade:b.part==='cladding'?(ids[0]===4?'cladding-top':ids[0]===1||ids[0]===3?'cladding-side':'cladding'):b.shade});}}
    return out.sort((a,b)=>a.depth-b.depth);
  }
  root.RackLayout={geometry,reference,supportCheck,project,faces,detailed};if(typeof module!=='undefined')module.exports=root.RackLayout;
})(typeof window==='undefined'?globalThis:window);
