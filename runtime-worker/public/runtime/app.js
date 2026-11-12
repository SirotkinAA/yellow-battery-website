'use strict';
const form=document.querySelector('#calculator'), result=document.querySelector('#result'), stages=document.querySelector('#stages');
const get=name=>form.elements.namedItem(name), $=id=>document.getElementById(id);
let last=null, revision=0, pending=false, catalog=null;

const errorsRu={nonmonotone_spline:'Кубический сплайн возрастает между узлами таблицы. Расчёт для этих условий требует проверки данных.',invalid_number:'Введите конечное числовое значение. Допускаются запятая или точка.',invalid_range:'Значение вне допустимого диапазона.',invalid_integer:'Количество должно быть положительным целым числом.',invalid_efficiency:'КПД должен быть больше 0 и не выше 100%.',invalid_power_factor:'Коэффициент мощности должен быть больше 0 и не выше 1.',invalid_unit:'Недопустимая единица измерения.',incompatible_voltage:'Напряжение системы не соответствует целому числу батарей.',outside_curve:'Длительность выходит за пределы исходной разрядной таблицы.',missing_voltage:'Нет разрядной таблицы для выбранного конечного напряжения. Выберите напряжение из таблицы выбранной модели.',temperature_data_unavailable:'Нет подтверждённых данных для выбранной температуры.',unapproved_data:'Выбранная разрядная таблица ещё не утверждена.',invalid_profile:'Добавьте от 1 до 100 этапов с положительной длительностью.',zero_profile:'Нагрузка не может быть нулевой на всех этапах.',resource_limit:'Превышен предел расчёта: не более 100 параллельных линеек.',model_unavailable:'Выбранная модель отсутствует в доступном наборе данных.',invalid_curve:'Разрядная таблица содержит некорректные значения.',invalid_voltage_order:'Разрядные таблицы противоречат друг другу по конечному напряжению.',duplicate_curve:'Найдено несколько таблиц для одинаковых условий.',invalid_provenance:'Не указан корректный источник или статус данных.',invalid_limit:'Некорректные данные токового ограничения.',series_out_of_scope:'Доступны только серии HR-M и HR-WM.',forbidden_source:'Этот источник разрядных данных не разрешён.',demo_only:'Синтетические данные доступны только в демонстрационном режиме.',simple_mode_conditions:'Простой подбор выполняется с коэффициентами старения и запаса 1.',invalid_fields:'Некорректный состав полей запроса.',invalid_document:'Некорректный формат данных.',invalid_request:'Не удалось прочитать запрос.',invalid_text:'Не заполнено обязательное текстовое поле.',invalid_operation:'Неизвестный режим расчёта.',unsupported_schema:'Версия набора данных не поддерживается.',duplicate_model:'В наборе повторяется артикул модели.',duplicate_field:'В запросе повторяется поле.',invalid_body_size:'Запрос слишком велик или пуст.',json_required:'Ожидаются данные в формате JSON.',content_length_required:'Сервер не смог определить размер запроса.'};
const fieldsRu={load:'Мощность нагрузки',efficiency_percent:'КПД ИБП',power_factor:'Коэффициент мощности',series_batteries:'АКБ в линейке',parallel_strings:'Параллельные линейки',max_parallel_strings:'Максимум параллелей',required_minutes:'Требуемое время',end_voltage_v_cell:'Конечное напряжение',age_factor:'Коэффициент старения',reserve_factor:'Коэффициент запаса',stage_duration:'Длительность этапа'};
function errorText(data){const field=String(data.message||'').split(' ')[0];return (fieldsRu[field]?fieldsRu[field]+': ':'')+(errorsRu[data.error]||'Расчёт не выполнен. Проверьте исходные данные и повторите попытку.');}

const fmt=n=>new Intl.NumberFormat(language==='ru'?'ru-RU':'en-GB',{minimumSignificantDigits:4,maximumSignificantDigits:4}).format(n);
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)localizedText(el,text);if(cls)el.className=cls;return el;}
function dirty(){revision++;if(last){$('stale').hidden=false;$('download').disabled=true;}}
function row(load='',minutes=''){const el=node('div',undefined,'stage');for(const [label,value,key] of [['Нагрузка',load,'load'],['Время, мин',minutes,'duration_minutes']]){const l=node('label',label),i=node('input');i.value=value;i.inputMode='decimal';i.dataset.key=key;i.required=true;l.append(i);el.append(l);}const del=node('button','Удалить','secondary');del.type='button';del.onclick=()=>{el.remove();dirty();};el.append(del);stages.append(el);}
function mode(){const op=get('operation').value;for(const button of document.querySelectorAll('[data-operation]')){const selected=button.dataset.operation===op;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}$('mode-panel').setAttribute('aria-labelledby','mode-'+op);localizedText($('mode-description'),{select:'По времени автономной работы и нагрузке',profile:'Ступенчатый профиль',runtime:'Время автономной работы конкретной батареи'}[op]);for(const name of ['model_id','load','parallel_strings','required_minutes','max_parallel_strings','age_factor','reserve_factor','power_factor']){const show=name==='model_id'?op!=='select':name==='load'?op!=='profile':name==='parallel_strings'?op==='runtime':name==='required_minutes'?op==='select':name==='max_parallel_strings'?op!=='runtime':name==='power_factor'?get('unit').value==='kVA':op!=='select';document.querySelector(`[data-field="${name}"]`).hidden=!show;get(name).disabled=!show;}$('profile').hidden=op!=='profile';stages.querySelectorAll('input').forEach(i=>i.disabled=op!=='profile');}
form.addEventListener('input',dirty);form.addEventListener('change',()=>{dirty();mode();});
$('add-stage').onclick=()=>{if(stages.children.length<100){row();dirty();}};
async function example(){try{const response=await fetch('/runtime/api/examples');if(!response.ok)throw Error('Не удалось загрузить пример');const examples=await response.json(),r=examples[get('operation').value];for(const key of ['model_id','temperature_c','load','unit','power_factor','efficiency_percent','series_batteries','end_voltage_v_cell','parallel_strings','required_minutes','max_parallel_strings','age_factor','reserve_factor']){if(r[key]!==undefined)get(key).value=key==='end_voltage_v_cell'?Number(r[key]).toFixed(2):r[key];else if(key==='age_factor'||key==='reserve_factor')get(key).value=1;}stages.replaceChildren();for(const s of r.stages||[{load:0.54,duration_minutes:5},{load:0.06,duration_minutes:5}])row(s.load,s.duration_minutes);mode();updateCatalogStatus();dirty();}catch(e){result.replaceChildren(node('p',e.message,'error'));}}
$('example').onclick=example;
function request(){const op=get('operation').value,r={operation:op,unit:get('unit').value,efficiency_percent:get('efficiency_percent').value,series_batteries:get('series_batteries').value,end_voltage_v_cell:get('end_voltage_v_cell').value,temperature_c:get('temperature_c').value};for(const key of ['load','power_factor','parallel_strings','required_minutes','max_parallel_strings','age_factor','reserve_factor'])if(!get(key).disabled)r[key]=get(key).value;if(op==='select'){const option=get('required_minutes').selectedOptions[0];r.time_range_minutes=[Number(option.value),option.dataset.upper?Number(option.dataset.upper):null];}if(op!=='select')r.model_id=get('model_id').value;if(op==='profile')r.stages=[...stages.children].map(el=>Object.fromEntries([...el.querySelectorAll('input')].map(i=>[i.dataset.key,i.value])));return r;}
function metric(parent,label,value){const el=node('div',label);el.prepend(node('b',value));parent.append(el);}
const fmt4=n=>new Intl.NumberFormat(language==='ru'?'ru-RU':'en-GB',{minimumSignificantDigits:4,maximumSignificantDigits:4}).format(n);
function runtimeText(r){const t=r.runtime;if(t.kind==='exact')return fmt4(t.minutes)+' мин';if(t.kind==='interval')return fmt4(t.minutes)+'–'+fmt4(t.upper_minutes)+' мин';return (t.kind==='less_than'?'Менее ':'Не менее ')+fmt4(t.minutes)+' мин';}

const modelPages={"HR 12-12M":"/catalog/hr-12-12m/","HR 12-18M":"/catalog/hr-12-18m/","HR 12-26M":"/catalog/hr-12-26m/","HR 12-5M":"/catalog/hr-12-5m/","HR 12-7.5M":"/catalog/hr-12-7.5m/","HR 12-9M":"/catalog/hr-12-9m/","HR 12-40WM":"/catalog/hr-12-40wm/","HRL 12-100M":"/catalog/hrl-12-100m/","HRL 12-120M":"/catalog/hrl-12-120m/","HRL 12-150M":"/catalog/hrl-12-150m/","HRL 12-250M":"/catalog/hrl-12-250m/","HRL 12-33M":"/catalog/hrl-12-33m/","HRL 12-45M":"/catalog/hrl-12-45m/","HRL 12-55M":"/catalog/hrl-12-55m/","HRL 12-65M":"/catalog/hrl-12-65m/","HRL 12-75M":"/catalog/hrl-12-75m/","HRL 12-90M":"/catalog/hrl-12-90m/","HRL 12-115WM":"/catalog/hrl-12-115wm/","HRL 12-22WM":"/catalog/hrl-12-22wm/","HRL 12-320WM":"/catalog/hrl-12-320wm/","HRL 12-400WM":"/catalog/hrl-12-400wm/","HRL 12-420WM":"/catalog/hrl-12-420wm/","HRL 12-450WM":"/catalog/hrl-12-450wm/","HRL 12-500WM":"/catalog/hrl-12-500wm/","HRL 12-540WM":"/catalog/hrl-12-540wm/","HRL 12-820WM":"/catalog/hrl-12-820wm/"};
function modelLink(id){const path=modelPages[id];if(!path)return node("span",id);const link=node("a",id,"model-link");link.href=new URL(path,location.origin).href;link.target="_blank";link.rel="noopener noreferrer";return link;}

function rackLink(item){
 const link=node('a','Подобрать стеллажи →','rack-select-link');
 link.href='/racks/?'+new URLSearchParams({model:item.model_id,count:String(item.total_batteries)});
 link.target='_blank';link.rel='noopener';
 link.setAttribute('aria-label',t('Подобрать стеллажи →')+' '+item.model_id+' · '+item.total_batteries);
 return link;
}

function render(data){
 const r=data.result;result.replaceChildren();
 if(r.operation==='select'){
  result.append(node('h2','Варианты в выбранном диапазоне'));
  if(r.exclusions.some(x=>x.code==='nonmonotone_spline'))result.append(node('p','Некоторые варианты исключены: сплайн немонотонен на участке для этой нагрузки. Остальные варианты рассчитаны.','notice'));
  const action=node('div',undefined,'rack-selection-action'),selection=node('p'),radios=[];
  function selectItem(item){localizedText(selection,'Выбрано:');selection.append(document.createTextNode(' '+item.model_id+' · '+item.parallel_strings+' × '+(item.total_batteries/item.parallel_strings)+' = '+item.total_batteries+' '+t('АКБ')));action.replaceChildren(selection,rackLink(item));}
  function tableFor(items){
   const table=node('table'),head=node('tr');
   for(const title of ['Выбор','Модель','Время','Параллели','Всего АКБ'])head.append(node('th',title));table.append(head);
   for(const item of items){const tr=node('tr'),cell=node('td'),radio=document.createElement('input');radio.type='radio';radio.name='rack-result';radio.setAttribute('aria-label',item.model_id+' · '+item.parallel_strings+' × '+(item.total_batteries/item.parallel_strings));cell.append(radio);tr.append(cell);const modelCell=node('td');modelCell.append(modelLink(item.model_id));tr.append(modelCell);for(const val of [runtimeText(item),item.parallel_strings,item.total_batteries])tr.append(node('td',String(val)));
    radio.onchange=()=>{for(const entry of radios)entry.tr.classList.toggle('selected-result',entry.radio.checked);selectItem(item);};radios.push({radio,tr});table.append(tr);
   }return table;
  }
  const main=[...r.groups.meets_target,...r.groups.below_target];
  if(main.length)result.append(tableFor(main));else result.append(node('p','В выбранном диапазоне нет подходящих вариантов. Проверьте нагрузку, напряжение, температуру и число параллельных линеек.','notice'));
  const reserve=r.reserve_candidates||[];
  if(reserve.length){const details=node('details'),summary=node('summary','С запасом автономии');details.className='reserve-results';summary.append(document.createTextNode(' ('+reserve.length+')'));details.append(summary,node('p','Время работы больше верхней границы выбранного диапазона.','hint'),tableFor(reserve));details.open=!main.length;result.append(details);}
  if(radios.length){radios[0].radio.checked=true;radios[0].radio.onchange();result.append(action);}
 }else{result.append(node('h2',r.operation==='runtime'?'Расчётное время работы':'Конфигурация по профилю'));result.append(node('div',r.operation==='runtime'?runtimeText(r):r.parallel_strings+' параллели','metric'));const modelLabel=node('p',undefined,'hint');modelLabel.append(modelLink(r.model_id));result.append(modelLabel);const metrics=node('div',undefined,'metrics');metric(metrics,'Всего батарей',r.total_batteries);metric(metrics,'Ток линейки, А',fmt4(r.current_check.string_current_a));if(r.operation==='profile'){metric(metrics,'Требуется, А·ч',fmt(r.required_capacity_ah));metric(metrics,'Определяющая секция',r.critical_section);if(!r.within_parallel_limit)result.append(node('p','Превышено допустимое число параллелей.','error'));}else{metric(metrics,'Мощность DC, Вт',fmt4(r.dc_power_w));metric(metrics,'На элемент, Вт',fmt4(r.power_w_cell));}result.append(metrics);if(r.operation!=='profile'||r.within_parallel_limit)result.append(rackLink(r));}result.append(node('p','Расчёт по листовкам. Токовые ограничения не проверены; сверка с Mathcad ожидается.','notice'));}
form.onsubmit=async event=>{event.preventDefault();if(pending)return;pending=true;const captured=revision;$('calculate').disabled=true;$('result-panel').setAttribute('aria-busy','true');last=null;$('download').hidden=true;$('details').hidden=true;$('stale').hidden=true;try{const response=await fetch('/runtime/api/calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request())});const data=await response.json();if(!response.ok)throw Error(errorText(data));last=data;render(data);renderDetails(data);$('details').hidden=false;$('download').hidden=false;$('download').disabled=captured!==revision;$('stale').hidden=captured===revision;}catch(e){result.replaceChildren(node('h2','Расчёт не выполнен'),node('p',e instanceof TypeError?'Не удалось связаться с сервером. Проверьте подключение и повторите расчёт.':e.message,'error'));}finally{pending=false;$('calculate').disabled=false;$('result-panel').setAttribute('aria-busy','false');}};
$('download').onclick=()=>{if(!last||!$('stale').hidden)return;const url=URL.createObjectURL(new Blob([JSON.stringify(last,null,2)],{type:'application/json'}));const a=node('a');a.href=url;a.download='yellow-runtime-calculation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
row(0.54,5);row(0.06,5);mode();

$('language').addEventListener('click',event=>{const button=event.target.closest('[data-language]');if(!button)return;language=button.dataset.language;try{localStorage.setItem('yellow-runtime-language',language);localStorage.setItem('yellow-site-language',language);}catch(_){}applyLanguage();refreshHelp();if(last){render(last);renderDetails(last);}});

document.querySelector('.mode-options').addEventListener('click',event=>{const button=event.target.closest('[data-operation]');if(!button)return;get('operation').value=button.dataset.operation;mode();dirty();});

document.querySelector('.mode-options').addEventListener('keydown',event=>{const tabs=[...document.querySelectorAll('[data-operation]')].filter(button=>!button.hidden);const current=tabs.indexOf(event.target);if(current<0)return;let next;if(event.key==='ArrowRight')next=(current+1)%tabs.length;else if(event.key==='ArrowLeft')next=(current+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();tabs[next].click();tabs[next].focus();});

function updateCatalogStatus(){
 if(!catalog)return;
 const op=get('operation').value;
 const models=op==='select'?catalog.models:catalog.models.filter(m=>m.id===get('model_id').value);
 const temp=Number(get('temperature_c').value),voltage=Number(get('end_voltage_v_cell').value);
 const matching=models.filter(m=>m.conditions.some(c=>c.temperature_c===temp&&c.end_voltage===voltage));
 localizedText($('catalog-status'),matching.length?'Данные листовок доступны для выбранных условий. Без экстраполяции за пределы таблиц.':'Для выбранной температуры и напряжения нет таблиц. Измените условия.');
}
form.addEventListener('change',()=>{
 if(catalog&&get('operation').value!=='select'){
  const model=catalog.models.find(m=>m.id===get('model_id').value);
  if(model&&!model.conditions.some(c=>c.temperature_c===Number(get('temperature_c').value)))get('temperature_c').value=model.conditions[0].temperature_c;
 }
 updateCatalogStatus();
});
document.querySelector('.mode-options').addEventListener('click',updateCatalogStatus);
async function loadCatalog(){
 $('calculate').disabled=true;$('example').disabled=true;
 try{
  const response=await fetch('/runtime/api/catalog');if(!response.ok)throw Error('Не удалось загрузить каталог. Обновите страницу.');
  catalog=await response.json();get('model_id').replaceChildren();
  for(const model of catalog.models){const option=document.createElement('option');option.value=model.id;option.textContent=model.id;get('model_id').append(option);}
  get('model_id').value='HR 12-12M';const requested=new URLSearchParams(location.search).get('model');if(!document.body.classList.contains('embedded')&&catalog.models.some(m=>m.id===requested)){get('model_id').value=requested;get('operation').value='runtime';const selected=catalog.models.find(m=>m.id===requested);if(selected.conditions.length)get('temperature_c').value=String(selected.conditions[0].temperature_c);}mode();updateCatalogStatus();$('calculate').disabled=false;$('example').disabled=false;
 }catch(e){localizedText($('catalog-status'),'Не удалось загрузить каталог. Обновите страницу.');}
}
loadCatalog();


function renderDetails(data){
 const pick=(ru,en)=>language==='ru'?ru:en;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const number=value=>{const n=Number(String(value).replace(',','.'));return Number.isFinite(n)?new Intl.NumberFormat(language==='ru'?'ru-RU':'en-GB',{maximumSignificantDigits:4}).format(n):'—';};
 const minutes=value=>number(value)+' '+pick('мин','min');
 let box=$('raw');
 if(box.tagName==='PRE'){const replacement=make('div');replacement.id='raw';box.replaceWith(replacement);box=replacement;}
 box.className='calculation-details';box.replaceChildren();
 const summary=$('details').querySelector('summary');localizedText(summary,'Подробности расчёта');
 localizedText($('download'),'Скачать технические данные (JSON)');
 const r=data.result, input=data.input_snapshot?.request||{};
 function section(title){const s=make('section');s.append(make('h3',title));box.append(s);return s;}
 function table(parent,headers,rows){const wrap=make('div',undefined,'details-table-wrap'),tab=make('table'),head=make('thead'),tr=make('tr');for(const h of headers){const th=make('th',h);th.scope='col';tr.append(th);}head.append(tr);tab.append(head);const body=make('tbody');for(const row of rows){const tr=make('tr');for(const v of row)tr.append(make('td',String(v)));body.append(tr);}tab.append(body);wrap.append(tab);parent.append(wrap);}
 const inputs=section(pick('Исходные условия','Calculation inputs'));
 const fields=[['model_id','Модель','Model'],['load','Мощность нагрузки','Load power'],['unit','Единица мощности','Power unit'],['efficiency_percent','КПД преобразователя, %','Converter efficiency, %'],['power_factor','Коэффициент мощности','Power factor'],['series_batteries','АКБ в одной линейке','Batteries per string'],['parallel_strings','Параллельные линейки','Parallel strings'],['max_parallel_strings','Максимум параллельных линеек','Maximum parallel strings'],['end_voltage_v_cell','Конечное напряжение, В/элемент','End voltage, V/cell'],['temperature_c','Температура таблицы, °C','Table temperature, °C'],['age_factor','Коэффициент старения','Ageing factor'],['reserve_factor','Коэффициент запаса','Design margin factor']];
 const inputRows=fields.filter(([key])=>input[key]!==undefined).map(([key,ru,en])=>[pick(ru,en),key==='unit'?({kW:pick('кВт','kW'),kVA:pick('кВА','kVA')}[input[key]]||input[key]):key==='model_id'?input[key]:number(input[key])]);
 if(input.time_range_minutes){const [a,b]=input.time_range_minutes;inputRows.unshift([pick('Диапазон времени','Runtime range'),b===null?pick('Свыше ','Over ')+minutes(a):number(a)+'–'+minutes(b)]);}else if(input.required_minutes!==undefined)inputRows.unshift([pick('Требуемое время','Required runtime'),minutes(input.required_minutes)]);
 table(inputs,[pick('Параметр','Parameter'),pick('Значение','Value')],inputRows);
 if(input.stages?.length)table(inputs,[pick('Этап','Stage'),pick('Нагрузка','Load')+' ('+({kW:pick('кВт','kW'),kVA:pick('кВА','kVA')}[input.unit]||input.unit)+')',pick('Длительность','Duration')],input.stages.map((s,i)=>[i+1,number(s.load),minutes(s.duration_minutes)]));
 const results=section(pick('Результаты и проверки','Results and checks'));
 const candidates=r.operation==='select'?[...(r.groups?.meets_target||[]),...(r.groups?.below_target||[])]:[r];
 const status={checked:pick('Проверено','Verified'),not_checked:pick('Не подтверждено','Not verified'),exceeded:pick('Превышено','Exceeded')};
 if(candidates.length)table(results,[pick('Модель','Model'),pick('Линейки × АКБ','Strings × batteries'),pick('Время','Runtime'),pick('Ток линейки, А','String current, A'),pick('Токовые ограничения','Current limits')],candidates.map(x=>[x.model_id,x.parallel_strings+' × '+x.series_batteries,x.runtime?t(runtimeText(x)):pick('По профилю','By profile'),Number.isFinite(x.current_check?.string_current_a)?fmt4(x.current_check.string_current_a):'—',status[x.current_check?.status]||pick('Не подтверждено','Not verified')]));
 else results.append(make('p',pick('В выбранном диапазоне нет подходящих вариантов.','No matching configurations in the selected range.')));
 if(r.reserve_candidates?.length)results.append(make('p',pick('Вариантов с запасом автономии: ','Configurations with additional runtime: ')+r.reserve_candidates.length+pick('. Они приведены в основном результате выше.','. These are listed in the main result above.'),'hint'));
 if(r.operation==='profile'&&r.sections?.length)table(results,[pick('Секция профиля','Profile section'),pick('Расчётная ёмкость, А·ч','Calculated capacity, Ah')],r.sections.map(s=>[s.section,number(s.capacity_ah)]));
 const excluded=[...(r.exclusions||[]),...(data.rejected_models||[])];
 const reason=e=>{
  if(e.code==='time_not_exact'&&e.runtime_bound){const b=e.runtime_bound;return (b.kind==='less_than'?pick('Время менее ','Runtime below '):pick('Время не менее ','Runtime at least '))+minutes(b.minutes)+pick('; точное значение за пределами таблицы не вычисляется.','; exact runtime outside the table is not calculated.');}
  const reasons={nonmonotone_spline:pick('Нельзя надёжно определить время: проверка сплайна не пройдена для этой конфигурации.','Runtime cannot be determined reliably: the spline check failed for this configuration.'),temperature_data_unavailable:pick('Нет таблицы для выбранной температуры.','No table for the selected temperature.'),missing_voltage:pick('Нет таблицы для выбранного конечного напряжения.','No table for the selected end voltage.'),current_exceeded:pick('Превышено подтверждённое токовое ограничение.','A verified current limit is exceeded.'),unapproved_data:pick('Разрядные данные ещё не утверждены.','Discharge data has not been approved.'),outside_curve:pick('Длительность за пределами исходной таблицы.','Duration is outside the source table.'),model_unavailable:pick('Модель недоступна в текущем наборе данных.','Model is unavailable in the current dataset.')};
  return reasons[e.code]||pick('Данные модели или условия требуют проверки. Подробности доступны в технической выгрузке.','Model data or conditions need review. Details are available in the technical export.');
 };
 const exclusions=section(pick('Исключённые варианты','Excluded configurations'));
 if(excluded.length)table(exclusions,[pick('Модель','Model'),pick('Параллельные линейки','Parallel strings'),pick('Причина','Reason')],excluded.map(e=>[e.model_id||'—',['missing_voltage','temperature_data_unavailable','unapproved_data','model_unavailable'].includes(e.code)?pick('Все','All'):(e.parallel_strings??pick('Все','All')),reason(e)]));
 else exclusions.append(make('p',pick('Ошибок данных и исключений по ограничениям не зарегистрировано.','No data errors or constraint exclusions were recorded.')));
 if(r.operation==='select')exclusions.append(make('p',pick('Варианты с расчётным временем вне выбранного диапазона не входят в основной список. Варианты с большей автономией показаны в разделе «С запасом автономии».','Configurations outside the selected runtime range are not included in the main list. Longer runtimes appear under “Additional runtime”.'),'hint'));
 const limitations=section(pick('Ограничения расчёта','Calculation limitations'));
 const notes=[pick('Ток распределяется между параллельными линейками равномерно.','Current is assumed to be shared equally between parallel strings.'),pick('Падение напряжения в кабелях и тепловой режим не рассчитываются.','Cable voltage drop and thermal behaviour are not calculated.'),pick('«Не подтверждено» означает, что проверены не все токовые ограничения батарей, клемм, соединений и защиты. Это не подтверждение пригодности всей установки.','“Not verified” means that not all current limits for batteries, terminals, interconnects and protection have been verified. It is not approval of the complete installation.'),pick('Используются табличные данные и кубическая интерполяция без экстраполяции. Полная сверка актуальной базы в Mathcad ещё не завершена.','The calculation uses tabulated data and cubic interpolation without extrapolation. Full validation of the current dataset in Mathcad is still pending.')];
 const list=make('ul');for(const note of notes)list.append(make('li',note));limitations.append(list);
}
