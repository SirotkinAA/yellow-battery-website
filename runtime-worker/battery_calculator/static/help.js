'use strict';
const helpContent={
  "operation": [
    "Выберите задачу: время работы заданной конфигурации, подбор по требуемому времени или подбор по ступенчатой нагрузке.",
    "Choose runtime for a fixed configuration, selection by required runtime, or sizing for a stepped load profile."
  ],
  "load": [
    "Постоянная мощность нагрузки. В кВт вводится активная мощность; в кВА — полная, для которой нужен коэффициент мощности.",
    "Constant load power. Enter active power in kW or apparent power in kVA, which also requires a power factor."
  ],
  "unit": [
    "кВт — активная мощность, кВА — полная. При выборе кВт коэффициент мощности не участвует в расчёте.",
    "kW is active power; kVA is apparent power. Power factor is ignored when kW is selected."
  ],
  "efficiency_percent": [
    "КПД преобразования энергии ИБП при вашей нагрузке, в процентах. Например, 93 означает 93%, а не 0,93. Берётся из документации ИБП.",
    "UPS conversion efficiency at your load, as a percentage. Enter 93 for 93%, not 0.93. Use the UPS documentation."
  ],
  "power_factor": [
    "Отношение активной мощности к полной: от 0 до 1, исключая 0. Используется только для кВА; берётся из характеристик нагрузки.",
    "Active power divided by apparent power: above 0 and no higher than 1. Used only with kVA; use the load specifications."
  ],
  "series_batteries": [
    "Число последовательно соединённых батарей в одной линейке. Для батарей 12 В: 20 штук дают номинально 240 В. Проверьте требования ИБП.",
    "Number of batteries connected in series in one string. With 12 V batteries, 20 batteries give a nominal 240 V. Check the UPS requirements."
  ],
  "end_voltage_v_cell": [
    "Напряжение окончания разряда одного элемента, а не всей батареи. В батарее 12 В шесть элементов: 1,80 В/элемент соответствует 10,8 В на батарею. Расчёт требует таблицу именно для выбранного напряжения.",
    "End-of-discharge voltage of one cell, not the entire battery. A 12 V battery has six cells: 1.80 V/cell equals 10.8 V per battery. A table at exactly this voltage is required."
  ],
  "parallel_strings": [
    "Число одинаковых линеек, соединённых параллельно. Предполагается равномерное распределение тока между ними.",
    "Number of identical strings connected in parallel. Equal current sharing between strings is assumed."
  ],
  "required_minutes": [
    "Целевое время автономии в минутах. Подбор рассматривает варианты в диапазоне ±20% и отдельно отмечает те, которые не достигают цели.",
    "Target runtime in minutes. Selection considers options within ±20% and separately identifies options below the target."
  ],
  "max_parallel_strings": [
    "Максимальное число параллельных линеек для подбора. По умолчанию 5. Допустимость конфигурации зависит от ИБП, батарей и соединений.",
    "Maximum number of parallel strings to consider. Default: 5. Suitability depends on the UPS, batteries, and connections."
  ],
  "age_factor": [
    "Множитель требуемой ёмкости для учёта старения. 1 — без поправки; 1,25 соответствует расчётному запасу для остаточной ёмкости 80%. Это не прогноз срока службы.",
    "Required-capacity multiplier for ageing. 1 means no adjustment; 1.25 provides capacity margin for 80% remaining capacity. This is not a service-life prediction."
  ],
  "reserve_factor": [
    "Дополнительный проектный запас по ёмкости. 1 — без запаса; 1,10 — запас 10%. Коэффициент применяется один раз.",
    "Additional design capacity margin. 1 means no margin; 1.10 means 10% margin. Applied once."
  ],
  "duration_minutes": [
    "Продолжительность этого этапа в минутах, больше нуля. Этапы выполняются сверху вниз. Все расчётные интервалы должны укладываться в разрядную таблицу.",
    "Duration of this stage in minutes, above zero. Stages run from top to bottom. All calculation intervals must fit within the discharge table."
  ],
  "language": [
    "Язык подписей, подсказок и результатов. Выбор сохраняется в этом браузере и не меняет исходные числа.",
    "Language of labels, tooltips, and results. The choice is saved in this browser and does not change the input values."
  ]
};
let helpId=0;
function installHelp(){
 for(const field of document.querySelectorAll('input,select')){
  if(field.dataset.helpInstalled)continue;
  const key=field.name||field.dataset.key||field.id;
  if(!helpContent[key])continue;
  const label=field.closest('label');if(!label)continue;
  if(!field.id)field.id='input-'+key+'-'+(helpId+1);label.htmlFor=field.id;
  const group=document.createElement('span');group.className='field-help';
  const button=document.createElement('button');button.type='button';button.className='help-button';button.textContent='?';
  const tip=document.createElement('span');tip.className='help-tooltip';tip.id='field-help-'+(++helpId);tip.setAttribute('role','tooltip');
  button.setAttribute('aria-controls',tip.id);button.setAttribute('aria-expanded','false');field.setAttribute('aria-describedby',tip.id);
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const open=group.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});
  button.addEventListener('keydown',event=>{if(event.key==='Escape'){group.classList.remove('open');button.setAttribute('aria-expanded','false');button.blur();}});
  group.dataset.helpKey=key;group.append(button,tip);label.insertBefore(group,field);field.dataset.helpInstalled='true';
 }
 refreshHelp();
}
function refreshHelp(){for(const group of document.querySelectorAll('.field-help')){const key=group.dataset.helpKey;group.querySelector('.help-tooltip').textContent=helpContent[key][language==='ru'?0:1];group.querySelector('button').setAttribute('aria-label',language==='ru'?'Справка по полю':'Field help');}}
new MutationObserver(installHelp).observe(document.getElementById('stages'),{childList:true});
document.getElementById('language').addEventListener('change',refreshHelp);
document.addEventListener('click',event=>{for(const group of document.querySelectorAll('.field-help.open'))if(!group.contains(event.target)){group.classList.remove('open');group.querySelector('button').setAttribute('aria-expanded','false');}});
installHelp();
