/* Render the cabinet scenario independently from the one-shelf result. */
(() => {
  'use strict';
  const $=id=>document.getElementById('cabinet-'+id);
  if(!$('form')) return;
  const fmt=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});
  let lastInput=null, lastResult=null;
  function clear(message){
    lastResult=null; $('error').textContent=message; $('error').hidden=false;
    for(const id of ['result','front','top','levels','bom','level','fleet','selected']) $(id).replaceChildren();
  }
  function drawTop(){
    if(!lastResult) return;
    const level=lastResult.levels[Number($('level').value)];
    if(!level){$('top').textContent='Нет размещённых полок.';return;}
    const m=lastResult.model;
    $('top').innerHTML=`<svg viewBox="-15 -30 ${m.shelfWidth+30} ${m.shelfDepth+60}" role="img" aria-label="Полка ${level.number}: ${level.count} АКБ, вид сверху"><text x="${m.shelfWidth/2}" y="-10" text-anchor="middle" font-size="17">${m.shelfWidth} × ${m.shelfDepth} мм</text><rect width="${m.shelfWidth}" height="${m.shelfDepth}" fill="#f0f2f0" stroke="#6f786d"/>${level.positions.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.d}" fill="#f5ce39" stroke="#303830" stroke-width="2"/>`).join('')}</svg><p class="shelf-small">Полка ${level.number} · ${level.count} АКБ · ${fmt(level.load)} кг</p>`;
  }
  function render(input){
    lastInput=input;
    if(!input){clear('Сначала исправьте параметры АКБ в форме выше.');return;}
    try {
      const settings={};
      for(const id of ['switchHeight','cableReserve','switchMass']) $(id).disabled=$('switchPosition').value==='none';
      for(const id of ['height','clearance','first','ceiling','thickness','extraMass','loadLimit','switchHeight','cableReserve','switchMass']){
        const raw=$(id).value.trim();settings[id]=raw===''?(id==='loadLimit'?null:NaN):Number(raw);
      }
      settings.switchPosition=$('switchPosition').value;
      const m=CabinetShelf.models[input.modelId || '9690.020'];
      $('model-heading').textContent=`RITTAL ${m.article} / ${m.width} × ${m.height} × ${m.depth} мм`;
      const fleet=CabinetShelf.calculateFleet(input,settings);
      if(!fleet.cabinets.length){clear(`Ни одна АКБ не помещается при этих параметрах. Не размещено: ${input.count}. Измените габариты, зазоры или резерв под коммутацию.`);return;}
      const previous=Number($('selected').value)||0;
      $('selected').replaceChildren();
      fleet.cabinets.forEach((c,i)=>$('selected').add(new Option(`Шкаф ${i+1} · ${c.placed} АКБ`,String(i))));
      const index=Math.min(previous,fleet.cabinets.length-1);$('selected').value=String(index);
      const r=fleet.cabinets[index];
      const overloaded=fleet.cabinets.filter(c=>c.loadStatus==='exceeded').length;
      $('fleet').innerHTML=`<h3>Все шкафы · предварительный подбор</h3><div class="shelf-stats"><div><strong>${fleet.cabinets.length}</strong><span>одинаковых корпусов</span></div><div><strong>${fleet.placed} / ${input.count}</strong><span>АКБ распределено</span></div><div><strong>${fmt(fleet.totalMass)} кг</strong><span>масса всех шкафов с комплектацией</span></div></div><p>${fleet.totalShelves} полок всего · до ${fleet.capacityPerCabinet} АКБ на шкаф по геометрии и нагрузке полок.</p><p class="shelf-status incomplete">${overloaded?`В ${overloaded} шкафах превышен введённый лимит массы. Увеличение числа шкафов по нагрузке рамы автоматически не выполняется.`:settings.loadLimit===null?'Нагрузка рам не проверена.':'Введённый лимит содержимого соблюдён во всех шкафах; это не подтверждение Rittal.'}</p><table><caption>Распределение по шкафам</caption><thead><tr><th>Шкаф</th><th>АКБ</th><th>Полки</th><th>Масса, кг</th></tr></thead><tbody>${fleet.cabinets.map((c,i)=>`<tr><td>${i+1}</td><td>${c.placed}</td><td>${c.levels.length}</td><td>${fmt(c.totalMass)}</td></tr>`).join('')}</tbody></table><p class="shelf-small">Коммутационный резерв и прочая комплектация повторяются в каждом шкафу. Число шкафов рассчитано по геометрии и нагрузке отдельных полок.</p>`;
      lastResult=r;$('error').hidden=true;
      const loadText=r.loadStatus==='unknown'?'Общая нагрузка рамы не проверена: подтверждённый лимит не задан.':r.loadStatus==='exceeded'?`Превышен введённый лимит содержимого: ${fmt(r.contentsMass)} > ${fmt(r.loadLimit)} кг.`:`Масса содержимого ${fmt(r.contentsMass)} кг в пределах введённого лимита ${fmt(r.loadLimit)} кг. Это пользовательское ограничение.`;
      $('result').innerHTML=`<div class="shelf-stats"><div><strong>${r.placed}</strong><span>АКБ в выбранном шкафу</span></div><div><strong>${r.levels.length} / ${r.maxLevels}</strong><span>полок занято / уровней по высоте</span></div><div><strong>${fmt(r.totalMass)} кг</strong><span>корпус + размещённая комплектация</span></div></div><p class="shelf-status ${r.remaining?'incomplete':''}">${r.remaining?`Не размещено ${r.remaining} АКБ.`:'Батареи выбранного шкафа размещены по геометрии и нагрузке каждой полки.'} Нужно полок: ${r.required===null?'невозможно — АКБ не помещается на полку':r.required}. Шаг опорных плоскостей: ${fmt(r.step)} мм.</p><p class="shelf-status incomplete">${loadText} Компоновка предварительная; монтаж не подтверждён.</p>`;
      const sy=z=>2000-z;
      const reserve=r.switchZone?`<rect x="25" y="${sy(r.switchZone.bottom+r.switchZone.height)}" width="${m.width-50}" height="${r.switchZone.height}" fill="#d8e8f5" stroke="#47799d" stroke-width="4" stroke-dasharray="12 8"/><text x="${m.width+40}" y="${sy(r.switchZone.bottom+r.switchZone.height/2)}" font-size="30">Резерв ${fmt(r.switchZone.height)} мм</text>`:'';
      const front=r.levels.map(l=>{
        const columns=[...new Map(l.positions.map(p=>[`${p.x}:${p.w}`,p])).values()];
        return `<g><rect x="45.5" y="${sy(l.elevation)}" width="${m.shelfWidth}" height="${settings.thickness}" fill="#667365"/>${columns.map(p=>`<rect x="${45.5+p.x}" y="${sy(l.elevation+settings.height)}" width="${p.w}" height="${settings.height}" fill="#f5ce39" stroke="#394738" stroke-width="3"/>`).join('')}<text x="${m.width+45}" y="${sy(l.elevation)+6}" font-size="32">${l.number} · ${l.count} шт.</text></g>`;
      }).join('');
      $('front').innerHTML=`<svg viewBox="-90 -100 ${m.width+460} 2180" role="img" aria-label="Шкаф, вид спереди: ${r.levels.length} полок и ${r.placed} АКБ"><text x="${m.width/2}" y="-42" text-anchor="middle" font-size="38">${m.width} мм</text><text x="-42" y="1000" transform="rotate(-90 -42 1000)" text-anchor="middle" font-size="38">2000 мм</text><rect width="${m.width}" height="2000" fill="#f2f4ef" stroke="#5d6b5b" stroke-width="12"/><rect x="24" y="24" width="${m.width-48}" height="1952" fill="none" stroke="#c4ccc0" stroke-width="4"/><path d="M 0 ${sy(settings.ceiling)} H ${m.width}" stroke="#b56d26" stroke-width="5" stroke-dasharray="12 9"/>${reserve}${front}<text x="${m.width/2}" y="2070" text-anchor="middle" font-size="34">Вид спереди · эскиз</text></svg>`;
      const selected=$('level').value;
      $('level').replaceChildren();
      r.levels.forEach((l,i)=>$('level').add(new Option(`Полка ${l.number} · ${l.count} АКБ`,String(i))));
      if(selected!=='' && r.levels[Number(selected)]) $('level').value=selected;
      drawTop();
      $('levels').innerHTML=`<table><caption>Размещение снизу вверх</caption><thead><tr><th>Полка</th><th>Отметка, мм</th><th>АКБ</th><th>Масса АКБ, кг</th></tr></thead><tbody>${r.levels.map(l=>`<tr><td>${l.number}</td><td>${fmt(l.elevation)}</td><td>${l.count}</td><td>${fmt(l.load)}</td></tr>`).join('')}</tbody></table>`;
      // Model names are user/catalogue text, assigned via textContent below.
      $('bom').innerHTML=`<h3>Ведомость выбранного шкафа</h3><table><thead><tr><th>Компонент</th><th>Шт.</th><th>Масса, кг</th></tr></thead><tbody><tr><td>Корпус Rittal ${m.article}</td><td>1</td><td>${fmt(m.mass)}</td></tr><tr><td>Полка ${m.shelfArticle} с комплектным крепежом</td><td>${r.levels.length}</td><td>${fmt(r.shelfMass)}</td></tr><tr><td id="cabinet-battery-name"></td><td>${r.placed}</td><td>${fmt(r.batteryMass)}</td></tr><tr><td>Коммутация с креплением (введённая масса)</td><td>${r.switchZone?1:0}</td><td>${fmt(r.equipmentMass)}</td></tr><tr><td>Прочая комплектация (введённая масса)</td><td>—</td><td>${fmt(settings.extraMass)}</td></tr></tbody></table><p class="shelf-small">Ведомость для размещённых ${r.placed} АКБ. Боковые панели, основание, цоколь, кабели, защита и вентиляция ещё не подобраны. Массу коммутации с креплением задайте в её разделе, остальных элементов — в поле «Прочая комплектация». Не учитывайте одни и те же компоненты дважды. Это не спецификация для заказа.</p>`;
      const model=document.getElementById('shelf-model');
      $('battery-name').textContent=model.value==='manual'?'AGM по введённым параметрам':model.selectedOptions[0].textContent;
    }catch(e){clear(e.message);}
  }
  $('form').addEventListener('submit',e=>e.preventDefault());
  $('form').addEventListener('input',()=>render(lastInput));
  $('level').addEventListener('change',drawTop);
  $('selected').addEventListener('change',()=>render(lastInput));
  window.CabinetLayout={render,setHeight(value){$('height').value=value;}};
})();
