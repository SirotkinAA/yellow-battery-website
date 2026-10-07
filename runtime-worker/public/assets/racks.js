(() => {
  const host = document.querySelector('[data-rack-catalog]');
  if (!host) return;
  const configs = JSON.parse(host.dataset.rackCatalog).configurations;
  const family=document.getElementById('rack-family');
  for(const f of new Set(configs.map(r=>r.family))){const o=document.createElement('option');o.value=f;o.textContent=f;family.append(o);}
  const length = document.getElementById('rack-length');
  const variant = document.getElementById('rack-case');
  const result = document.getElementById('rack-result');
  const fmt = n => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(n);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render() {
    const r = configs.find(c => c.family===family.value && c.dimensions_mm[0] === Number(length.value) && c.load_case === variant.value);
    if (!r) { result.textContent = 'Для этого сочетания нет проверенного эталона.'; return; }
    const sum = r.bom.some(b => b.package_mass_kg == null) ? null : r.bom.reduce((s,b) => s+b.package_quantity*b.package_mass_kg,0);
    let x = 55;
    const scale = 590 / r.dimensions_mm[0];
    let sections = '', frames = '<path d="M55 45V185"/>';
    for (const span of r.sections_nominal_mm) {
      const next = x+span*scale;
      sections += `<path d="M${x} 60H${next} M${x} 160H${next}"/><text x="${(x+next)/2}" y="215">${fmt(span)} мм</text>`;
      frames += `<path d="M${next} 45V185"/>`; x = next;
    }
    result.innerHTML = `<h2>${escape(r.article)} <span class="rack-tag">${r.load_case === 'H' ? 'Исполнение H' : 'Обычное исполнение'}</span></h2>
      <div class="rack-metrics"><div><small>Габариты</small><strong>${r.dimensions_mm.map(fmt).join(' × ')} мм</strong></div><div><small>Рамы / опоры на плане</small><strong>${r.frame_count} / ${r.footprint_support_count}</strong></div><div><small>Масса по карточке</small><strong>${fmt(r.displayed_mass_kg)} кг</strong></div></div>
      <svg viewBox="0 0 700 245" role="img" aria-label="Схема: ${r.frame_count} рамы, секции ${r.sections_nominal_mm.join(' и ')} мм"><g class="rack-rails">${sections}</g><g class="rack-frames">${frames}</g></svg>
      <p><a href="/racks/catalog/${escape(r.article.toLowerCase())}/" target="_blank" rel="noopener">Полная карточка : данные, чертежи и фото ↗</a></p><h3>Состав комплекта</h3><div class="rack-table"><table><thead><tr><th>Артикул</th><th>Профиль</th><th>Упаковок</th><th>Основных деталей*</th><th>Масса строки</th></tr></thead><tbody>${r.bom.map(b => `<tr><td>${window.RackComponents?.[b.article]?`<a href="${window.RackComponents[b.article].url}" target="_blank" rel="noopener" data-component="${escape(b.article)}">${escape(b.article)} ↗</a>`:escape(b.article)}</td><td>${escape(b.profile || 'Рама')}</td><td>${fmt(b.package_quantity)}</td><td>${fmt(b.package_quantity*b.units_per_package)}</td><td>${b.package_mass_kg == null ? 'Неизвестно' : fmt(b.package_quantity*b.package_mass_kg)+' кг'}</td></tr>`).join('')}</tbody></table></div>
      <p>* Количество пересчитано из упаковок. Вложенный крепёж в этой таблице не раскрыт.</p>
      <p class="${sum !== null && Math.abs(sum-r.displayed_mass_kg)>.001 ? 'rack-notice' : ''}">Сумма BOM: ${sum == null ? 'неизвестна' : fmt(sum)+' кг'}.${sum !== null && Math.abs(sum-r.displayed_mass_kg)>.001 ? ' Расходится с массой карточки на '+fmt(r.displayed_mass_kg-sum)+' кг; причина не установлена.' : ''}</p>`;
    document.dispatchEvent(new CustomEvent('rack-reference-selected',{detail:r}));
  }
  family.addEventListener('change',()=>{const rows=configs.filter(r=>r.family===family.value);length.replaceChildren(...[...new Set(rows.map(r=>r.dimensions_mm[0]))].sort((a,b)=>a-b).map(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;return o;}));variant.value=rows[0].load_case;render();});
  length.addEventListener('change',render); variant.addEventListener('change',render); render();
})();
