const statusLine=document.querySelector('#status');
const form=document.querySelector('#draft');
const draftKey='yellow-site-feedback-draft';
let draft;

function loadDraft(){
 const incoming=new URLSearchParams(location.hash.slice(1)).get('draft');
 if(incoming)history.replaceState(null,'',location.pathname);
 try{
  const value=JSON.parse(incoming||sessionStorage.getItem(draftKey));
  const page=new URL(value.pageUrl);
  if(page.origin!=='https://test.yellow-battery.com'||!page.pathname.startsWith('/lithium/'))return;
  if(typeof value.excerpt!=='string'||typeof value.comment!=='string'||typeof value.id!=='string')return;
  sessionStorage.setItem(draftKey,JSON.stringify(value));
  return value;
 }catch{return;}
}
function showDraft(){
 const source=document.querySelector('#source');
 source.href=draft.pageUrl;
 source.textContent=draft.pageUrl;
 form.elements.excerpt.value=draft.excerpt;
 form.elements.comment.value=draft.comment;
 form.hidden=false;
}
function loginRequired(){
 statusLine.textContent='Войдите, чтобы отправить замечание или открыть журнал.';
 document.querySelector('#login').hidden=false;
}
async function listReports(){
 const response=await fetch('/api/feedback');
 if(!response.ok)throw Error('Не удалось загрузить журнал.');
 const {items}=await response.json();
 const list=document.querySelector('#items');
 list.replaceChildren();
 document.querySelector('#journal').hidden=false;
 if(!items.length)list.textContent='Замечаний пока нет.';
 for(const item of items){
  const article=document.createElement('article');
  const meta=document.createElement('p');
  meta.textContent=item.author+' · '+new Date(item.createdAt).toLocaleString('ru-RU');
  const source=document.createElement('a');
  source.href=item.pageUrl;
  source.textContent=item.pageUrl;
  const excerpt=document.createElement('blockquote');
  excerpt.textContent=item.excerpt;
  const comment=document.createElement('p');
  comment.textContent=item.comment;
  article.append(meta,source,excerpt,comment);
  list.append(article);
 }
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const fields=new FormData(form);
 draft={...draft,excerpt:fields.get('excerpt').trim(),comment:fields.get('comment').trim()};
 if(!draft.excerpt||!draft.comment){statusLine.textContent='Заполните фрагмент и комментарий.';return;}
 sessionStorage.setItem(draftKey,JSON.stringify(draft));
 event.submitter.disabled=true;
 try{
  const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
  if(response.status===401){loginRequired();return;}
  if(!response.ok)throw Error('Не удалось отправить замечание. Черновик сохранён.');
  sessionStorage.removeItem(draftKey);
  form.hidden=true;
  statusLine.textContent='Замечание отправлено.';
  if(!document.querySelector('#journal').hidden)await listReports();
 }catch(error){statusLine.textContent=error.message;}
 finally{event.submitter.disabled=false;}
});
(async()=>{
 draft=loadDraft();
 const response=await fetch('/api/auth/me');
 if(response.status===401){loginRequired();return;}
 if(!response.ok)throw Error('Не удалось проверить вход в портал.');
 const {user}=await response.json();
 if(draft)showDraft();
 if(user.roles.includes('admin'))await listReports();
 else if(!draft)statusLine.textContent='Чтобы оставить замечание, выделите фрагмент на тестовом сайте.';
})().catch(error=>{statusLine.textContent=error.message;});
