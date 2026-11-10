(() => {
 const main=document.querySelector('main');
 if(!main||location.origin!=='https://test.yellow-battery.com')return;
 const portal='https://sstmk-portal-test.sysadws.workers.dev/feedback/';
 const dialog=document.createElement('dialog');
 dialog.className='vision-help-dialog';
 dialog.setAttribute('aria-labelledby','site-feedback-title');
 dialog.innerHTML=`
  <form method="dialog"><button class="vision-help-close" aria-label="Закрыть">×</button></form>
  <h2 id="site-feedback-title">Сообщить об ошибке</h2>
  <form id="site-feedback-form">
   <p>Выделите текст на странице перед открытием формы или вставьте его сюда.</p>
   <label>Фрагмент<textarea name="excerpt" rows="3" maxlength="1200" required></textarea></label>
   <label>Что нужно исправить?<textarea name="comment" rows="4" maxlength="2000" required></textarea></label>
   <p>В корппортале можно проверить замечание перед отправкой.</p>
   <button class="button dark">Продолжить в корппортале</button>
  </form>`;
 const stylesheet=document.createElement('link');
 stylesheet.rel='stylesheet';
 stylesheet.href='/assets/site-feedback.css';
 document.head.append(stylesheet);
 document.body.append(dialog);
 const form=dialog.querySelector('#site-feedback-form');
 let excerpt='';
 function capture(){
  const selection=window.getSelection();
  if(!selection?.rangeCount||selection.isCollapsed)return;
  const source=selection.getRangeAt(0).commonAncestorContainer;
  if(main.contains(source)||source.parentElement?.closest('dialog.vision-help-dialog')){
   excerpt=selection.toString().trim().slice(0,1200);
  }
 }
 document.addEventListener('selectionchange',capture);
 function open(){
  capture();
  if(excerpt)form.elements.excerpt.value=excerpt;
  excerpt='';
  const currentHelp=document.querySelector('dialog.vision-help-dialog[open]');
  if(currentHelp&&currentHelp!==dialog)currentHelp.close();
  dialog.showModal();
 }
 function launcher(){
  const button=document.createElement('button');
  button.type='button';
  button.className='button outline site-feedback-launch';
  button.textContent='Сообщить об ошибке';
  button.addEventListener('pointerdown',capture);
  button.addEventListener('click',open);
  return button;
 }
 const slot=document.createElement('div');
 slot.className='wrap';
 slot.append(launcher());
 main.prepend(slot);
 const help=document.querySelector('dialog.vision-help-dialog:not([aria-labelledby="site-feedback-title"])');
 if(help)help.append(launcher());
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const fragment=form.elements.excerpt.value.trim(),comment=form.elements.comment.value.trim();
  if(!fragment||!comment)return;
  const draft={id:crypto.randomUUID(),pageUrl:location.origin+location.pathname+location.hash,excerpt:fragment,comment};
  location.assign(portal+'#'+new URLSearchParams({draft:JSON.stringify(draft)}));
 });
})();
