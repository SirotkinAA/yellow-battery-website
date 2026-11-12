"""Cloudflare transport for the unchanged Python calculation core."""
import json
from urllib.parse import urlsplit,parse_qs

from workers import WorkerEntrypoint, Response
from js import Request
from battery_portal.service import Portal,PortalError
from battery_portal.storage import D1Store
from battery_portal.transport import dispatch,embedded_html,public_calculation,PAGE_CSP
from battery_calculator.core import CalculationError
from battery_calculator.io import execute
from battery_calculator.__main__ import reject_constant, unique_object
from catalog_data import DATASET
from shared_catalog import catalogue
from unified_catalog import dataset_api,Catalogue
from yellow_catalog import DATA_SCRIPTS,CATALOGUE_PATHS,data_script,render_page,shelf_script
from battery_calculator.catalog import catalog_summary, example_requests

HEADERS = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
           "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff"}


def reply(data, status=200):
    return Response(json.dumps(data, ensure_ascii=False, allow_nan=False), status=status, headers=HEADERS)


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url=urlsplit(request.url)
        path=url.path
        origin=url.scheme+'://'+url.netloc
        binding=getattr(self.env,'PORTAL_DB',None)
        portal=Portal(D1Store(binding),None,origin) if binding else None
        if path.startswith('/interconnects/api/drawing/'):
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
        if path == '/assets/vision/workbook-v2-5.json':
            if request.method not in ('GET','HEAD'):return reply({'error':'method_not_allowed'},405)
            if not binding:return reply({'error':'catalogue_unavailable'},503)
            try:
                query=parse_qs(url.query)
                revision,workbook=await Catalogue(D1Store(binding)).record('yellow','vision-workbook','active',query.get('catalog_release',[None])[0])
                if workbook is None:return reply({'error':'catalogue_unavailable'},503)
                headers={**HEADERS,'X-Catalogue-Release':revision}
                return Response('' if request.method=='HEAD' else json.dumps(workbook,ensure_ascii=False,allow_nan=False),headers=headers)
            except Exception:return reply({'error':'catalogue_unavailable'},503)
        if path == '/catalog/v1/datasets':
            extra={**HEADERS,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'}
            if request.method=='OPTIONS':return Response('',status=204,headers=extra)
            if request.method not in ('GET','HEAD'):return Response(json.dumps({'error':'method_not_allowed'}),status=405,headers=extra)
            try:status,result=await dataset_api(D1Store(binding) if binding else None,url.query)
            except Exception:status,result=503,{'error':'catalogue_unavailable'}
            extra['X-Catalogue-Release']=result.get('release_id','')
            return Response('' if request.method=='HEAD' else json.dumps(result,ensure_ascii=False,allow_nan=False),status=status,headers=extra)
        is_catalogue_html=not path.startswith('/catalog/v1/') and path.startswith(CATALOGUE_PATHS) and (path.endswith(('/','.html')) or '.' not in path.rsplit('/',1)[-1])
        if path in DATA_SCRIPTS or path=='/assets/cabinet-shelf-core.js' or is_catalogue_html:
            if request.method not in ('GET','HEAD'):return reply({'error':'method_not_allowed'},405)
            if not binding:return reply({'error':'catalogue_unavailable'},503)
            try:
                if path in DATA_SCRIPTS:
                    revision,content=await data_script(D1Store(binding),path,url.query);mime='application/javascript; charset=utf-8'
                else:
                    asset=await self.env.ASSETS.fetch(request)
                    if asset.status!=200:return asset
                    content=await asset.text()
                    if path=='/assets/cabinet-shelf-core.js':
                        revision,content=await shelf_script(D1Store(binding),url.query,content);mime='application/javascript; charset=utf-8'
                    else:
                        revision,content=await render_page(D1Store(binding),path,content);mime='text/html; charset=utf-8'
                extra={'Content-Type':mime,'Cache-Control':'no-store','X-Catalogue-Release':revision,'X-Content-Type-Options':'nosniff'}
                return Response('' if request.method=='HEAD' else content,headers=extra)
            except Exception:
                if is_catalogue_html:return Response('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Каталог временно недоступен</title><main><h1>Каталог временно недоступен</h1><p>Повторите загрузку страницы через несколько секунд.</p><p>Catalogue temporarily unavailable. Please reload.</p></main></html>',status=503,headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'})
                return reply({'error':'catalogue_unavailable'},503)
        if path == '/catalog/v1/products':
            extra={**HEADERS,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS'}
            if request.method=='OPTIONS':return Response('',status=204,headers=extra)
            if request.method not in ('GET','HEAD'):
                return Response(json.dumps({'error':'method_not_allowed'}),status=405,headers={**extra,'Allow':'GET, HEAD, OPTIONS'})
            try:
                status,result=await catalogue(D1Store(binding) if binding else None,url.query)
            except Exception:
                return Response(json.dumps({'error':'catalogue_unavailable'}),status=503,headers=extra)
            extra['X-Catalogue-Release']=result.get('release_id','')
            return Response('' if request.method=='HEAD' else json.dumps(result,ensure_ascii=False,allow_nan=False),status=status,headers=extra)
        if path.startswith(('/admin/api/','/partner-api/')):
            if portal is None:return reply({'message':'Кабинет ещё не подключён к базе пользователей'},503)
            headers={key.lower():str(request.headers.get(key) or '') for key in ['Cookie','Origin','Content-Type','X-CSRF-Token','Authorization']}
            size=request.headers.get('Content-Length')
            if size and int(size)>1_000_000:return reply({'message':'Запрос превышает 1 МБ'},413)
            body=await request.text() if request.method not in ('GET','HEAD') else ''
            status,body,extra=await dispatch(portal,path,request.method,headers,body.encode(),str(request.headers.get('CF-Connecting-IP') or 'unknown'))
            return Response(body.decode(),status=status,headers=extra)
        if path.startswith('/embed/'):
            if portal is None:return reply({'message':'Виджет недоступен'},503)
            try:
                widget=await portal.widget(path.removeprefix('/embed/'))
                asset=await self.env.ASSETS.fetch(Request.new(origin+'/runtime/'))
                source=await asset.text()
                page,extra=embedded_html(source,widget,origin)
                return Response(page,headers=extra)
            except PortalError as exc:return reply({'message':exc.message},exc.status)
        if path=='/admin' or path.startswith('/admin/'):
            asset=await self.env.ASSETS.fetch(request)
            if asset.status!=200:return asset
            headers={'Content-Type':str(asset.headers.get('Content-Type') or 'text/html'),'Cache-Control':'no-store','Content-Security-Policy':PAGE_CSP,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}
            return Response(await asset.text(),headers=headers)
        if portal is None:return reply({'error':'catalogue_unavailable'},503)
        try:dataset=await portal.dataset()
        except PortalError:return reply({'error':'catalogue_unavailable'},503)
        if path == "/runtime/health" and request.method == "GET":
            return reply({"status": "ok", "demo": False, "production_ready": False})
        if path == "/runtime/api/catalog" and request.method == "GET":
            return reply(catalog_summary(dataset))
        if path == "/runtime/api/examples" and request.method == "GET":
            return reply(example_requests())
        if path == "/runtime/api/calculate":
            if request.method != "POST":
                return reply({"error": "method_not_allowed"}, 405)
            if (request.headers.get("Content-Type") or "").split(";")[0].strip() != "application/json":
                return reply({"error": "json_required"}, 415)
            try:
                size = request.headers.get("Content-Length")
                if size is None:
                    return reply({"error": "content_length_required"}, 411)
                if not 0 < int(size) <= 32768:
                    return reply({"error": "invalid_body_size"}, 413)
                raw = await request.text()
                if len(raw.encode("utf-8")) > 32768:
                    return reply({"error": "invalid_body_size"}, 413)
                inputs = json.loads(raw, parse_constant=reject_constant, object_pairs_hook=unique_object)
                return reply(public_calculation(execute({"dataset": dataset, "request": inputs}, demo=False)))
            except (CalculationError, ValueError, UnicodeError, RecursionError, OverflowError) as exc:
                return reply({"error": getattr(exc, "code", "invalid_request"), "message": str(exc)}, 400)
        if path.startswith("/runtime/api/"):
            return reply({"error": "not_found"}, 404)
        return await self.env.ASSETS.fetch(request)
