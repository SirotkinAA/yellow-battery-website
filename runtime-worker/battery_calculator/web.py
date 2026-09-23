"""WSGI demo application mounted at /runtime; never accepts a browser catalog."""
import argparse
import json
from pathlib import Path
from wsgiref.simple_server import make_server

from .__main__ import reject_constant, unique_object
from .core import CalculationError
from .io import execute

ROOT = Path(__file__).resolve().parent.parent
STATIC = Path(__file__).resolve().parent / "static"
EXAMPLES = {name: json.loads((ROOT / "examples" / "calculator" / (name + ".json")).read_text())
            for name in ("runtime", "profile", "select")}
MAX_BODY = 32768


def application(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET")
    path = environ.get("PATH_INFO", "")

    def respond(status, body, content_type="application/json; charset=utf-8", extra=()):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False, allow_nan=False).encode("utf-8")
        start_response(status, [("Content-Type", content_type), ("Content-Length", str(len(body))),
                                ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff"),
                                ("X-Robots-Tag", "noindex, nofollow"),
                                ("Content-Security-Policy", "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"),
                                ("Referrer-Policy", "same-origin")] + list(extra))
        return [body if method != "HEAD" else b""]

    assets = {"/runtime": ("index.html", "text/html; charset=utf-8"),
              "/runtime/": ("index.html", "text/html; charset=utf-8"),
              "/runtime/app.js": ("app.js", "text/javascript; charset=utf-8"),
              "/runtime/style.css": ("style.css", "text/css; charset=utf-8"),
              "/runtime/yellow-logo.svg": ("yellow-logo.svg", "image/svg+xml")}
    if path in assets and method in ("GET", "HEAD"):
        name, mime = assets[path]
        return respond("200 OK", (STATIC / name).read_bytes(), mime)
    if path == "/runtime/api/examples" and method == "GET":
        return respond("200 OK", {name: item["request"] for name, item in EXAMPLES.items()})
    if path == "/runtime/health" and method == "GET":
        return respond("200 OK", {"status": "ok", "demo": True, "production_ready": False})
    if path != "/runtime/api/calculate":
        return respond("404 Not Found", {"error": "not_found"})
    if method != "POST":
        return respond("405 Method Not Allowed", {"error": "method_not_allowed"}, extra=(("Allow", "POST"),))
    if environ.get("CONTENT_TYPE", "").split(";")[0].strip() != "application/json":
        return respond("415 Unsupported Media Type", {"error": "json_required"})
    try:
        length = int(environ.get("CONTENT_LENGTH") or "0")
        if length <= 0 or length > MAX_BODY:
            return respond("413 Payload Too Large", {"error": "invalid_body_size"})
        request = json.loads(environ["wsgi.input"].read(length).decode("utf-8"),
                             parse_constant=reject_constant, object_pairs_hook=unique_object)
        result = execute({"dataset": EXAMPLES["runtime"]["dataset"], "request": request}, demo=True)
        return respond("200 OK", result)
    except (CalculationError, ValueError, UnicodeError, RecursionError, OverflowError) as exc:
        return respond("400 Bad Request", {"error": getattr(exc, "code", "invalid_request"), "message": str(exc)})


def main():
    parser = argparse.ArgumentParser(description="Local preview only; deploy application with a WSGI server")
    parser.add_argument("--port", type=int, default=8085)
    args = parser.parse_args()
    with make_server("127.0.0.1", args.port, application) as server:
        print("Preview: http://127.0.0.1:%s/runtime" % args.port, flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
