'use strict';
function sizeLithiumBattery({power, hours, voltage, efficiency, dod, reserve}) {
  const values = [power, hours, voltage, efficiency, dod, reserve];
  if (!values.every(Number.isFinite) || power <= 0 || hours <= 0 || voltage <= 0 || efficiency <= 0 || efficiency > 100 || dod <= 0 || dod > 100 || reserve < 0) throw new RangeError('Invalid battery sizing inputs');
  const energy = power * hours / 1000;
  const nominal = energy * (1 + reserve / 100) / (efficiency / 100) / (dod / 100);
  const capacity = Math.ceil(nominal * 1000 / voltage);
  const current = power / (voltage * efficiency / 100);
  if (![energy, nominal, capacity, current].every(Number.isFinite)) throw new RangeError('Result out of range');
  return {energy, nominal, capacity, current};
}
if (typeof module !== 'undefined') module.exports = {sizeLithiumBattery};
if (typeof document !== 'undefined') {
  const form = document.querySelector('#lithium-form');
  if (form) {
    const render = () => {
      if (!form.checkValidity()) {
        document.querySelectorAll('.lithium-result output').forEach(output => { output.textContent = '—'; });
        return;
      }
      const result = sizeLithiumBattery(Object.fromEntries(Array.from(form.elements).filter(el => el.name).map(el => [el.name, Number(el.value)])));
      const locale = document.documentElement.lang === 'en' ? 'en-US' : 'ru-RU';
      for (const [key, value] of Object.entries(result)) document.querySelector('#lithium-' + key).textContent = value.toLocaleString(locale, {maximumFractionDigits: key === 'capacity' ? 0 : 2});
    };
    form.addEventListener('submit', event => {event.preventDefault(); render();});
    form.addEventListener('input', render);
    form.addEventListener('reset', () => setTimeout(render, 0));
    new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    render();
  }
}
