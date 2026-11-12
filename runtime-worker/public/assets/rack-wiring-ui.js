(()=>{
'use strict';
const $=id=>document.getElementById(id),host=$('rack-wiring');if(!host)return;
let current=null,svg='',schedule=[],bom=null,revision=0;
const lugCatalog=JSON.parse($('layout-lug-catalog').textContent);
function fillLugs(){const select=$('wire-lug'),old=select.value;select.replaceChildren(new Option('Выберите наконечник ДКС',''));for(const lug of lugCatalog.items.filter(l=>l.section_mm2===num('wire-section')))select.add(new Option(`${lug.article} · M${lug.bolt_metric_mm}`,lug.article));if([...select.options].some(o=>o.value===old))select.value=old;else if(select.options.length===2)select.selectedIndex=1;}
$('wire-section').addEventListener('input',fillLugs);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=id=>Number($(id).value),fmt=n=>Number(n.toFixed(3)).toLocaleString('ru-RU');
const download=(name,type,text)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
fillLugs();
function clear(message){revision++;svg='';schedule=[];bom=null;$('wiring-result').replaceChildren();$('wiring-message').textContent=message;$('wiring-svg').disabled=true;$('wiring-csv').disabled=true;}
function defaults(detail){
 const changed=!current||current.model!==detail.model||current.length!==detail.length||current.width!==detail.width;
 current=detail;
 $('wiring-layout-context').textContent=(detail.scope||'Выбранный стеллаж')+' · '+detail.model+' · '+detail.geometry.boxes.filter(b=>b.kind==='battery').length+' АКБ. Изменение размещения сбрасывает ведомость.';
 if(changed){
  // Illustrative positions only; the leaflet does not dimension the terminal centres.
  const L=detail.length,W=detail.width;
  $('terminal-mx').value=(L*.1).toFixed(1);$('terminal-my').value=(W*.2).toFixed(1);
  $('terminal-px').value=(L*.9).toFixed(1);$('terminal-py').value=(W*.2).toFixed(1);
  $('terminal-confirmed').checked=false;
  $('terminal-note').textContent=detail.model==='HRL 12-100M'?'100M: на листовке клеммы расположены у одного длинного края. Начальные координаты и полярность здесь условные: сверьте их с батареей или размерным чертежом.':'Начальные координаты и полярность условные. Введите привязку клемм выбранной модели по чертежу или измерениям.';
 }
 clear('Компоновка выбрана. Укажите электрическую схему, проверьте клеммы и рассчитайте соединения.');
}
document.addEventListener('rack-layout-updated',e=>defaults(e.detail));
document.addEventListener('rack-layout-cleared',()=>{current=null;clear('Пересчитайте размещение батарей.');});
for(const event of ['input','change'])$('wiring-form').addEventListener(event,()=>clear('Параметры изменены. Пересчитайте соединения.'));
const params=new URLSearchParams(location.search);
if(params.has('series'))$('wiring-series').value=params.get('series');
if(params.has('current_a'))$('wire-current').value=params.get('current_a');
if(params.has('strings'))$('wiring-strings').value=params.get('strings');
function drawing(result,boxes){
 const levels=[...new Set(boxes.map(b=>b.z))].sort((a,b)=>a-b),width=1100,panelH=350;
 let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${100+panelH*levels.length}" width="${width}" height="${100+panelH*levels.length}"><rect width="100%" height="100%" fill="white"/><g font-family="Arial" font-size="13"><text x="20" y="25" font-size="20">${esc(current.model)} — предварительная схема соединений</text><text x="20" y="50">Виды сверху по ярусам. Красный: +, синий: −. Повороты только вокруг вертикальной оси.</text><text x="20" y="72">${$('terminal-confirmed').checked?'Привязка клемм подтверждена пользователем.':'Координаты и полярность клемм условные.'} Трассы и зазоры конструкции требуют проверки.</text>`;
 levels.forEach((z,level)=>{
  const ids=boxes.map((b,i)=>i).filter(i=>boxes[i].z===z),minX=Math.min(...ids.map(i=>boxes[i].x)),minY=Math.min(...ids.map(i=>boxes[i].y)),maxX=Math.max(...ids.map(i=>boxes[i].x+boxes[i].dx)),maxY=Math.max(...ids.map(i=>boxes[i].y+boxes[i].dy));
  const scale=Math.min(580/(maxX-minX),235/(maxY-minY)),oy=100+level*panelH;
  const xy=p=>[60+(p[0]-minX)*scale,oy+50+(p[1]-minY)*scale];
  out+=`<text x="20" y="${oy+20}">Ярус ${level+1} · основание АКБ Z=${fmt(z)} мм</text>`;
  for(const a of result.assignments.filter(a=>ids.includes(a.box))){const b=boxes[a.box],[x,y]=xy([b.x,b.y]);out+=`<rect x="${x}" y="${y}" width="${b.dx*scale}" height="${b.dy*scale}" fill="#fff3b0" stroke="#637069"/><text x="${x+b.dx*scale/2}" y="${y+b.dy*scale/2}" text-anchor="middle" font-size="11">${a.id}${a.flip?' ↻180°':''}</text>`;}
  for(const link of result.links){const a=result.assignments.find(a=>link.from===a.id+':+'),b=result.assignments.find(a=>link.to===a.id+':−');
   if(ids.includes(a.box)&&ids.includes(b.box)){out+=`<polyline points="${link.points.map(p=>xy(p).join(',')).join(' ')}" fill="none" stroke="#733595" stroke-width="2"/>`;}
   else for(const [node,p,label] of [[a,a.terminals[1],link.to],[b,b.terminals[0],link.from]])if(ids.includes(node.box)){const [x,y]=xy(p);out+=`<path d="M${x} ${y}v-18" stroke="#733595" stroke-dasharray="3 2"/>`;}
  }
  for(const a of result.assignments.filter(a=>ids.includes(a.box)))a.terminals.forEach((p,i)=>{const [x,y]=xy(p);out+=`<circle cx="${x}" cy="${y}" r="6" fill="${i?'#bd301f':'#2366a0'}"/><text x="${x}" y="${y+3}" text-anchor="middle" fill="white" font-size="10">${i?'+':'−'}</text>`;});
  const levelLinks=result.links.filter(l=>result.assignments.some(a=>ids.includes(a.box)&&l.from===a.id+':+'));
  levelLinks.slice(0,10).forEach((l,i)=>{out+=`<text x="670" y="${oy+48+i*23}" font-size="11">${esc(l.id)}: ${esc(l.from)} → ${esc(l.to)} · ${fmt(l.length_mm/10)} см</text>`;});
  if(levelLinks.length>10)out+=`<text x="670" y="${oy+280}">Все соединения — в выгрузке CSV.</text>`;
  const outputLabels=[];
  for(const a of result.assignments.filter(a=>ids.includes(a.box))){
   const outputs=[];if(a.sequence===1)outputs.push([0,'−']);if(a.sequence===num('wiring-series'))outputs.push([1,'+']);if($('wiring-topology').value==='midpoint'&&a.sequence===num('wiring-series')/2)outputs.push([1,'M']);
   for(const [t,label] of outputs){const [x,y]=xy(a.terminals[t]);out+=`<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#dd7200" stroke-width="2"/>`;outputLabels.push(`Вывод ${label}: ${a.id} (оранжевое кольцо)`);}
  }
  outputLabels.slice(0,3).forEach((label,i)=>{out+=`<text x="670" y="${oy+280+i*15}" font-size="11" fill="#9a4900">${esc(label)}</text>`;});
  out+=`<text x="20" y="${oy+330}">Межъярусные соединения обозначены адресами батарей; их длина включает выход за контур АКБ.</text>`;
 });
 return out+'</g></svg>';
}
$('wiring-form').addEventListener('submit',e=>{e.preventDefault();clear('');try{
 if(!current)throw Error('Сначала рассчитайте размещение батарей');
 if(!$('terminal-confirmed').checked)throw Error('Уточните координаты и полярность клемм по чертежу или измерению и подтвердите их. Начальные координаты условные.');
 const boxes=current.geometry.boxes.filter(b=>b.kind==='battery'),ns=num('wiring-series'),np=num('wiring-strings'),topology=$('wiring-topology').value;
 if(!topology)throw Error('Выберите подключение: два вывода или средняя точка');
 if(topology==='midpoint'&&(!Number.isInteger(ns/2)))throw Error('Для средней точки нужно чётное число батарей в линейке');
 const result=RackWiring.optimize(boxes,{length:current.length,width:current.width,minus:[num('terminal-mx'),num('terminal-my')],plus:[num('terminal-px'),num('terminal-py')]},{series:ns,strings:np,rotation:current.geometry.rotation||0,clearance:num('wire-rise'),allowance:num('wire-allowance'),rounding:num('wire-round'),allowFlip:$('wire-flip').checked});
 const section=num('wire-section'),lug=lugCatalog.items.find(l=>l.article===$('wire-lug').value&&l.section_mm2===section);
 if(!lug)throw Error('Выберите наконечник ДКС для указанного сечения');
 schedule=result.links.map(l=>({id:l.id,from:l.from,to:l.to,route_mm:l.route_mm,length_mm:l.length_mm,quantity:1,section,end1:lug.article,end2:lug.article,mark:''}));
 const missing=np*(topology==='midpoint'?3:2);
 const electrical=LayoutInterconnects.electrical(result.links,{current:$('wire-current').value,temperature:$('wire-temp').value,r20:$('wire-r20').value,section});
 bom=RackWiring.materials(schedule,num('wire-shrink'));
 svg=drawing(result,boxes);
 const groups=new Map();for(const row of schedule){const key=JSON.stringify([row.length_mm,row.section,row.end1,row.end2,row.mark]);if(!groups.has(key))groups.set(key,{...row,quantity:0});groups.get(key).quantity++;}
 const endpoints=Array.from({length:np},(_,i)=>`S${i+1}: − от B1:−; + от B${ns}:+${topology==='midpoint'?`; средняя точка от узла B${ns/2}:+ / B${ns/2+1}:− (дополнительный наконечник на клемме требует проверки)`:''}`).join('. ');
 $('wiring-message').textContent=`Предварительно: ${result.links.length} перемычек, ${fmt(result.total_mm/1000)} м между АКБ. Исходный порядок: ${fmt(result.baseline_mm/1000)} м. Сокращение: ${fmt((result.baseline_mm-result.total_mm)/1000)} м. Сравнено ${result.candidates} порядков обхода; глобальный минимум не гарантируется. Внешние кабели в оптимизации не участвуют.`;
 $('wiring-result').innerHTML=`<p>${esc(endpoints)}</p><p>${missing?`Не заданы длины ${missing} внешних кабелей — они не включены в материалы.`:'Внешние кабели включены по введённым длинам.'} ${$('terminal-confirmed').checked?'':'Координаты и полярность клемм НЕ подтверждены. '}Трассы обходят батареи по высоте; пересечения с рамой, радиусы изгиба и доступ к клеммам ещё не проверяются. Спецификация предварительная, не для изготовления.</p><div class="rack-table">${svg}</div><h4>Ведомость кабелей</h4><div class="rack-table"><table><thead><tr><th>Длина, см</th><th>Количество</th><th>Сечение, мм²</th><th>Наконечник 1</th><th>Наконечник 2</th><th>Назначение</th></tr></thead><tbody>${[...groups.values()].map(r=>`<tr><td>${fmt(r.length_mm/10)}</td><td>${r.quantity}</td><td>${r.section}</td><td>${esc(r.end1)}</td><td>${esc(r.end2)}</td><td>${esc(r.mark||'Между АКБ')}</td></tr>`).join('')}</tbody></table></div><h4>Электрические потери по трассам</h4>${electrical?'<p>Предварительная оценка по длинам с запасом; без контактов. '+(electrical.basis==='copper'?'Удельное сопротивление меди.':'Введённое сопротивление кабеля.')+'</p><ul>'+electrical.strings.map(r=>`<li>Линейка ${r.string}: ${fmt(r.length_m)} м · ΔU ${fmt(r.drop_v)} В · ${fmt(r.loss_w)} Вт</li>`).join('')+'</ul>':'<p>Укажите ток линейки для расчёта потерь.</p>'}<h4>Материалы</h4><ul>${bom.wire.map(r=>`<li>ПуГВ 1×${r.section}: ${fmt(r.metres)} м</li>`).join('')}${bom.lugs.map(r=>`<li>${esc(r.article)}: ${r.quantity} шт.</li>`).join('')}<li>Термоусадка: ${fmt(bom.heatshrink_m)} м (${num('wire-shrink')} мм на конец); диаметр подбирается по кабелю.</li></ul><p>Провод: ${bom.pieces} отрезков, ${bom.ends} концов. Сечение и наконечники заданы пользователем; защита, резьба клемм и допустимый ток здесь не подбираются.</p>`;
 const exports=document.createElement('div');exports.innerHTML='<h4>Чертежи исполнений по ведомости</h4><p>Предварительные эскизы. L — длина трассы с запасом; длина отрезка провода и технология оконцевания требуют уточнения.</p>';
 [...groups.values()].forEach((group,index)=>{const row=document.createElement('p');row.append(document.createTextNode(`ПМ-${index+1}: ${group.length_mm} мм × ${group.quantity} шт. · ${group.end1} `));for(const format of ['pdf','dwg','dxf']){const button=document.createElement('button');button.type='button';button.className='button outline';button.textContent=format.toUpperCase();button.onclick=async()=>{const version=revision;button.disabled=true;try{const response=await fetch('/interconnects/api/drawing/'+format,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(LayoutInterconnects.drawingInput(group,index,current.model))});if(!response.ok){const error=await response.json();throw Error(error.error);}const blob=await response.blob();if(version!==revision)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`YB.PM.${index+1}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){if(version===revision)$('wiring-message').textContent=error.message;}finally{button.disabled=false;}};row.append(button);}exports.append(row);});$('wiring-result').append(exports);
 $('wiring-svg').disabled=false;$('wiring-csv').disabled=false;
 }catch(err){clear(err.message);}});
$('wiring-svg').onclick=()=>download('battery-connections-preliminary.svg','image/svg+xml',svg);
$('wiring-csv').onclick=()=>{
 const rows=[['ПРЕДВАРИТЕЛЬНАЯ СПЕЦИФИКАЦИЯ — НЕ ДЛЯ ИЗГОТОВЛЕНИЯ'],[current.model],[$('wiring-message').textContent],[$('terminal-confirmed').checked?'Привязка клемм подтверждена пользователем':'Координаты и полярность клемм условные'],['Внешние кабели включены только при заданной длине. Сечение и наконечники заданы вручную.'],['Кабель','От','До','Длина, см','Количество','Сечение, мм2','Наконечник 1','Наконечник 2','Назначение'],...schedule.map(r=>[r.id,r.from,r.to,String(r.length_mm/10).replace('.',','),r.quantity,r.section,r.end1,r.end2,r.mark]),[],['Материалы','Количество','Ед.'],...bom.wire.map(r=>['ПуГВ 1х'+r.section,String(r.metres).replace('.',','),'м']),...bom.lugs.map(r=>[r.article,r.quantity,'шт']),['Термоусадка (диаметр уточнить)',String(bom.heatshrink_m).replace('.',','),'м']];
 const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 download('jumper-materials-preliminary.csv','text/csv;charset=utf-8','\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n'));
};
})();
