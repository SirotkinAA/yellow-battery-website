"""Shared request validation and embed rendering for WSGI and Workers."""
import json
import html
from .service import PortalError
from battery_calculator.core import CalculationError
from battery_calculator.__main__ import reject_constant, unique_object

HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}
PAGE_CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"

async def dispatch(portal,path,method,headers,body,ip):
    response_headers=dict(HEADERS)
    try:
        if len(body)>1_000_000:raise PortalError(413,'Запрос превышает 1 МБ')
        data={}
        if method not in ('GET','HEAD'):
            if headers.get('content-type','').split(';')[0].strip()!='application/json':raise PortalError(415,'Ожидается JSON')
            data=json.loads(body,parse_constant=reject_constant,object_pairs_hook=unique_object)
            if not isinstance(data,dict):raise PortalError(400,'Ожидается объект JSON')
        status,data,extra=await portal.handle(path,method,headers,data,ip)
        response_headers.update(extra)
    except PortalError as exc:status,data=exc.status,{'message':exc.message}
    except (ValueError,TypeError,KeyError,CalculationError) as exc:status,data=400,{'message':str(exc)[:1500]}
    return status,json.dumps(data,ensure_ascii=False,allow_nan=False).encode(),response_headers

def embedded_html(source,widget,site_origin):
    config=widget['config']
    # Stored config is validated before persistence; JSON is inert, never executable.
    encoded=json.dumps(config,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    source=source.replace('</head>','<script src="/runtime/embed.js" defer></script></head>')
    source=source.replace('<body>','<body class="embedded"><div id="embed-config" hidden>'+html.escape(encoded)+'</div>')
    # Same-origin preview in the authenticated portal; approved partner origins only.
    ancestors=' '.join([site_origin]+widget['origins'])
    return source,{**HEADERS,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors "+ancestors}

def public_calculation(response):
    """A public calculation must not double as an unauthenticated bulk export."""
    response=dict(response)
    snapshot=response.get('input_snapshot',{})
    response['input_snapshot']={'request':snapshot.get('request'), 'dataset':{'dataset_id':response.get('dataset_id'),'revision':response.get('dataset_revision'),'sha256':response.get('dataset_sha256')}}
    return response
