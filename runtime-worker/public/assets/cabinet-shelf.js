(() => {
  'use strict';
  const app=document.querySelector('[data-shelf-models]');
  if(!app) return;
  const models=JSON.parse(app.dataset.shelfModels), $=id=>document.getElementById('shelf-'+id);
  const selector=$('model');
  Object.values(CabinetShelf.models).forEach(m=>$('enclosure').add(new Option(`${m.article} · ${m.width} × ${m.height} × ${m.depth} мм`,m.article)));
  models.forEach((m,i)=>selector.add(new Option(`${m.id} · ${m.capacity} А·ч`,String(i))));
  selector.add(new Option('Свои параметры AGM','manual'));
  const fmt=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});
  function setModel(){
    if(selector.value==='manual') {$('source').textContent='Укажите габариты основания и массу одной AGM-батареи.'; return;}
    const m=models[Number(selector.value)], dims=m.overall_dimensions.split('×').map(Number);
    CabinetLayout.setHeight(dims[2]);
    $('length').value=dims[0]; $('width').value=dims[1]; $('mass').value=Number(m.weight.match(/^[\d.]+/)[0]);
    $('source').textContent=`${m.id}: ${m.dimensions}. Масса: ${m.weight}.`;
  }
  function render(){
    try {
      const data={};
      for(const key of ['length','width','mass','count','gap','edge','allowance']) data[key]=$ (key).value.trim()===''?NaN:Number($(key).value);
      data.modelId=$('enclosure').value;
      data.orientation=$('orientation').value;
      const r=CabinetShelf.calculate(data), s=r.selected;
      const m=r.model;
      $('article').textContent=m.shelfArticle;
      $('spec').textContent=`Полезная площадь ${r.width} × ${r.depth} мм · статическая нагрузка до ${r.limit} кг`;
      $('enclosure-source').innerHTML=`Корпус ${m.mass} кг · полка ${m.shelfMass} кг. <a href="${m.source}" target="_blank" rel="noopener">Паспорт шкафа ↗</a> · <a href="${m.shelfSource}" target="_blank" rel="noopener">Полка ↗</a>`;
      CabinetLayout.render(data);
      $('error').hidden=true;
      $('result').innerHTML=`<div class="shelf-stats"><div><strong>${s.placed} / ${data.count}</strong><span>АКБ размещено</span></div><div><strong>${fmt(s.load)} / 200</strong><span>кг нагрузки</span></div><div><strong>${s.capacity}</strong><span>АКБ максимум в этой сетке</span></div></div><p class="shelf-status ${s.remaining?'incomplete':''}">${s.remaining?`Не помещается: ${s.remaining} шт.`:'Все выбранные батареи помещаются по размерам и массе.'} Ориентация ${s.angle}°.</p>`;
      const rects=s.positions.map(p=>`<g><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" rx="3" fill="#f5ce39" stroke="#252b2b" stroke-width="1.4"/><text x="${p.x+p.w/2}" y="${p.y+p.d/2}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(18,p.w/3,p.d/3)}">${p.index}</text></g>`).join('');
      $('drawing').innerHTML=`<svg viewBox="-45 -38 ${r.width+90} ${r.depth+86}" role="img" aria-label="Вид сверху: ${s.placed} АКБ, полка ${r.width} на ${r.depth} мм"><text x="${r.width/2}" y="-15" text-anchor="middle" font-size="15">${r.width} мм</text><text x="-23" y="${r.depth/2}" transform="rotate(-90 -23 ${r.depth/2})" text-anchor="middle" font-size="15">${r.depth} мм</text><rect width="${r.width}" height="${r.depth}" fill="#f0f2f0" stroke="#727975" stroke-width="2"/>${rects}<text x="${r.width/2}" y="${r.depth+31}" text-anchor="middle" font-size="14">Передняя сторона полки</text></svg>`;
      $('comparison').innerHTML=`<table><caption>Сравнение ориентаций</caption><thead><tr><th>Поворот</th><th>По размерам</th><th>По массе</th><th>Вместимость</th></tr></thead><tbody>${r.variants.map(v=>`<tr class="${v.angle===s.angle?'selected':''}"><th>${v.angle}°</th><td>${v.geometry} (${v.columns} × ${v.rows})</td><td>${v.byMass}</td><td>${v.capacity} шт.</td></tr>`).join('')}</tbody></table><p class="shelf-small">По массе — число АКБ до 200 кг без учёта геометрии. Прибавка к габаритам включена в прямоугольники на схеме.</p>`;
    } catch(e) {
      CabinetLayout.render(null);
      $('error').hidden=false; $('error').textContent=e.message;
      for(const key of ['result','drawing','comparison']) $(key).replaceChildren();
    }
  }
  $('form').addEventListener('submit',e=>e.preventDefault());
  selector.addEventListener('change',()=>{setModel();render();});
  $('form').addEventListener('input',e=>{
    if(['shelf-length','shelf-width','shelf-mass'].includes(e.target.id)) {selector.value='manual';$('source').textContent='Свои параметры AGM — проверьте размеры и массу по листовке.';}
    if(e.target!==selector) render();
  });
  setModel(); render();
})();
