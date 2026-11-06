'use strict';
(async()=>{
const root=document.getElementById('workbook-calculator');if(!root)return;
let en=document.documentElement.lang.startsWith('en');const t=(ru,enText)=>en?enText:ru;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>visionIsError(x)?t('Нет результата: ','No result: ')+x.code:typeof x==='number'?new Intl.NumberFormat(en?'en':'ru',{maximumFractionDigits:3}).format(x):esc(typeof x==='string'?x.replace(/\bVision\b/gi,'YELLOW'):x);
try{
const catalogueRelease=document.querySelector('meta[name="catalogue-release"]')?.content;
const data=await fetch('/assets/vision/workbook-v2-5.json'+(catalogueRelease?'?catalog_release='+encodeURIComponent(catalogueRelease):''),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(r.status);return r.json();});
let selection=null;
function mount(){
en=document.documentElement.lang.startsWith('en');
const saved=Object.fromEntries([...root.querySelectorAll('input,select')].map(x=>[x.name,x.value])),active=root.querySelector('[data-tab][aria-pressed=true]')?.dataset.tab;
const volts=[204.8,256,307.2,358.4,409.6,460.8,512,563.2,614.4,665.6,716.8];
const field=(cell,label,value,options,min=0.001,max=100000)=>({cell,label,value,options,min,max});
const common=(sheet,power,series)=>[
field(sheet+'!'+power,t('Активная мощность, кВт','Active power, kW'),200),
field(sheet+'!'+series,t('Серия','Series'),'TP',['TP','TPL','TPH'])];
const sizing=[...common('Tool','H4','F4'),field('Tool!E4',t('Напряжение, В','Voltage, V'),512,volts),field('Tool!L4',t('Автономия, мин','Runtime, min'),10),field('Tool!G4',t('КПД (0–1)','Efficiency (0–1)'),.95,null,.001,1),field('Tool!J4',t('Старение','Aging'),'EOL125%',['BOL100%','EOL120%','EOL125%','EOL140%'])];
const heat=[field('heat!H4',t('Мощность, кВт','Power, kW'),1440),field('heat!F4',t('Серия','Series'),'TP50Ah',['TP50Ah','TP100Ah','TPL100Ah','TPL200Ah','TPH']),field('heat!E4',t('Напряжение, В','Voltage, V'),512,volts),field('heat!C4',t('Шкафы','Cabinets'),5,null,1,15),field('heat!G4',t('КПД','Efficiency'),.95,null,.001,1),field('heat!J4',t('Разряд, мин','Discharge, min'),8),field('heat!L4',t('Заряд, мин (от 60)','Charge, min (60+)'),600,null,60)];
const cable=[field('Cable!I4',t('Время разряда, мин','Discharge time, min'),10),field('Cable!G4',t('Мощность, кВт','Power, kW'),1000),field('Cable!D4',t('Напряжение, В','Voltage, V'),563.2,volts),field('Cable!K4',t('Шкафы','Cabinets'),4,null,1,15),field('Cable!F4',t('КПД','Efficiency'),.95,null,.001,1),field('Cable!E59',t('Длина для экспериментальной оценки, м','Length for experimental estimate, m'),40)];
const modelKeys=Object.keys(data.cells).filter(k=>/^Selection calculation!O\d+$/.test(k)).map(k=>data.cells[k].v).filter(v=>typeof v==='string'&&/^(TP|TPL|TPH)\d+A?$/.test(v));
const check=[field('Selection calculation!G6',t('Серия','Series'),'TP',['TP','TPH','TPL']),field('Selection calculation!H6',t('Обозначение модели без серии','Model suffix without series'),'200',[...new Set(modelKeys.map(v=>v.replace(/^(TPpro|TPH|TPL|TPX|TP)/,'')))]),field('Selection calculation!E4',t('Мощность, кВт','Power, kW'),200),field('Selection calculation!I4',t('Время, мин','Time, min'),8),field('Selection calculation!K6',t('Шкафы','Cabinets'),1,null,1,15),field('Selection calculation!D4',t('КПД','Efficiency'),.95,null,.001,1),field('Selection calculation!G4',t('Старение','Aging'),'BOL100%',['BOL100%','EOL120%','EOL125%','EOL140%'])];
const configModels=Object.keys(data.cells).filter(k=>/^Sheet2 \(2\)!B\d+$/.test(k)).map(k=>data.cells[k].v).filter(v=>typeof v==='string'&&/^(TP|TPL|TPH)\d+A?$/.test(v));
const config=[field('配置确认表!B2',t('Платформа','Platform'),'TP 2.5',['TP 2.5','TPL 2.5','TPH 2.5']),field('配置确认表!D2',t('Модель','Model'),'TP240',configModels),field('配置确认表!F2',t('Шкафы','Cabinets'),2,null,1,15),field('配置确认表!D3',t('Коэффициент старения','Aging factor'),1.25,null,1,2),field('配置确认表!B4',t('Нагрузка, кВт','Load, kW'),400),field('配置确认表!B5',t('Время, мин','Runtime, min'),10)];
for(const [cell,label,value,options]of [['F7','MCCB','LS',['Schneider','LS','Nader']],['F8','RCD','N',['Y','N']],['F9',t('Нейтраль','Neutral'),'N',['Y','N']],['F10',t('Пожаротушение шкафа','Cabinet fire suppression'),'N',['Y','N']],['F11',t('Предохранитель модуля','Module fuse'),'BUSSMANN',['BUSSMANN','N']],['F12',t('Верхний кабельный короб','Top cable box'),'N',['Y','N']],['F13',t('Перевозка в сборе','Assembled transport'),'Y',['Y','N']],['F14',t('Газовый датчик','Gas detection'),'N',['Y','N']],['F15',t('Цвет шкафа','Cabinet color'),'RAL9005',['RAL9005','Other']],['F16',t('Цвет модулей','Module color'),'RAL9005',['RAL9005','Other']],['F17',t('Контроль сопротивления','Resistance monitoring'),'N',['Y','N']]])config.push(field('配置确认表!'+cell,label,value,options));
const sections=[['sizing',t('Подбор','Sizing'),sizing],['heat',t('Тепло','Heat'),heat],['cable',t('Кабели','Cables'),cable],['check',t('Проверка модели','Model check'),check],['config',t('Конфигурация','Configuration'),config]];
let candidates=[],links=null;
root.innerHTML='<aside class="wb-linked-summary" data-selection-summary></aside><nav class="wb-tabs" aria-label="'+t('Разделы калькулятора','Calculator sections')+'">'+sections.map(([id,label],i)=>`<button type="button" data-tab="${id}" aria-pressed="${i===0}">${label}</button>`).join('')+'</nav>'+sections.map(([id,label,fields],i)=>`<section data-panel="${id}" ${i?'hidden':''}><h3>${label}</h3>${id!=='sizing'?`<p class="wb-link-note">${t('Модель, шкафы и режим работы связаны с выбранной строкой подбора. Измените их в разделе «Подбор».','Model, cabinets and operating conditions follow the selected sizing row. Change them in Sizing.')}</p>`:''}<form class="wb-form" data-kind="${id}"><div class="lithium-fields">${fields.map(f=>`<label>${f.label}${f.options?`<select name="${esc(f.cell)}">${f.options.map(v=>`<option ${v===f.value?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input name="${esc(f.cell)}" type="number" step="${/Шкафы|Cabinets/.test(f.label)?1:"any"}" min="${f.min}" max="${f.max}" required value="${f.value}">`}</label>`).join('')}</div><button class="button dark">${t('Рассчитать','Calculate')}</button></form><div class="wb-output" data-output="${id}"></div></section>`).join('');
root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));root.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==b.dataset.tab);});
const headerKeys={'Выбор':'model','Selection':'model','Модель':'model','Model':'model','Шкафы':'racks','Cabinets':'racks','Модулей/шкаф':'modules','Modules/cabinet':'modules','V':'voltage','min':'runtime','А/шкаф при Uкон':'crateCurrent','A/cabinet at cutoff':'crateCurrent','Uкон, В':'cutoff','Cutoff, V':'cutoff','Заряд, В':'chargeV','Charge, V':'chargeV','Макс. заряд, В':'maxChargeV','Max charge, V':'maxChargeV','Нейтраль':'neutral','Neutral':'neutral','Проверка':'check','Check':'check','Время по таблице':'tableTime','Table time':'tableTime','Мощность DC на шкаф, кВт':'tablePower','DC power/cabinet, kW':'tablePower','Ток, А':'tableCurrent','Current, A':'tableCurrent','Время, мин':'tableTime','Time, min':'tableTime','kW DC':'tablePower'};
const headerKey=x=>headerKeys[x];
const table=(headers,rows)=>'<div class="wb-scroll"><table><thead><tr>'+headers.map(x=>'<th'+(headerKey(x)?' data-vision-parameter="'+headerKey(x)+'"':'')+'>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const metrics=(wb,sheet,items)=>'<dl class="wb-metrics">'+items.map(([a,label])=>`<div><dt data-vision-parameter="${sheet}!${a}">${label}</dt><dd>${fmt(wb.get(sheet,a))}</dd></div>`).join('')+'</dl>';
function render(form){
const overrides={'Tool!D4':1,'heat!D4':1,'Cable!C4':1,'Selection calculation!C4':1};for(const input of form.elements)if(input.name)overrides[input.name]=input.type==='number'?Number(input.value):input.value;
const kind=form.dataset.kind,out=root.querySelector(`[data-output="${kind}"]`);
if(kind!=='sizing'){
 if(!selection){out.innerHTML='<p>'+t('Укажите допустимые параметры и выберите шкафы в разделе «Подбор».','Enter valid parameters and select cabinets in Sizing.')+'</p>';return;}
 if(links.unavailable[kind]){out.innerHTML='<p class="vision-issue">'+esc(selection.model)+' · '+fmt(selection.capacityAh)+' Ah · '+fmt(selection.voltage)+' V. '+t('В таблице этого раздела нет точного соответствия выбранному шкафу. Расчёт не выполнен.','This section has no exact table match for the selected cabinet. No calculation was performed.')+'</p>';return;}
 Object.assign(overrides,links[kind]);
}
const wb=new VisionWorkbook(data,overrides);let html='';
if(kind==='sizing'){
candidates=[];
const target=overrides['Tool!L4']*Number(overrides['Tool!J4'].match(/\d+/)[0])/100;
html='<p>'+t('Выберите строку: связанные разделы пересчитаются автоматически. ','Select a row: linked sections recalculate automatically. ')+t('Целевое время со старением: ','Runtime target including aging: ')+fmt(target)+' '+t('мин','min')+'</p>';
const rows=[];
for(let r=8;r<=17;r++){
 const get=c=>wb.get('Tool',c+r),candidate=visionReadSelection(wb,r,overrides);
 if(!candidate||Math.abs(candidate.voltage-Number(overrides['Tool!E4']))>.01||!/^(TP|TPH|TPL)\d+A?$/.test(candidate.model))continue;
 if(candidates.some(c=>c.model===candidate.model&&c.capacityAh===candidate.capacityAh&&c.racks===candidate.racks))continue;
 candidates.push(candidate);
 rows.push([`<button type="button" class="wb-select" data-select-row="${r}" aria-pressed="${selection?.row===r}">${selection?.row===r?t('Выбрано','Selected'):t('Выбрать','Select')}</button>`,'YELLOW '+fmt(candidate.model),fmt(candidate.racks),fmt(candidate.modules),fmt(candidate.voltage),fmt(candidate.runtime),fmt(get('L')),fmt(get('I')),fmt(get('J')),fmt(get('K')),fmt(get('M')),candidate.meetsTarget?t('Достигает цели','Meets target'):t('Ниже цели','Below target')]);
}
html+=rows.length?table([t('Выбор','Selection'),t('Модель','Model'),t('Шкафы','Cabinets'),t('Модулей/шкаф','Modules/cabinet'),'V',t('Время, мин','Runtime, min'),t('А/шкаф при Uкон','A/cabinet at cutoff'),t('Uкон, В','Cutoff, V'),t('Заряд, В','Charge, V'),t('Макс. заряд, В','Max charge, V'),t('Нейтраль','Neutral'),t('Проверка','Check')],rows):'<p>'+t('Для выбранных параметров нет расчётных вариантов. Измените напряжение, серию или нагрузку.','No calculated options for these parameters. Change voltage, series or load.')+'</p>';
html+='<p>'+t('Проверьте совместимость диапазона напряжения с ИБП.','Check the voltage range against the UPS.')+'</p>';
}else if(kind==='heat'){
html=metrics(wb,'heat',[['B8',t('Ёмкость ячейки, А·ч','Cell capacity, Ah')],['C8',t('Схема','Topology')],['E8',t('Ток заряда ячейки, А','Cell charge current, A')],['F8',t('DCR, мОм','DCR, mΩ')],['F16',t('Масса ячеек, кг','Cell mass, kg')],['J18',t('Поглощено ячейками, кДж','Cell absorbed heat, kJ')],['J20',t('Поглощено корпусом, кДж','Enclosure absorbed heat, kJ')],['H23',t('Отдано при разряде, кДж/система','Discharge released heat, kJ/system')],['H8',t('Ток ячейки, А','Cell current, A')],['I8',t('Доступный разряд, мин','Available discharge, min')],['J8',t('Тепло разряда, кДж/шкаф','Discharge heat, kJ/cabinet')],['K8',t('Тепло заряда, кДж/шкаф','Charge heat, kJ/cabinet')],['F13',t('Мгновенное тепло, кВт/шкаф','Instant heat, kW/cabinet')],['H18',t('Рост температуры, °C','Temperature rise, °C')],['H24',t('Полное тепло системы, кДж','Total system heat, kJ')],['J24',t('Полное тепло системы, кВт·ч','Total system heat, kWh')],['I25',t('Макс. воздушное охлаждение, кВт/шкаф','Max air cooling, kW/cabinet')],['I26',t('Макс. воздушное, кВт/система','Max air, kW/system')],['I27',t('Воздушное за заданный разряд, кВт/шкаф','Air at requested discharge, kW/cabinet')],['I28',t('Воздушное, кВт/система','Air, kW/system')],['I29',t('Макс. жидкостное, кВт/шкаф','Max liquid, kW/cabinet')],['I30',t('Макс. жидкостное, кВт/система','Max liquid, kW/system')],['I31',t('Жидкостное за разряд, кВт/шкаф','Liquid at discharge, kW/cabinet')],['I32',t('Жидкостное, кВт/система','Liquid, kW/system')]]);
html+='<p>'+t('«Нет результата» или error: сочетание отсутствует в таблице либо превышен токовый предел. NA означает отсутствие жидкостного охлаждения. Тепловые коэффициенты требуют инженерной сверки.','No result or error: unsupported table combination or current limit exceeded. NA means liquid cooling is unavailable. Confirm the thermal coefficients for the project.')+'</p>';
html+='<details><summary>'+t('Тепловая справочная таблица','Heat reference table')+'</summary>'+table([t('Строка','Row'),...Array.from({length:25},(_,i)=>String.fromCharCode(66+i))],wb.range('热量速查表','B2','Z73').map((r,i)=>[i+2,...r.map(fmt)]))+'</details>';
}else if(kind==='cable'){
html=metrics(wb,'Cable',[['J19',t('Общий ток, А','Total current, A')],['J22',t('Ток на шкаф, А','Current per cabinet, A')],['I25',t('Допустимый ток выбранного кабеля, А','Selected ampacity, A')],['F25',t('Сечение, мм²','Cross-section, mm²')]]);
html+='<p>'+t('Условия: одножильная медь, XLPE 1–3 кВ, воздух; ссылка источника GB50217-2018 C.0.1-3. Выбирается ток строго выше расчётного. Выше 1177 А на шкаф таблица не даёт решения. В формуле используется 3,05 В на ячейку; серия и время разряда её не меняют.','Conditions: single-core copper, XLPE 1–3 kV, in air; source reference GB50217-2018 C.0.1-3. Ampacity is strictly greater than calculated current. Above 1177 A/cabinet no solution is available. The formula uses 3.05 V/cell; series and runtime do not change it.')+'</p>';
html+='<details><summary>'+t('Экспериментальная оценка падения напряжения','Experimental voltage-drop estimate')+'</summary><p>'+t('Аппроксимация исходных измерений: 2 × 0,6364 + 0,1112 × длина = ','Fit to source measurements: 2 × 0.6364 + 0.1112 × length = ')+fmt(wb.get('Cable','G59'))+' V. '+t('Не связана с выбранным сечением и током.','Independent of selected gauge and current.')+'</p></details>';
}else if(kind==='check'){
html=metrics(wb,'Selection calculation',[['A25',t('Модель','Model')],['L19',t('Требуемая мощность DC, кВт','Required DC power, kW')],['L22',t('Требуемая энергия, кВт·ч','Required energy, kWh')],['I31',t('Мощность в первой точке × шкафы, кВт','First-point power × cabinets, kW')],['I32',t('Энергия × шкафы, кВт·ч','Energy × cabinets, kWh')]]);
html+=table([t('Время по таблице','Table time'),t('Мощность DC на шкаф, кВт','DC power/cabinet, kW'),t('Ток, А','Current, A')],['E','F','G','H','I'].map(c=>[27,28,29].map(r=>fmt(wb.get('Selection calculation',c+r)))));
for(const [available,required,label]of [['I31','L19',t('Мощность','Power')],['I32','L22',t('Энергия','Energy')]]){const a=wb.get('Selection calculation',available),b=wb.get('Selection calculation',required);html+='<p>'+label+': '+(typeof a==='number'&&typeof b==='number'?(a>=b?t('Достаточно','Sufficient'):t('Недостаточно','Insufficient')):t('Модель отсутствует в таблице','Model absent from table'))+'</p>';}
html+='<p>'+t('Для TPL время таблицы указано в часах, для других серий — в минутах. Проверка мощности использует первую точку, без интерполяции на заданное время. Номинальная энергия взята из расчётной таблицы; встречаются расхождения со спецификациями.','TPL table times are hours; other families use minutes. Power uses the first table point without interpolation to requested runtime. Nominal energy is taken from the calculation table; some entries differ from specifications.')+'</p><p>'+t('Доступные модели: ','Available models: ')+esc(modelKeys.join(', '))+'</p>';
}else{
const labels=['Диапазон напряжения, В / Voltage range, V','Ячейка / Cell','Схема / Topology','Модулей / Modules','Номинал, В / Nominal V','Ёмкость, А·ч / Capacity, Ah','Энергия системы, кВт·ч / System energy, kWh','Ток заряда, А / Charge A','Uкон, В / Cutoff V','Заряд, В / Charge V','Циклы / Cycles','Ш × Г × В, мм / W × D × H, mm','Масса, кг / Weight, kg','Сопротивление (единицы требуют сверки) / Resistance (verify source units)','Охлаждение / Cooling','Заряд, °C / Charge °C','Разряд, °C / Discharge °C','Влажность / Humidity','Интерфейсы / Interfaces','Сухие контакты / Dry contacts','Параллельные шкафы / Parallel cabinets','Срок службы, лет / Life, years','Защита полярности / Reverse protection','Контакты предохранителя / Fuse contacts','Марка предохранителя / Fuse brand','Пожаротушение модуля / Module fire suppression','Балансировка ячеек / Cell balancing','Балансировка шкафов / Cabinet balancing','Кольцевая связь / Ring communication','Питание BMS / BMS supply','ПО / Host software','Протокол / Protocol'];
const translate=v=>({'有':t('Да','Yes'),'支持':t('Поддерживается','Supported'),'风冷':t('Воздушное','Air'),'主动均衡':t('Активная','Active')})[v]??v;
html=metrics(wb,'配置确认表',[['D4',t('Максимальная мощность, кВт','Maximum power, kW')],['F4',t('Запас мощности, кВт','Power margin, kW')],['D5',t('Расчётное время, мин','Calculated runtime, min')],['F5',t('Запас времени, мин','Runtime margin, min')]]);
html+=table([t('Параметр','Parameter'),t('Значение','Value')],labels.map((label,i)=>[`<span data-vision-parameter="配置确认表!C${i+7}">${label}</span>`,fmt(translate(wb.get('配置确认表','C'+(i+7))))]));
html+='<p>'+t('Сводка использует КПД 95%. ','The summary uses 95% efficiency. ')+t('Параметры корпуса относятся к расчётной версии и могут отличаться от опубликованных паспортов. Выбранные опции фиксируют запрос, но не меняют электрический расчёт.','Enclosure data follows the workbook version and may differ from published datasheets. Options record the request and do not change electrical calculations.')+'</p>';
html+='<button type="button" class="button outline" data-export>'+t('Сохранить конфигурацию','Save configuration')+'</button>';
}
out.innerHTML=html;
out.querySelectorAll('[data-select-row]').forEach(button=>button.onclick=()=>{
 selection=candidates.find(c=>c.row===Number(button.dataset.selectRow));syncLinkedSections();render(form);
});
const exportButton=out.querySelector('[data-export]');if(exportButton)exportButton.onclick=()=>{const blob=new Blob([JSON.stringify({source:data.source,selection,inputs:overrides,results:Object.fromEntries(Array.from({length:32},(_,i)=>['C'+(i+7),wb.get('配置确认表','C'+(i+7))]))},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='yellow-configuration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
function syncLinkedSections(){
 links=visionSelectionLinks(data,selection);
 const summary=root.querySelector('[data-selection-summary]');
 summary.innerHTML=selection?'<strong>'+t('Выбрано: ','Selected: ')+'YELLOW '+esc(selection.model)+' × '+fmt(selection.racks)+'</strong><span>'+fmt(selection.capacityAh)+' Ah · '+fmt(selection.voltage)+' V · '+t('Нагрузка: ','Load: ')+fmt(selection.power*selection.load)+' kW · '+fmt(selection.minutes)+' '+t('мин','min')+'</span><span>'+t('Параметры автоматически применены к связанным разделам.','Parameters are automatically applied to linked sections.')+'</span>'+(!selection.meetsTarget?'<span class="vision-issue">'+t('Расчётное время ниже цели с учётом старения.','Calculated runtime is below the target including aging.')+'</span>':''):'<strong>'+t('Сначала задайте допустимые параметры подбора.','First enter valid sizing parameters.')+'</strong>';
 for(const [kind,,fields]of sections){
  if(kind==='sizing')continue;
  const form=root.querySelector(`[data-kind="${kind}"]`),values=links?.[kind];
  for(const input of form.elements){
   if(!input.name)continue;
   const linked=values&&Object.hasOwn(values,input.name);
   input.disabled=!!linked||!selection;
   if(linked)input.value=values[input.name];
  }
  render(form);
 }
}
function updateSizing(){
 const form=root.querySelector('[data-kind="sizing"]');
 if(!form.checkValidity()){
  selection=null;candidates=[];root.querySelector('[data-output="sizing"]').innerHTML='<p>'+t('Проверьте параметры подбора.','Check sizing parameters.')+'</p>';syncLinkedSections();return;
 }
 render(form);
 const previous=selection;
 selection=candidates.find(c=>previous&&c.model===previous.model&&c.voltage===previous.voltage&&c.capacityAh===previous.capacityAh)||candidates.find(c=>c.row>=16&&c.meetsTarget)||candidates.find(c=>c.row>=16)||candidates.find(c=>c.meetsTarget)||candidates[0]||null;
 syncLinkedSections();render(form);
}
root.querySelectorAll('input,select').forEach(x=>{if(saved[x.name]!==undefined)x.value=saved[x.name];});
if(active)root.querySelector(`[data-tab="${active}"]`)?.click();
root.querySelectorAll('form').forEach(form=>{
 const update=()=>{if(form.dataset.kind==='sizing')updateSizing();else if(form.checkValidity())render(form);};
 form.oninput=update;
 form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())update();};
 form.onchange=e=>{if(['Tool!E4','Tool!F4'].includes(e.target.name))selection=null;update();};
});
updateSizing();
}
mount();document.addEventListener('site-language-changed',mount);
}catch(error){root.textContent=t('Не удалось загрузить расчётные таблицы. Обновите страницу.','Unable to load calculation tables. Reload the page.');console.error(error);}
})();
