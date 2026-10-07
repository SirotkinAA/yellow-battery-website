(()=>{
 const pdf=document.querySelector('[data-card-pdf]');
 function updatePdf(){if(!pdf)return;const lang=document.documentElement.lang==='en'?'en':'ru';pdf.href=pdf.dataset['pdf'+(lang==='en'?'En':'Ru')];pdf.download=pdf.href.split('/').pop();}
 updatePdf();document.addEventListener('site-language-changed',updatePdf);
 document.querySelector('[data-print-card]')?.addEventListener('click',()=>{
  document.querySelector('[data-print-help]').hidden=false;
  try{window.print();}catch(error){/* The PDF link remains usable in browsers without print support. */}
 });
 for(const img of document.querySelectorAll('.alpha-picture img')){
  const fail=()=>{img.closest('figure').querySelector('.alpha-image-error').hidden=false;img.parentElement.hidden=true;};
  img.addEventListener('error',fail);if(img.complete&&!img.naturalWidth)fail();
 }
})();
