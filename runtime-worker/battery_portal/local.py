import asyncio
from pathlib import Path
from urllib.parse import urlsplit
from .storage import SQLiteStore
from .service import Portal,PortalError
from .transport import dispatch,embedded_html,PAGE_CSP,HEADERS

STORE=None

def store():
    global STORE
    if STORE is None:
        root=Path(__file__).resolve().parents[1]/'.local'
        root.mkdir(exist_ok=True)
        STORE=SQLiteStore(root/'portal.sqlite')
        (root/'portal.sqlite').chmod(0o600)
    return STORE

def portal_for(environ,dataset):
    host=environ.get('HTTP_HOST','127.0.0.1:8085')
    # This development transport binds to loopback only; no public Host trust.
    if not host.startswith(('127.0.0.1:','localhost:')):raise PortalError(400,'Локальный сервер доступен только через localhost')
    return Portal(store(),dataset,'http://'+host,secure=False)

def serve(environ,start_response,dataset,calculator_html):
    path=environ.get('PATH_INFO','');method=environ.get('REQUEST_METHOD','GET');portal=portal_for(environ,dataset)
    headers={k[5:].lower().replace('_','-'):v for k,v in environ.items() if k.startswith('HTTP_')}
    headers['content-type']=environ.get('CONTENT_TYPE','')
    static=Path(__file__).with_name('static')
    assets={'/admin/':('index.html','text/html; charset=utf-8'),'/admin':('index.html','text/html; charset=utf-8'),'/admin/app.js':('app.js','text/javascript; charset=utf-8'),'/admin/style.css':('style.css','text/css; charset=utf-8')}
    if path in assets and method in ('GET','HEAD'):
        filename,mime=assets[path];body=(static/filename).read_bytes();status=200;out={**HEADERS,'Content-Type':mime,'Content-Security-Policy':PAGE_CSP}
    elif path.startswith('/embed/') and method=='GET':
        try:
            widget=asyncio.run(portal.widget(path.removeprefix('/embed/')))
            text,out=embedded_html(calculator_html,widget,portal.origin);body=text.encode();status=200
        except PortalError as exc:status=exc.status;body=exc.message.encode();out=dict(HEADERS)
    else:
        length=int(environ.get('CONTENT_LENGTH') or 0)
        if length>1_000_000:status,body,out=413,b'{"message":"Request too large"}',dict(HEADERS)
        else:status,body,out=asyncio.run(dispatch(portal,path,method,headers,environ['wsgi.input'].read(length),environ.get('REMOTE_ADDR','unknown')))
    reasons={200:'OK',400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',409:'Conflict',413:'Payload Too Large',415:'Unsupported Media Type',429:'Too Many Requests'}
    start_response(str(status)+' '+reasons.get(status,'Error'),list(out.items())+[('Content-Length',str(len(body)))])
    return [body if method!='HEAD' else b'']
