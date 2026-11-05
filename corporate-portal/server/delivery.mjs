// Provider secrets are Worker secrets, never browser settings. Do not log payloads.
export function delivery(env,fetcher=fetch){
 const ready=!!(env.UNISENDER_GO_KEY&&env.MAIL_FROM&&env.SMS_RU_KEY);
 async function post(url,options){const r=await fetcher(url,{...options,method:'POST',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('delivery_failed');return r.json();}
 return {ready,
  async email(to,subject,text){
   if(!ready)throw Error('delivery_not_configured');
   const value=await post('https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json',{
    headers:{'Content-Type':'application/json','X-API-KEY':env.UNISENDER_GO_KEY},
    body:JSON.stringify({message:{recipients:[{email:to}],subject,from_email:env.MAIL_FROM,from_name:'Корпоративный портал',body:{plaintext:text}}})
   });
   if(value.status!=='success')throw Error('delivery_failed');
  },
  async sms(to,text){
   if(!ready)throw Error('delivery_not_configured');
   const number=to.replace(/^\+/,''),body=new URLSearchParams({api_id:env.SMS_RU_KEY,to:number,msg:text,json:'1'});
   if(env.SMS_SENDER)body.set('from',env.SMS_SENDER);
   const value=await post('https://sms.ru/sms/send',{headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
   if(value.status!=='OK'||value.sms?.[number]?.status!=='OK')throw Error('delivery_failed');
  }
 };
}
