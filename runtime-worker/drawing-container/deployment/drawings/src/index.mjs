import { DurableObject } from 'cloudflare:workers';

export class DrawingContainer extends DurableObject {
  starting;
  monitoring;
  constructor(ctx, env) {
    super(ctx, env);
    if (ctx.container?.running) {
      ctx.blockConcurrencyWhile(() => ctx.container.setInactivityTimeout(60000));
      this.observeExit();
    }
  }
  observeExit() {
    if (this.monitoring) return;
    this.monitoring = this.ctx.container.monitor().catch(() => {}).finally(() => { this.monitoring = undefined; });
    this.ctx.waitUntil(this.monitoring);
  }
  async ready() {
    const c=this.ctx.container;
    if (!c.running) c.start({image:c.images.base,instance:'basic',enableInternet:false});
    this.observeExit();
    await c.setInactivityTimeout(60000);
    const port=c.getTcpPort(8080);
    const deadline=Date.now()+90000;
    while(Date.now()<deadline) {
      try {
        const r=await port.fetch('http://container/health',{signal:AbortSignal.timeout(1000)});
        await r.body?.cancel();
        if(r.ok)return;
      } catch {}
      await scheduler.wait(200);
    }
    throw Error('Container readiness timeout');
  }
  async fetch(request) {
    this.starting ??= this.ready().finally(()=>{this.starting=undefined;});
    await this.starting;
    const u=new URL(request.url);u.protocol='http:';u.host='container';
    const forwarded=new Request(u,request);forwarded.headers.delete('host');
    return this.ctx.container.getTcpPort(8080).fetch(forwarded);
  }
}
const json=(message,status)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
export default {
  async fetch(request,env) {
    const u=new URL(request.url);
    if(!/^\/interconnects\/api\/drawing\/(pdf|dwg|dxf)$/.test(u.pathname))return json('not_found',404);
    if(request.method!=='POST')return json('POST required',405);
    if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return json('JSON required',415);
    // Private service binding only. Never publish a public workers.dev URL for this service.
    const reader=request.body?.getReader();if(!reader)return json('body_required',400);
    const chunks=[];let size=0;
    try {
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();return json('body_size',413);}chunks.push(value);}
      if(!size)return json('body_required',400);
      const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
      const forwarded=new Request('http://container'+u.pathname,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':String(size)},body});
      return await env.DRAWINGS.getByName('yellow-drawings-test-singleton').fetch(forwarded);
    } catch {return json('Сервис чертежей временно недоступен. Повторите запрос.',503);}
  }
};
