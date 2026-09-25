'use strict';
(() => {
  const languages = ['ru', 'en'];
  const storageGet = () => { try { return localStorage.getItem('yellow-site-language'); } catch { return null; } };
  function setLanguage(language) {
    if (!languages.includes(language)) language = 'ru';
    document.documentElement.lang = language;
    document.querySelectorAll('[data-lang]').forEach(el => { el.hidden = el.dataset.lang !== language; });
    document.querySelectorAll('[data-language]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.language === language)));
    try { localStorage.setItem('yellow-site-language', language); } catch {}
  }
  setLanguage(storageGet());
  document.querySelectorAll('[data-language]').forEach(el => el.addEventListener('click', () => setLanguage(el.dataset.language)));
  const menu = document.querySelector('.menu-button');
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open)); document.getElementById('site-nav').classList.toggle('is-open', open);
  });
  const form = document.getElementById('catalog-filters');
  if (!form) return;
  const cards = [...document.querySelectorAll('[data-product]')];
  const tabs = [...document.querySelectorAll('[data-series-filter]')];
  const params = new URLSearchParams(location.search);
  let series = tabs.some(el => el.dataset.seriesFilter === params.get('series')) ? params.get('series') : '';
  const search = document.getElementById('model-search'), min = document.getElementById('capacity-min'), max = document.getElementById('capacity-max');
  search.value = params.get('q') || ''; min.value = params.get('min') || ''; max.value = params.get('max') || '';
  const normalize = value => value.toLowerCase().replace(/[\s\-–]/g, '').replace(',', '.');
  function filter() {
    const q = normalize(search.value), low = min.value === '' ? 0 : Number(min.value), high = max.value === '' ? Infinity : Number(max.value);
    let count = 0;
    cards.forEach(card => { const capacity = Number(card.dataset.capacity); card.hidden = !((!series || card.dataset.series === series) && normalize(card.dataset.name).includes(q) && capacity >= low && capacity <= high); if (!card.hidden) count++; });
    tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.seriesFilter === series)));
    document.getElementById('product-count').textContent = count; document.getElementById('no-results').hidden = count !== 0;
    const next = new URLSearchParams(); if (series) next.set('series',series); if(search.value) next.set('q',search.value); if(min.value) next.set('min',min.value); if(max.value) next.set('max',max.value);
    history.replaceState(null, '', location.pathname + (next.size ? '?' + next : ''));
  }
  tabs.forEach(tab => tab.addEventListener('click', event => { event.preventDefault(); series = tab.dataset.seriesFilter; filter(); }));
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('reset', () => { series = ''; setTimeout(filter, 0); });
  filter();
})();
