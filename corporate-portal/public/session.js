(async()=>{
 const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok){location.replace('/auth/');return;}
 const {user}=await response.json(),bar=document.createElement('div');
 bar.style.cssText='position:fixed;bottom:16px;right:20px;z-index:10000;display:flex;gap:14px;align-items:center;background:#fff;border:1px solid #ccd9df;border-radius:8px;padding:10px 16px;font:13px system-ui;box-shadow:0 4px 15px #0001';
 const label=document.createElement('span');label.textContent=user.name+' · '+user.email;bar.append(label);
 if(user.roles.includes('admin')){const link=document.createElement('a');link.href='/employees/';link.textContent='Сотрудники';bar.append(link);}
 const logout=document.createElement('button');logout.textContent='Выйти';logout.onclick=async()=>{logout.disabled=true;try{const r=await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(r.ok)location.replace('/auth/');else throw Error();}catch{logout.disabled=false;logout.textContent='Повторить выход';}};bar.append(logout);document.body.append(bar);
})().catch(()=>{});
