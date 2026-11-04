'use strict';
(() => {
  const language = () => document.documentElement.lang === 'en' ? 'en' : 'ru';
  const text = (ru,en) => language() === 'en' ? en : ru;
  const views=[...document.querySelectorAll('[data-bms-view]')], filters=[...document.querySelectorAll('[data-bms-app]')];
  const checks=[...document.querySelectorAll('[data-bms-compare]')];
  const params=new URLSearchParams(location.search);
  let view=views.some(x=>x.dataset.bmsView===params.get('view'))?params.get('view'):'solutions';
  let application=filters.some(x=>x.dataset.bmsApp===params.get('application'))?params.get('application'):'all';
  let compared=false;
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
  document.querySelectorAll('.bms-brief').forEach(form=>form.addEventListener('submit',event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const data=new FormData(form), get=name=>String(data.get(name)||'').trim();
    const content=[text('Задание на подбор BMS DFUN','DFUN BMS configuration brief'),'',text('Система: ','System: ')+get('model'),text('Тип батарей: ','Battery type: ')+get('chemistry'),text('Модель АКБ: ','Battery model: ')+get('battery'),text('Напряжение одной АКБ, В: ','Voltage per battery, V: ')+get('voltage'),text('Батарей в цепи: ','Batteries per string: ')+get('blocks'),text('Параллельных цепей: ','Parallel strings: ')+get('strings'),'',text('Диспетчеризация и требования:','Supervisory system and requirements:'),get('requirements')||text('Уточнить','To confirm'),'',text('Требуется проверка совместимости, питания, датчиков, кабелей и интерфейсов по выбранному исполнению.','Compatibility, power supplies, sensors, cables and interfaces must be checked for the selected hardware version.')].join('\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/plain;charset=utf-8'})), a=document.createElement('a');a.href=url;a.download='DFUN-'+get('model').replace(/[^a-zA-Z0-9-]/g,'')+'-brief.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    const status=form.querySelector('[data-brief-status]');status.textContent=text('Задание сохранено в файл. Передайте его специалисту для подбора комплектации.','Brief saved to a file. Share it with a specialist for equipment selection.');status.dataset.textRu='Задание сохранено в файл. Передайте его специалисту для подбора комплектации.';status.dataset.textEn='Brief saved to a file. Share it with a specialist for equipment selection.';
  }));
})();
