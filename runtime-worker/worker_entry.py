"""Cloudflare transport for the unchanged Python calculation core."""
import json
from urllib.parse import urlsplit

from workers import WorkerEntrypoint, Response
from js import Request
from battery_portal.service import Portal,PortalError
from battery_portal.storage import D1Store
from battery_portal.transport import dispatch,embedded_html,public_calculation,PAGE_CSP
from battery_calculator.core import CalculationError
from battery_calculator.io import execute
from battery_calculator.__main__ import reject_constant, unique_object
from catalog_data import DATASET
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
        portal=Portal(D1Store(binding),DATASET,origin) if binding else None
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
        dataset=await portal.dataset() if portal else DATASET
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
