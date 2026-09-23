"""Cloudflare transport for the unchanged Python calculation core."""
import json
from urllib.parse import urlsplit

from workers import WorkerEntrypoint, Response
from battery_calculator.core import CalculationError
from battery_calculator.io import execute
from battery_calculator.__main__ import reject_constant, unique_object
from demo_data import EXAMPLES

HEADERS = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
           "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff"}


def reply(data, status=200):
    return Response(json.dumps(data, ensure_ascii=False, allow_nan=False), status=status, headers=HEADERS)


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        path = urlsplit(request.url).path
        if path == "/runtime/health" and request.method == "GET":
            return reply({"status": "ok", "demo": True, "production_ready": False})
        if path == "/runtime/api/examples" and request.method == "GET":
            return reply({name: item["request"] for name, item in EXAMPLES.items()})
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
                return reply(execute({"dataset": EXAMPLES["runtime"]["dataset"], "request": inputs}, demo=True))
            except (CalculationError, ValueError, UnicodeError, RecursionError, OverflowError) as exc:
                return reply({"error": getattr(exc, "code", "invalid_request"), "message": str(exc)}, 400)
        if path.startswith("/runtime/api/"):
            return reply({"error": "not_found"}, 404)
        return await self.env.ASSETS.fetch(request)
