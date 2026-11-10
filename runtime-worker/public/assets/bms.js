'use strict';
(() => {
  const language = () => document.documentElement.lang === 'en' ? 'en' : 'ru';
  const text = (ru,en) => language() === 'en' ? en : ru;
  const views=[...document.querySelectorAll('[data-bms-view]')], filters=[...document.querySelectorAll('[data-bms-app]')];
  const checks=[...document.querySelectorAll('[data-bms-compare]')];
  const params=new URLSearchParams(location.search);
  let view=views.some(x=>x.dataset.bmsView===params.get('view'))?params.get('view'):'solutions';
  let application=filters.some(x=>x.dataset.bmsApp===params.get('application'))?params.get('application'):'all';
  let compared=true;
  const selected=()=>checks.filter(x=>x.checked).map(x=>x.dataset.bmsCompare);
  function updateComparison(){
    checks.forEach(x=>x.setAttribute('aria-label',text('Сравнить ','Compare ')+x.dataset.bmsCompare));
    const names=selected(), count=document.querySelector('[data-bms-count]'), button=document.querySelector('[data-bms-compare-open]');
    if(count) count.textContent=names.length?text('Выбрано: ','Selected: ')+names.join(' + '):text('Выберите хотя бы две модели','Select at least two models');
    if(button) button.disabled=names.length<2;
    const table=document.querySelector('.bms-comparison');
    if(table){table.hidden=!compared||names.length<2;table.querySelectorAll('[data-bms-column]').forEach(x=>{x.hidden=!names.includes(x.dataset.bmsColumn);});}
  }
  function render(updateUrl=false){
    views.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.bmsView===view)));
    document.querySelectorAll('[data-bms-panel]').forEach(x=>{x.hidden=x.dataset.bmsPanel!==view;});
    filters.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.bmsApp===application)));
    document.querySelectorAll('[data-bms-card],[data-bms-row]').forEach(x=>{x.hidden=application!=='all'&&x.dataset.application!==application;});
    updateComparison();
    if(updateUrl){const next=new URLSearchParams(location.search);if(view==='solutions')next.delete('view');else next.set('view',view);if(application==='all')next.delete('application');else next.set('application',application);history.replaceState(null,'',location.pathname+(next.size?'?'+next:'')+location.hash);}
  }
  views.forEach(x=>x.addEventListener('click',()=>{view=x.dataset.bmsView;render(true);}));
  filters.forEach(x=>x.addEventListener('click',()=>{application=x.dataset.bmsApp;render(true);}));
  checks.forEach(x=>x.addEventListener('change',updateComparison));
  document.querySelector('[data-bms-compare-open]')?.addEventListener('click',()=>{compared=true;updateComparison();document.querySelector('.bms-comparison')?.scrollIntoView({block:'nearest',behavior:'auto'});});
  addEventListener('popstate',()=>{const next=new URLSearchParams(location.search);view=next.get('view')==='engineering'?'engineering':'solutions';application=filters.some(x=>x.dataset.bmsApp===next.get('application'))?next.get('application'):'all';render();});
  document.addEventListener('site-language-changed',updateComparison);
  render();

})();

// Local media playback: no redirects or third-party players.
document.querySelectorAll('[data-video-play]').forEach(button=>{
 const video=button.parentElement.querySelector('video');
 button.addEventListener('click',async()=>{
  try { await video.play(); button.hidden=true; } catch(error) { button.hidden=false; }
 });
 video.addEventListener('play',()=>{ button.hidden=true; document.querySelectorAll('video').forEach(other=>{if(other!==video)other.pause();}); });
 video.addEventListener('ended',()=>{button.hidden=false;});
});

// Plain-language BMS diagram and immediate preliminary system selection.
(() => {
 const lang=()=>document.documentElement.lang==='en'?'en':'ru';
 const tr=(ru,en)=>lang()==='en'?en:ru;
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function svgLanguage(){document.querySelectorAll('[data-svg-ru]').forEach(node=>node.textContent=lang()==='en'?node.dataset.svgEn:node.dataset.svgRu);}
 document.querySelectorAll('[data-diagram-step]').forEach(button=>button.addEventListener('click',()=>{
  const key=button.dataset.diagramStep;
  document.querySelectorAll('[data-diagram-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('[data-diagram-note]').forEach(n=>n.hidden=n.dataset.diagramNote!==key);
  document.querySelectorAll('.bms-scene').forEach(n=>n.dataset.diagramStage=key);
 }));
 svgLanguage();document.addEventListener('site-language-changed',svgLanguage);
 const form=document.querySelector('.bms-live-selector');if(!form)return;
 const rules=JSON.parse(document.querySelector('[data-bms-selector-rules]').textContent);
 let lastResult=null,lastInput=null;
 const errors={input:['Введите целые положительные количества цепей и АКБ и допустимое напряжение.','Enter positive whole numbers for batteries and strings and a valid voltage.'],chemistry:['Для этого типа АКБ нужен индивидуальный подбор.','This battery chemistry needs an individual configuration.'],telecom:['Для телеком-системы 24/48 В проверьте число АКБ и напряжение. Например, 4 × 12 В = 48 В.','Check battery count and voltage for a 24/48 V telecom system. For example, 4 × 12 V = 48 V.'],selected:['Выбранный контроллер не проходит эти ограничения. Измените параметры или выберите автоматический подбор.','The selected controller does not meet these limits. Change the inputs or select automatic mode.'],limits:['Ни одна из четырёх систем не покрывает заданную схему. Нужен проект с другими исполнениями или несколькими контроллерами.','None of these four single-controller systems covers this layout. A project using other versions or multiple controllers is required.']};
 const label={controller:['Контроллер','Controller'],sensor:['Датчики АКБ','Battery sensors'],current:['Датчики тока цепи','String current sensors'],module:['Модули цепи','String modules'],hmi:['Панель HMI','HMI panel']};
 function read(){const fd=new FormData(form);return Object.fromEntries(['application','chemistry','protocol','model','voltage','blocks','strings'].map(k=>[k,String(fd.get(k)||'')]).concat([['hmi',fd.has('hmi')]]));}
 function render(){
  lastInput=read();lastResult=window.YellowBmsSizing.calculate(lastInput,rules);
  const summary=form.querySelector('[data-config-summary]'),output=form.querySelector('[data-config-output]'),download=form.querySelector('[data-config-download]');
  download.disabled=!lastResult.ok;
  if(!lastResult.ok){summary.textContent=tr(...errors[lastResult.reason]);summary.className='bms-config-warning';output.replaceChildren();return;}
  const c=lastResult.selected;
  summary.className='bms-config-success';summary.textContent=tr('Предварительный состав: YELLOW ','Preliminary configuration: YELLOW ')+c.id;
  const controllerPhoto = '<figure class="bms-photo bms-product-photo"><img src="/assets/bms/'+escape(c.slug)+'-yellow.png" alt="'+escape('YELLOW '+c.id)+'" loading="lazy"><figcaption>YELLOW '+escape(c.id)+'</figcaption></figure>';
  output.innerHTML=controllerPhoto+'<div class="bms-config-metrics"><div><strong>'+c.batteries+'</strong><span>'+tr('АКБ / датчиков','batteries / sensors')+'</span></div><div><strong>'+Number(lastInput.strings)+' × '+Number(lastInput.blocks)+'</strong><span>'+tr('цепей × АКБ','strings × batteries')+'</span></div><div><strong>'+Number(c.stringVoltage.toFixed(2))+' V</strong><span>'+tr('номинал цепи','nominal string voltage')+'</span></div></div><div class="bms-table-wrap"><table><thead><tr><th>'+tr('Оборудование','Equipment')+'</th><th>'+tr('Модель','Model')+'</th><th>'+tr('Количество','Quantity')+'</th></tr></thead><tbody>'+c.bom.map(row=>'<tr><td>'+tr(...label[row.kind])+'</td><td>'+escape(row.name==='Hall'?tr('Датчик Холла · диапазон по проекту','Hall sensor · rating as specified'):row.name)+'</td><td>'+row.count+'</td></tr>').join('')+'</tbody></table></div><p class="bms-caption">'+tr('Для BAT-Gate выбран вариант 4CL с датчиками BAT61. Контроллеры BMS9000 / Pro — в указанных каталожных исполнениях. Модули цепи для BMS2000 уточняются по исполнению. Максимальное напряжение при заряде обязательно проверяется отдельно.','BAT-Gate uses the 4CL version with BAT61 sensors. BMS9000 / Pro use the stated catalogue versions. String modules for BMS2000 depend on the selected version. Maximum charging voltage must be checked separately.')+'</p><div class="button-row"><a class="text-link" href="/bms/'+c.slug+'/">'+tr('Карточка '+c.id+' ↗',c.id+' product details ↗')+'</a><a class="text-link" href="/bms/#solutions">'+tr('Сравнить системы ↗','Compare systems ↗')+'</a></div>';
 }
 form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',render);
 form.addEventListener('change',e=>{if(e.target.name==='chemistry'){if(e.target.value==='nicd')form.elements.voltage.value='1.2';else if(Number(form.elements.voltage.value)===1.2)form.elements.voltage.value='12';}render();});
 document.querySelectorAll('[data-bms-kit]').forEach(button=>button.addEventListener('click',()=>{
  const d=button.dataset;form.elements.model.value=d.bmsKit;form.elements.blocks.value=d.kitBlocks;form.elements.strings.value=d.kitStrings;form.elements.chemistry.value=d.kitChemistry;form.elements.voltage.value=d.kitVoltage;form.elements.application.value=d.bmsKit==='BMS9000Pro'?'power':'dc';form.elements.hmi.checked=d.kitHmi==='true';render();form.scrollIntoView({block:'start',behavior:'smooth'});
 }));
 form.querySelector('[data-config-download]').addEventListener('click',()=>{
  if(!lastResult?.ok)return;
  const c=lastResult.selected;const lines=['YELLOW BMS',tr('Предварительный состав','Preliminary configuration'),c.id,'',tr('Батареи: ','Batteries: ')+lastInput.chemistry,tr('Напряжение АКБ: ','Battery voltage: ')+lastInput.voltage+' V',tr('Цепи × АКБ: ','Strings × batteries: ')+lastInput.strings+' × '+lastInput.blocks,tr('Номинальное напряжение цепи: ','Nominal string voltage: ')+c.stringVoltage+' V','',...c.bom.map(r=>r.count+' × '+(r.name==='Hall'?tr('Датчик Холла (диапазон уточнить)','Hall sensor (rating to confirm)'):r.name)),'',tr('Подтвердить максимальное напряжение при заряде, исполнения датчиков и модулей, токи, питание, кабели, корпус, HMI и лицензии. Это предварительный расчёт, а не окончательная спецификация.','Confirm maximum charging voltage, sensor/module versions, current ratings, power, cabling, enclosure, HMI and licences. This is a preliminary calculation, not a final specification.')];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='YELLOW-'+c.id+'-configuration.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 document.addEventListener('site-language-changed',render);render();
})();