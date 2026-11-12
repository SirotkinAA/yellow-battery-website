"""Apply to a reviewed runtime-worker checkout after deploying the private service."""
import json
from pathlib import Path
import sys

root=Path(sys.argv[1])
entry=root/'worker_entry.py';source=entry.read_text()
assert 'DRAWINGS_SERVICE' not in source,'Proxy already configured'
needle="        if path == '/assets/vision/workbook-v2-5.json':"
assert needle in source,'Review changed Worker before adding proxy'
proxy='''        if path.startswith('/interconnects/api/drawing/'):
            if path.rsplit('/',1)[-1] not in ('pdf','dwg','dxf'):
                return reply({'error':'not_found'},404)
            if request.method!='POST':return reply({'error':'POST required'},405)
            supplied_origin=request.headers.get('Origin')
            if supplied_origin and supplied_origin!=origin:
                return reply({'error':'Origin rejected'},403)
            service=getattr(self.env,'DRAWINGS_SERVICE',None)
            if service is None:return reply({'error':'Сервис чертежей ещё не подключён'},503)
            try:return await service.fetch(request)
            except Exception:return reply({'error':'Сервис чертежей временно недоступен'},503)
'''
source=source.replace(needle,proxy+needle,1)
config=root/'wrangler.jsonc';data=json.loads(config.read_text())
services=data.setdefault('services',[])
assert not any(s['binding']=='DRAWINGS_SERVICE' for s in services)
services.append({'binding':'DRAWINGS_SERVICE','service':'yellow-drawings-test'})
data['assets']['run_worker_first'].append('/interconnects/api/drawing/*')
entry.write_text(source);config.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Prepared private drawing-service binding and same-origin route.')
