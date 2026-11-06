'use strict';
(() => {
 const slots=[...document.querySelectorAll('[data-price-model]')];
 if(!slots.length)return;
 let prices=new Map(),state='loading',generation=0;
 const english=()=>document.documentElement.lang==='en';
 const text=(ru,en)=>english()?en:ru;
 const element=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
 const basisEn={'FOB Ho Chi Minh; доставка и импортные платежи не включены':'FOB Ho Chi Minh; freight and import charges excluded','Доставка и налоги отдельно; условия поставки уточняются':'Shipping and taxes separate; delivery terms to be confirmed'};
 function draw(){
  for(const slot of slots){
   slot.replaceChildren();
   const price=prices.get(slot.dataset.priceModel);
   if(state==='ready'&&price){
    const label=element('span',text('Цена за 1 шт.','Price per battery'),'price-label');
    const value=element('strong',new Intl.NumberFormat(english()?'en-US':'ru-RU',{style:'currency',currency:price.currency,currencyDisplay:'code'}).format(price.amount_minor/100));
    const detail=element('small',text('По прайсу от ','Based on price list dated ')+price.price_date+'. '+(english()?(basisEn[price.basis]||price.basis):price.basis));
    slot.append(label,value,detail);
   }else if(state==='login'){
    const a=element('a',text('Войдите, чтобы увидеть цены →','Sign in to view prices →'));a.href='/admin/';slot.append(a);
   }else slot.append(element('small',state==='ready'?text('Цена по запросу','Price on request'):state==='denied'?text('Доступ к ценам выдаёт администратор','Price access is granted by the administrator'):state==='error'?text('Не удалось загрузить цены','Unable to load prices'):text('Проверка доступа к ценам…','Checking price access…')));
  }
 }
 async function refresh(){
  const request=++generation;prices.clear();state='loading';draw();
  try{
   const response=await fetch('/admin/api/prices',{credentials:'same-origin',cache:'no-store'});
   if(request!==generation)return;
   if(response.status===401)state='login';
   else if(response.status===403)state='denied';
   else if(!response.ok)state='error';
   else{const data=await response.json();if(request!==generation)return;prices=new Map(data.prices.map(p=>[p.model_id,p]));state='ready';}
  }catch{if(request===generation)state='error';}
  if(request===generation)draw();
 }
 document.addEventListener('site-language-changed',draw);
 // Discard privileged content before bfcache or a tab switch; revalidate on return.
 document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;prices.clear();state='loading';draw();}else refresh();});
 window.addEventListener('pagehide',()=>{generation++;prices.clear();state='loading';draw();});
 window.addEventListener('pageshow',refresh);
 setInterval(()=>{if(!document.hidden)refresh();},60000);
})();
