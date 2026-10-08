(()=>{
 const search=document.getElementById('ready-rack-search'),variant=document.getElementById('ready-rack-case');
 if(!search)return;
 const rows=[...document.querySelectorAll('[data-catalog-row]')];
 function filter(){let count=0;const q=search.value.trim().toLowerCase();for(const row of rows){row.hidden=!(row.dataset.search.toLowerCase().includes(q)&&(!variant.value||row.dataset.case===variant.value));if(!row.hidden)count++;}document.getElementById('ready-rack-count').textContent=`Показано ${count} из ${rows.length}`;}
 search.addEventListener('input',filter);variant.addEventListener('change',filter);filter();
})();
