/* Shared public navigation: calculator and catalogue use the same shell. */
'use strict';
(() => {
  const labels = {
    catalog:['Каталог','Catalogue'], applications:['Применение','Applications'],
    documents:['Документация','Documents'], runtime:['Калькулятор','Calculator'],
    racks:['Стеллажи','Racks'], partners:['Партнёрам','Partners'],
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
    <nav id="site-nav" aria-label="Основная навигация">${['catalog','applications','documents','runtime','partners'].map(key=>`<a href="/${key}/"${section===key?' class="current" aria-current="page"':''}>${text(...labels[key])}</a>`).join('')}</nav>
    <div id="language" class="language" role="group" aria-label="Язык"><button type="button" data-language="en" lang="en" aria-pressed="false">EN</button><button type="button" data-language="ru" lang="ru" aria-pressed="true">RU</button></div>
    <a href="/admin/" class="account-link">${text('Кабинет ↗','Account ↗')}</a>`;
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
