"""Private, bounded drawing endpoint. No static files, credentials or database."""
import json
import threading
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, make_server
from interconnect_documents.drawing import generate

SLOTS = threading.BoundedSemaphore(2)
MIMES = {'pdf':'application/pdf', 'dwg':'image/vnd.dwg', 'dxf':'application/dxf'}
MAX_BODY = 32768

def application(env, start):
    def reply(status, data, mime='application/json; charset=utf-8'):
        start(status, [('Content-Type',mime),('Content-Length',str(len(data))),
                       ('Cache-Control','no-store'),('X-Content-Type-Options','nosniff')])
        return [data]
    path=env.get('PATH_INFO','')
    if path=='/health' and env.get('REQUEST_METHOD')=='GET':
        return reply('200 OK',b'{"status":"ok"}')
    format=path.rsplit('/',1)[-1]
    if path!='/interconnects/api/drawing/'+format or format not in MIMES:
        return reply('404 Not Found',b'{"error":"not_found"}')
    if env.get('REQUEST_METHOD')!='POST':
        return reply('405 Method Not Allowed',b'{"error":"POST required"}')
    if env.get('CONTENT_TYPE','').split(';')[0].strip()!='application/json':
        return reply('415 Unsupported Media Type',b'{"error":"JSON required"}')
    try: size=int(env.get('CONTENT_LENGTH') or 0)
    except ValueError: size=0
    if not 0<size<=MAX_BODY:
        return reply('413 Payload Too Large',b'{"error":"body_size"}')
    if not SLOTS.acquire(blocking=False):
        return reply('503 Service Unavailable',json.dumps({'error':'Сервис занят. Повторите запрос.'},ensure_ascii=False).encode())
    try:
        body=env['wsgi.input'].read(size)
        if len(body)!=size:raise ValueError('Неполный запрос')
        data=json.loads(body)
        output=generate(data,format)
        return reply('200 OK',output,MIMES[format])
    except (ValueError,TypeError,UnicodeError,RecursionError) as exc:
        return reply('400 Bad Request',json.dumps({'error':str(exc)},ensure_ascii=False).encode())
    except Exception:
        return reply('503 Service Unavailable',json.dumps({'error':'Не удалось сформировать или проверить чертёж.'},ensure_ascii=False).encode())
    finally:SLOTS.release()

class Server(ThreadingMixIn, WSGIServer):
    daemon_threads=True

if __name__=='__main__':
    with make_server('0.0.0.0',8080,application,server_class=Server) as server:
        server.serve_forever()
