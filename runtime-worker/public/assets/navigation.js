/* Shared public navigation: calculator and catalogue use the same shell. */
'use strict';
(() => {
  const labels = {
    'lead-acid':['Свинцовые решения','Lead-acid solutions'], calculators:['Калькуляторы','Calculators'], lithium:['Литиевые решения','Lithium solutions'], catalog:['Каталог','Catalogue'], applications:['Применение','Applications'],
    documents:['Документация','Documents'], runtime:['Калькулятор свинцовых АКБ','Lead-acid calculator'],
    knowledge:['База знаний','Knowledge base'], racks:['Стеллажи','Racks'], bms:['BMS','BMS'], partners:['Партнёрам','Partners'],
    about:['О YELLOW','About YELLOW'], contacts:['Контакты','Contact'],
    '404':['Страница не найдена','Page not found']
  };
  const parts=location.pathname.split('/').filter(Boolean);
  const section=parts[0] || '';
  if(section==='runtime')document.body.classList.add('calculator-page');
  const text=(ru,en)=>`<span data-lang="ru">${ru}</span><span data-lang="en" hidden>${en}</span>`;
  const header=document.querySelector('header');
  if (!header) return;
  header.className='site-header';
  header.innerHTML=`<a class="logo" href="/" aria-label="YELLOW"><img src="/assets/yellow.svg" alt="YELLOW" width="180" height="32"></a>
    <button type="button" class="menu-button" aria-expanded="false" aria-controls="site-nav">${text('Меню','Menu')} ☰</button>
    <nav id="site-nav" aria-label="Основная навигация">${[
      ['/catalog/','Свинцовые решения','Lead-acid', ['lead-acid','catalog','runtime','racks','bms','cabinets','documents'].includes(section)],
      ['/lithium/','Литиевые решения','Lithium',section==='lithium'],
      ['/calculators/','Калькуляторы','Calculators',section==='calculators'],
      ['/about/','О YELLOW','About YELLOW',section==='about'],
      ['/contacts/','Контакты','Contact',section==='contacts']
    ].map(([url,ru,en,active])=>`<a href="${url}"${active?' class="current"':''}>${text(ru,en)}</a>`).join('')}</nav>
    <div id="language" class="language" role="group" aria-label="Язык"><button type="button" data-language="en" lang="en" aria-pressed="false">EN</button><button type="button" data-language="ru" lang="ru" aria-pressed="true">RU</button></div>
    <a href="/admin/" class="account-link">${text('Кабинет ↗','Account ↗')}</a>`;
  const lead=['lead-acid','catalog','runtime','racks','bms','cabinets','documents'].includes(section);
  if(lead || section==='lithium'){
    const bar=document.createElement('div');bar.className='direction-nav';
    const links=lead?[
      ['/catalog/','Каталог AGM','AGM catalogue'],['/runtime/','Калькулятор свинцовых АКБ','Lead-acid calculator'],
      ['/racks/','Стеллажи','Racks'],['/bms/','BMS для свинцовых АКБ','Lead-acid BMS'],['/documents/','Документация AGM','AGM documents']
    ]:[['/lithium/#vision-catalog','Каталог решений','Solutions catalogue'],['/lithium/#battery-calculator','Литиевый калькулятор','Lithium calculator'],['/lithium/#lithium-documents','Документация','Documents']];
    bar.innerHTML=`<strong>${text(lead?'Свинцовые АКБ':'Литиевые решения',lead?'Lead-acid batteries':'Lithium solutions')}</strong>`+links.map(([url,ru,en])=>`<a href="${url}"${url.includes('calculator')||url==='/runtime/'?' class="calculator-shortcut"':''}>${text(ru,en)}</a>`).join('');
    header.after(bar);
  }
  if(!document.querySelector('.test-strip')){
    const strip=document.createElement('div');strip.className='test-strip';strip.innerHTML=text('YELLOW / Предварительная версия сайта','YELLOW / Website preview');header.before(strip);
  }
  const main=document.querySelector('main');
  if(main && parts.length){
    document.querySelectorAll('.breadcrumb').forEach(el=>el.remove());
    const crumb=document.createElement('nav');crumb.className='site-breadcrumb';crumb.setAttribute('aria-label','Хлебные крошки');
    const list=document.createElement('ol');crumb.append(list);
    const add=(url,ru,en)=>{const li=document.createElement('li');const el=document.createElement(url?'a':'span');if(url)el.href=url;else el.setAttribute('aria-current','page');el.innerHTML=text(ru,en);li.append(el);list.append(li);};
    const escape=value=>{const el=document.createElement('span');el.textContent=value;return el.innerHTML;};
    add('/','Главная','Home');
    if(parts.length>1 && labels[section])add('/'+section+'/',...labels[section]);
    if(section==='catalog' && parts.length>1){
      const series=document.querySelector('.product-detail .eyebrow')?.textContent.split('/')[0].trim();
      if(series)add('/catalog/?series='+encodeURIComponent(series),escape(series),escape(series));
    }
    const heading=main.querySelector('h1');
    const title=heading?.textContent.trim() || document.title.split(' — ')[0];
    const ru=heading?.querySelector('[data-lang="ru"]')?.textContent.trim() || title;
    const en=heading?.querySelector('[data-lang="en"]')?.textContent.trim() || title;
    add(null,...(parts.length===1 && labels[section]?labels[section]:[escape(ru),escape(en)]));
    main.prepend(crumb);
  }
  if(section==='runtime' || location.pathname.startsWith('/embed/')){
    const menu=header.querySelector('.menu-button');
    menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));header.querySelector('nav').classList.toggle('is-open',open);});
  }
})();
