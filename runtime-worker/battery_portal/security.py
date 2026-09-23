import hashlib
import hmac
import re
import secrets
from urllib.parse import urlsplit

PERMISSIONS=('prices:read','api:export','widget:embed')
SCRYPT_N=32768
SCRYPT_R=8
SCRYPT_P=3
SCRYPT_MAXMEM=64*1024*1024

def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def token():return secrets.token_urlsafe(32)
def email(value):
    value=str(value).strip().lower()
    if len(value)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value):raise ValueError('Некорректный email')
    return value

async def derive_password(password, salt):
    # OWASP scrypt parameters. Cloudflare production caps PBKDF2 at 100000;
    # local workerd does not, so PBKDF2-600000 cannot be used on this platform.
    if hasattr(hashlib,'scrypt'):
        return hashlib.scrypt(password.encode(),salt=salt,n=SCRYPT_N,r=SCRYPT_R,p=SCRYPT_P,maxmem=SCRYPT_MAXMEM,dklen=32).hex()
    from workers import import_from_javascript
    from pyodide.ffi import to_js
    crypto=import_from_javascript('crypto_bridge.mjs')
    return crypto.derivePassword(to_js(password.encode()),to_js(salt))

async def password_hash(password):
    if not isinstance(password,str) or not 12<=len(password)<=128:raise ValueError('Пароль: от 12 до 128 символов')
    salt=secrets.token_hex(16)
    derived=await derive_password(password,bytes.fromhex(salt))
    return f'scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt}${derived}'

async def password_ok(password,stored):
    if not isinstance(password,str) or len(password)>128:return False
    if not stored:
        await derive_password(password,b'unknown-account!')
        return False
    try:
        algorithm,n,r,p,salt,expected=stored.split('$')
        if algorithm!='scrypt' or (int(n),int(r),int(p))!=(SCRYPT_N,SCRYPT_R,SCRYPT_P):return False
        actual=await derive_password(password,bytes.fromhex(salt))
        return hmac.compare_digest(actual,expected)
    except (ValueError,TypeError):return False

def permissions(values):
    if not isinstance(values,list) or any(v not in PERMISSIONS for v in values):raise ValueError('Неизвестное право доступа')
    return sorted(set(values))

def origins(values):
    if not isinstance(values,list) or not 1<=len(values)<=10:raise ValueError('Укажите от 1 до 10 HTTPS-доменов')
    result=[]
    for value in values:
        p=urlsplit(str(value).strip())
        if p.scheme!='https' or not p.hostname or p.username or p.password or p.query or p.fragment or p.path not in ('','/') or '*' in value or any(c.isspace() for c in value):raise ValueError('Домен должен иметь вид https://partner.example')
        try:port=p.port
        except ValueError:raise ValueError('Некорректный порт')
        host=p.hostname.encode('idna').decode().lower()
        if not re.fullmatch(r'[a-z0-9.-]+',host):raise ValueError('Некорректный домен')
        result.append('https://'+host+(f':{port}' if port and port!=443 else ''))
    return sorted(set(result))

def widget_config(raw):
    if not isinstance(raw,dict) or set(raw)-{'title','language','accent','background','text','radius','font','modes'}:raise ValueError('Неизвестная настройка виджета')
    result={'title':str(raw.get('title','Калькулятор автономии'))[:80], 'language':raw.get('language','ru'),'accent':raw.get('accent','#f7d528'),'background':raw.get('background','#f5f5ef'),'text':raw.get('text','#202525'),'radius':raw.get('radius',4),'font':raw.get('font','system'),'modes':raw.get('modes',['select','profile','runtime'])}
    if result['language'] not in ('ru','en') or result['font'] not in ('system','serif'):raise ValueError('Некорректный язык или шрифт')
    if type(result['radius']) is not int or not 0<=result['radius']<=16:raise ValueError('Скругление: от 0 до 16')
    if any(not re.fullmatch(r'#[0-9a-fA-F]{6}',result[c]) for c in ('accent','background','text')):raise ValueError('Цвет должен быть в формате #RRGGBB')
    if not isinstance(result['modes'],list) or not result['modes'] or any(m not in ('select','profile','runtime') for m in result['modes']):raise ValueError('Выберите хотя бы один режим')
    result['modes']=list(dict.fromkeys(result['modes']))
    return result
