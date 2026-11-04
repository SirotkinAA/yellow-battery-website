'use strict';
function sizeVisionCabinets(models, input) {
  const {power, minutes, voltage, efficiency, dod, reserve, series = 'all'} = input;
  if (![power,minutes,voltage,efficiency,dod,reserve].every(Number.isFinite) || power <= 0 || minutes <= 0 || voltage <= 0 || efficiency <= 0 || efficiency > 100 || dod <= 0 || dod > 100 || reserve < 0) throw new RangeError('Invalid cabinet sizing inputs');
  const requiredEnergy = power * minutes / 60 / (efficiency / 100) / (dod / 100) * (1 + reserve / 100);
  const dcCurrent = power * 1000 / (voltage * efficiency / 100);
  const rows = models.filter(m => m.nominal_voltage === voltage && (!series || series === 'all' || m.series === series) && !m.notes.length).map(model => {
    const currentLimit = Math.min(model.capacity_ah * model.module_c_rate, model.bms_current_a);
    const energyCount = Math.ceil(requiredEnergy / model.energy_kwh - 1e-12);
    const currentCount = Math.ceil(dcCurrent / currentLimit - 1e-12);
    const count = Math.max(1, energyCount, currentCount);
    const totalEnergy = count * model.energy_kwh;
    const runtime = totalEnergy * (dod / 100) * (efficiency / 100) / (1 + reserve / 100) / power * 60;
    if (![count,totalEnergy,runtime].every(Number.isFinite)) throw new RangeError('Result out of range');
    return {model,count,totalEnergy,runtime,modules:count * model.modules,currentPerCabinet:dcCurrent/count,currentLimit,limiting:currentCount > energyCount ? 'current' : 'energy'};
  }).sort((a,b)=>a.count-b.count || a.totalEnergy-b.totalEnergy || a.model.id.localeCompare(b.model.id));
  if (!Number.isFinite(requiredEnergy) || !Number.isFinite(dcCurrent)) throw new RangeError('Result out of range');
  return {requiredEnergy,dcCurrent,rows};
}
if (typeof module !== 'undefined') module.exports = {sizeVisionCabinets};
if (typeof document !== 'undefined') {
  const form=document.querySelector('#vision-form');
  if (form) {
    const models=JSON.parse(document.querySelector('#vision-data').textContent).models;
    const result=document.querySelector('#vision-result');
    const render=()=>{
      const en=document.documentElement.lang==='en';
      const t=(ru,eng)=>en?eng:ru;
      const n=(value,digits=2)=>value.toLocaleString(en?'en-US':'ru-RU',{maximumFractionDigits:digits});
      if (!form.checkValidity()) {result.textContent=t('Введите значения в допустимых пределах.','Enter values within the allowed ranges.');return;}
      const values=Object.fromEntries(Array.from(form.elements).filter(el=>el.name).map(el=>[el.name,el.name==='series'?el.value:Number(el.value)]));
      const sized=sizeVisionCabinets(models,values);
      result.innerHTML=`<div class="vision-summary"><p>${t('Требуемая номинальная энергия','Required nominal energy')}<strong>${n(sized.requiredEnergy)} kWh</strong></p><p>${t('Расчётный DC-ток всей системы','Estimated total system DC current')}<strong>${n(sized.dcCurrent)} A</strong></p></div><h3>${t('Предварительные варианты','Preliminary options')}</h3><p>${t('Сравниваются комплектации с выбранным номинальным напряжением. Количество шкафов — оценка для дальнейшего проектирования.','Configurations at the selected nominal voltage are compared. Cabinet quantities are estimates for further engineering.')}</p>`;
      if (!sized.rows.length) {result.innerHTML+=`<p class="vision-empty">${t('Для этой серии и напряжения нет комплектаций без замечаний. Измените фильтры.','No configurations without source issues match this series and voltage. Change the filters.')}</p>`;return;}
      result.innerHTML+=`<div class="vision-table"><table><thead><tr>${[t('Модель','Model'),t('Шкафов','Cabinets'),t('Модулей','Modules'),t('Номинальная энергия','Nominal energy'),t('Автономия, оценка','Estimated runtime'),t('Ток на шкаф','Current per cabinet'),t('Состав решения','Solution components')].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${sized.rows.map(r=>`<tr><th scope="row"><a href="#${r.model.id.toLowerCase()}">${r.model.id}</a><small>${r.model.capacity_ah} Ah / ${r.model.module_c_rate}C</small></th><td>${n(r.count,0)}</td><td>${n(r.modules,0)}</td><td>${n(r.totalEnergy)} kWh</td><td>${n(r.runtime,1)} ${t('мин','min')}</td><td>${n(r.currentPerCabinet)} A<small>${t('предел оценки','estimate limit')}: ${r.currentLimit} A</small></td><td><details><summary>${t('Показать состав','Show components')}</summary><ul><li>${n(r.modules,0)} × ${r.model.module}</li><li>${n(r.count,0)} × ${r.model.rack}</li><li>${n(r.count,0)} × ${r.model.bms}</li><li>${n(r.count,0)} × ${r.model.gbms}</li></ul></details></td></tr>`).join('')}</tbody></table></div><p class="vision-calc-note">${t('Оценка токового предела получена из кратности модуля и номинала BMS в прайсе. Параллельная работа, реальные разрядные характеристики и совместимость с ИБП требуют подтверждения. TP100 и TPL60A исключены из расчёта из-за расхождений в источнике.','The current limit estimate uses module C-rate and the BMS rating in the source. Parallel operation, actual discharge performance and UPS compatibility require confirmation. TP100 and TPL60A are excluded due to source discrepancies.')}</p>`;
    };
    form.addEventListener('submit',e=>{e.preventDefault();render();});
    form.addEventListener('input',render);
    form.addEventListener('change',render);
    form.addEventListener('reset',()=>setTimeout(render,0));
    document.addEventListener('site-language-changed',render);
    render();
  }
}
