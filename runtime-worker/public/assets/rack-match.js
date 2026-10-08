/* Catalogue comparison is a dimensional screen, never an engineering approval. */
(function(root){
  function compare(g, references){
    return references.map(r=>({reference:r,
      lengthMargin:r.dimensions_mm[0]-g.L,
      widthMargin:r.dimensions_mm[1]-g.W,
      envelopeWithin:g.L<=r.dimensions_mm[0]&&g.W<=r.dimensions_mm[1],
      status:'REQUIRES_VERIFICATION'
    })).sort((a,b)=>Number(b.envelopeWithin)-Number(a.envelopeWithin)||a.reference.dimensions_mm[0]-b.reference.dimensions_mm[0]);
  }
  function closedCompare(g, references){
    return references.filter(r=>r.complete&&Number((r.name.match(/^([45])E-/)||[])[1])>=g.tiers&&g.L<=Number(r.dimensions[0])&&g.W<=Number(r.dimensions[1])&&g.H+g.clearance<=Number(r.dimensions[2]))
      .sort((a,b)=>Number(a.dimensions[0])*Number(a.dimensions[1])-Number(b.dimensions[0])*Number(b.dimensions[1])||Number(a.dimensions[2])-Number(b.dimensions[2])||a.article.localeCompare(b.article));
  }
  function compact(references){
    const groups=new Map();
    const dimensions=r=>(r.dimensions_mm||r.dimensions).map(Number);
    const score=r=>{const [l,w,h]=dimensions(r);return [l*w,h,l,r.article];};
    const order=(a,b)=>{const x=score(a),y=score(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]||String(x[3]).localeCompare(String(y[3]));};
    for(const r of references){
      // Keep structural and load variants separate; only collapse catalogue lengths.
      const family=r.name?r.name.replace(/-\d+(?= |$)/g,'-SIZE'):(r.family||'2E-PGL2')+':'+r.load_case;
      const old=groups.get(family);if(!old||order(r,old)<0)groups.set(family,r);
    }
    return [...groups.values()].sort(order);
  }
  function openCandidates(g,references){
    return compact(references.filter(r=>g.tiers===Math.min((r.levels_mm||[190,632]).length,g.count)&&g.rows<=(r.rows||2)&&g.L<=r.dimensions_mm[0]&&g.W<=r.dimensions_mm[1]&&!root.RackLayout.reference(r,g).warnings.length));
  }
  root.RackMatch={compare,closedCompare,compact,openCandidates};if(typeof module!=='undefined')module.exports=root.RackMatch;
})(typeof window==='undefined'?globalThis:window);
