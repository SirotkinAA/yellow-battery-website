"""One drawing scene for PDF and editable CAD. All dimensions are millimetres.

This is a preliminary assembly sketch, not a production-approved ESKD document.
Catalog dimensions do not establish insertion depth, tolerances or crimp process.
"""
import io
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/cad-deps'))
CATALOG = ROOT / 'data/interconnects/dkc-tml.json'
CONVERTER_LOCK = threading.Lock()


def number(raw, key, minimum, maximum, integer=False):
    value = raw.get(key)
    if value is None or isinstance(value, bool) or not str(value).strip():
        raise ValueError('Не задано поле: ' + key)
    try:
        value = float(str(value).replace(',', '.'))
    except (TypeError, ValueError):
        raise ValueError('Неверное значение: ' + key)
    if not math.isfinite(value) or not minimum <= value <= maximum or (integer and not value.is_integer()):
        raise ValueError('Недопустимое значение: ' + key)
    return value


def prepare(raw):
    if not isinstance(raw, dict):
        raise ValueError('Ожидается объект параметров')
    catalog = json.loads(CATALOG.read_text())
    section = number(raw, 'section_mm2', 6, 120)
    length = number(raw, 'length_m', .001, 100) * 1000
    ns = int(number(raw, 'series_batteries', 1, 1000, True))
    np = int(number(raw, 'parallel_strings', 1, 100, True))
    mode = raw.get('connection_type', 'interbattery')
    if mode not in ('interbattery', 'disconnector'):
        raise ValueError('Неизвестный тип соединения')
    if ns == 1 and mode == 'interbattery':
        raise ValueError('В линейке одна АКБ: перемычки не требуются')
    selected = []
    for key in ('lug_left', 'lug_right'):
        code = raw.get(key, raw.get('lug_left') if mode == 'interbattery' else None)
        if not isinstance(code, str):
            raise ValueError('Выберите оба наконечника ДКС')
        code = catalog['aliases'].get(code, code)
        lug = next((x for x in catalog['items'] if x['article'] == code), None)
        if not lug or lug['section_mm2'] != section:
            raise ValueError('Наконечник не соответствует сечению: ' + key)
        selected.append(lug)
    if mode == 'interbattery' and selected[0]['article'] != selected[1]['article']:
        raise ValueError('На межбатарейной перемычке оба наконечника должны быть одинаковыми')
    quantity = int(number(raw, 'drawing_quantity', 1, 100000, True)) if mode == 'disconnector' else (ns - 1) * np
    scope=raw.get('drawing_scope','standalone')
    if scope not in ('standalone','layout_group'):
        raise ValueError('Неизвестный источник чертежа')
    if scope=='layout_group':
        if mode!='interbattery':raise ValueError('Ведомость компоновки: только межбатарейные связи')
        quantity=int(number(raw,'drawing_quantity',1,100000,True))
        if abs(number(raw,'route_length_mm',1,100000)-length)>.001:raise ValueError('Длина трассы не совпадает с ведомостью')
    code = raw.get('drawing_code', 'YB.PM.001')
    if not isinstance(code, str) or not code.strip() or not re.fullmatch(r'[A-Za-zА-Яа-яЁё0-9._ -]{1,40}', code):
        raise ValueError('Обозначение: до 40 букв, цифр, пробелов, точек или дефисов')
    finished = None
    if str(raw.get('finished_length_mm', '')).strip():
        finished = number(raw, 'finished_length_mm', 1, 100000)
        offsets = sum(x['dimensions_mm']['J']-x['dimensions_mm']['G'] for x in selected)
        if finished < offsets:
            raise ValueError('Межосевая длина меньше суммы вылетов выбранных наконечников')
    return {'section': section, 'wire_length_mm': length, 'finished_length_mm': finished,
            'left': selected[0], 'right': selected[1], 'code': code.strip(),
            'drawing_scope':scope, 'quantity': quantity, 'connection_type': mode, 'status': 'PRELIMINARY_NOT_FOR_MANUFACTURE',
            'catalog_sha256': catalog['source']['sha256']}


def scene(model):
    """A3 sheet. Geometry is illustrative, reference lug dimensions are explicit."""
    objects = []
    def line(x1, y1, x2, y2, width=.25, layer='GEOMETRY'):
        objects.append(('line', [x1, y1, x2, y2], width, layer))
    def text(x, y, value, height=3, layer='TEXT'):
        value=str(value).replace('×','x').replace('²','2').replace('Ø','d')
        if value:objects.append(('text', [x, y, value, height], .18, layer))
    def rect(x, y, w, h, width=.25, layer='GEOMETRY'):
        line(x, y, x+w, y, width, layer); line(x+w, y, x+w, y+h, width, layer)
        line(x+w, y+h, x, y+h, width, layer); line(x, y+h, x, y, width, layer)
    def circle(x, y, radius):
        objects.append(('circle', [x, y, radius], .35, 'GEOMETRY'))
    def dim(x1, x2, y, label, base):
        for x in (x1, x2): line(x, base, x, y+2, .18, 'DIMENSIONS')
        line(x1,y,x2,y,.18,'DIMENSIONS')
        for x,sign in ((x1,1),(x2,-1)):
            line(x,y,x+sign*2,y+.6,.18,'DIMENSIONS');line(x,y,x+sign*2,y-.6,.18,'DIMENSIONS')
        text((x1+x2)/2-len(label)*.7,y+2,label,3,'DIMENSIONS')
    def lug_view(lug, x, y, direction=1, side=False):
        d=lug['dimensions_mm'];J,G,D,B,C,F=(d[k] for k in ('J','G','D','B','C','F'))
        # Hole centre is the assembly anchor. Transition radius is not published.
        def point(u,v):return x+direction*(u-G),y+v
        if side:
            pts=[(0,-F/2),(J-B-3,-F/2),(J-B,-F/2),(J,-F/2),
                 (J,C-F/2),(J-B,C-F/2),(J-B-3,F/2),(0,F/2),(0,-F/2)]
        else:
            pts=[(0,-D/2),(J-B-3,-D/2),(J-B,-C/2),(J,-C/2),
                 (J,C/2),(J-B,C/2),(J-B-3,D/2),(0,D/2),(0,-D/2)]
        for a,b in zip(pts,pts[1:]):line(*point(*a),*point(*b),.35)
        if not side:circle(x,y,d['E']/2)
        return x+direction*(J-G)

    rect(20,5,395,287,.7,'FRAME')
    text(27,282,'ПЕРЕМЫЧКА КАБЕЛЬНАЯ. ПРЕДВАРИТЕЛЬНЫЙ СБОРОЧНЫЙ ЭСКИЗ',4)
    text(27,274,'НЕ ДЛЯ ИЗГОТОВЛЕНИЯ. Размеры наконечников справочные; допуски не назначены.',3.2)
    left,right=model['left'],model['right'];x1,x2=75,345
    text(27,260,'Вид сверху. Оконцевания показаны в одной плоскости условно; ориентацию согласовать.',3)
    a=lug_view(left,x1,232);b=lug_view(right,x2,232,-1)
    for offset in (-2,2):
        line(a,232+offset,202,232+offset,.35);line(218,232+offset,b,232+offset,.35)
    line(202,227,206,237);line(214,227,218,237)
    text(188,220,'разрыв изображения',2.5)
    dim(x1,x2,249,('L трассы с запасом = '+f"{model['wire_length_mm']:g}"+'*') if model['drawing_scope']=='layout_group' else (('L = '+f"{model['finished_length_mm']:g}"+'*') if model['finished_length_mm'] else 'L - уточнить'),238)
    text(x1-10,213,'1  '+left['article'],3);text(x2-12,213,'3  '+right['article'],3)
    text(171,204,'2  ПУГВ 1×'+f"{model['section']:g}"+' · ХКА',3.5)
    text(27,193,'Вид сбоку (условно). Наружный диаметр изоляции провода не подтверждён.',3)
    a=lug_view(left,x1,174,side=True);b=lug_view(right,x2,174,-1,True)
    for offset in (0,4):line(a,174+offset,202,174+offset,.35);line(218,174+offset,b,174+offset,.35)
    line(202,171,206,181);line(214,171,218,181)
    text(27,156,'Размеры наконечников ДКС, мм. Обозначения по каталогу №38, стр. 18.73–18.74.',3)
    xs=[27,64,84,110,137,165,192,220,247,275,303,339,407]
    labels=['Поз./артикул','S, мм²','Болт','ØE','ØA','ØC','B','J','F','D','G','H']
    for x in xs:line(x,128,x,152,.18,'TABLE')
    for y in (128,136,144,152):line(xs[0],y,xs[-1],y,.18,'TABLE')
    for x,v in zip(xs,labels):text(x+1,147,v,2.7)
    for lug,position,y in ((left,1,139),(right,3,131)):
        vals=[str(position)+' / '+lug['article'],f"{lug['section_mm2']:g}",'M'+str(lug['bolt_metric_mm'])]+[f"{lug['dimensions_mm'][k]:g}" for k in ('E','A','C','B','J','F','D','G','H')]
        for x,v in zip(xs,vals):text(x+1,y,v,2.7)
    text(27,121,'E — отверстие; A/C — диаметры трубки; D — ширина лопатки; J — длина; F — толщина.',2.7)
    text(27,116,'B — цилиндрическая часть; G/H — привязки по каталогу. B не является длиной зачистки.',2.7)
    text(27,107,'Состав одной перемычки (ведомость, не заменяет спецификацию ЕСКД):',3)
    text(27,99,'1. Наконечник ДКС '+left['article']+' — 1 шт.',3)
    text(27,93,'2. ПУГВ 1×'+f"{model['section']:g}"+' ХКА; длина жилы для электрического расчёта '+f"{model['wire_length_mm']:g}"+' мм.',3)
    text(27,87,'3. Наконечник ДКС '+right['article']+' — 1 шт.',3)
    text(27,80,('Соединений к размыкателю: ' if model['connection_type']=='disconnector' else 'Перемычек в массиве: ')+str(model['quantity'])+'. Изоляция оконцеваний и маркировка — уточнить.',3)
    for y,value in [(70,'1. Длина отрезка провода, зачистка и глубина ввода жилы требуют согласования.'),
                    (65,'2. Назначить инструмент, матрицу, число обжимов, допуски и контроль соединений.'),
                    (58,'3. Совместимость ПУГВ ХКА с ТМЛ ДКС'),(53,'   и клеммами АКБ требует проверки.'),
                    (46,'4. Геометрия показана условно, с разрывом.'),(41,'   Радиусы переходов не нормированы.'),
                    (34,'5. L* — размер, заданный пользователем.'),(29,'   Связь с длиной жилы не подтверждена.')]:text(27,y,value,2.8)
    if model['drawing_scope']=='layout_group':
        text(27,21,'L* - трасса с запасом по компоновке.',2.8)
        text(27,16,'Не является длиной отрезка провода.',2.8)
    if model['connection_type']=='disconnector':
        text(27,21,'АКБ - размыкатель. Размыкать только',2.8)
        text(27,16,'после снятия нагрузки.',2.8)
    # Main inscription: A3, 185×55 mm, working form-1 layout, signatures left blank.
    x,y=230,5;rect(x,y,185,55,.5,'FRAME')
    line(x+65,y,x+65,y+55,.35,'FRAME');line(x+65,y+40,x+185,y+40,.35,'FRAME')
    line(x+135,y,x+135,y+40,.35,'FRAME');line(x+65,y+15,x+185,y+15,.35,'FRAME')
    line(x+135,y+25,x+185,y+25,.35,'FRAME');line(x+135,y+32,x+185,y+32,.18,'FRAME')
    for dx in (150,167):line(x+dx,y+25,x+dx,y+40,.18,'FRAME')
    for dy in range(5,56,5):line(x,y+dy,x+65,y+dy,.18,'FRAME')
    for dx in (17,40,55):line(x+dx,y,x+dx,y+55,.18,'FRAME')
    line(x+7,y+40,x+7,y+55,.18,'FRAME')
    for xx,v in zip((.5,7.5,18,40.5,56),('Изм.','Лист','№ докум.','Подп.','Дата')):text(x+xx,y+42,v,2)
    for yy,labels_row in [(37,['Разраб.','','','']),(32,['Пров.','','','']),(17,['Н.контр.','','','']),(7,['Утв.','','',''])]:
        for xx,v in zip((2,19,41,56),labels_row):text(x+xx,y+yy,v,2.3)
    text(x+68,y+46,model['code']+' СБ',min(4,95/max(1,len(model['code']+' СБ'))*1.6))
    text(x+68,y+33,'Перемычка ПУГВ 1×'+f"{model['section']:g}",3)
    text(x+68,y+27,'Сборочный эскиз',3);text(x+68,y+21,'Предварительно',2.8)
    for xx,v in ((137,'Лит.'),(152,'Масса'),(169,'Масштаб')):text(x+xx,y+35,v,2.1)
    text(x+153,y+28,'—',2.5);text(x+170,y+28,'Б/М',2.5)
    text(x+137,y+19,'Лист 1   Листов 1',2.5);text(x+144,y+6,'YELLOW',4)
    text(x+68,y+6,'Подписи не назначены',2.5)
    text(22,7,'А3',2.5)
    return objects


def pdf_bytes(objects):
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    font_path=os.environ.get('YELLOW_DRAWING_FONT','/System/Library/Fonts/Supplemental/Arial.ttf')
    if not Path(font_path).is_file():
        raise RuntimeError('Не установлен шрифт чертежа с поддержкой кириллицы')
    if 'YellowCAD' not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont('YellowCAD',font_path))
    out=io.BytesIO();mm=72/25.4;c=canvas.Canvas(out,pagesize=(420*mm,297*mm))
    c.setTitle('YELLOW — предварительный эскиз перемычки');c.setAuthor('YELLOW')
    for kind,args,width,layer in objects:
        c.setLineWidth(width*mm)
        if kind=='line':c.line(*(n*mm for n in args))
        elif kind=='circle':c.circle(*(n*mm for n in args),stroke=1,fill=0)
        else:
            x,y,value,height=args;c.setFont('YellowCAD',height*mm);c.drawString(x*mm,y*mm,value)
    c.showPage();c.save();return out.getvalue()


def dxf_document(objects, version='R2018'):
    import ezdxf
    doc=ezdxf.new(version);doc.units=4;doc.header['$MEASUREMENT']=1
    doc.styles.new('YELLOW',dxfattribs={'font':'Arial.ttf'})
    for layer in ('FRAME','GEOMETRY','DIMENSIONS','TABLE','TEXT'):doc.layers.new(layer)
    msp=doc.modelspace()
    for kind,args,width,layer in objects:
        attrib={'layer':layer,'lineweight':round(width*100)}
        if version=='R12':attrib.pop('lineweight')
        if kind=='line':msp.add_line(args[:2],args[2:],dxfattribs=attrib)
        elif kind=='circle':msp.add_circle(args[:2],args[2],dxfattribs=attrib)
        else:
            x,y,value,height=args;msp.add_text(value,dxfattribs={**attrib,'height':height,'insert':(x,y),'style':'YELLOW'})
    return doc


def converter_path():
    path=os.environ.get('YELLOW_ODA_CONVERTER')
    return Path(path) if path else ROOT/'.local/oda-verified/ODAFileConverter.app/Contents/MacOS/ODAFileConverter'


def native_dwg(objects):
    """Local GNU LibreDWG adapter; verify geometry and text on every export."""
    import ezdxf
    from collections import Counter
    cad_bin=Path(os.environ.get('YELLOW_CAD_BIN',str(ROOT/'.local/libredwg/bin')))
    writer=cad_bin/'dwgadd-ru'
    reader=cad_bin/'dwg2dxf'
    if not writer.is_file() or not reader.is_file():
        raise RuntimeError('DWG пока недоступен: CAD-сервис не установлен. PDF и DXF доступны.')
    commands=['HEADER.INSUNITS = 4','HEADER.MEASUREMENT = 1',
              'style "Standard"','style.font_file = "Arial.ttf"']
    expected=[]
    def record(kind, values):
        return (kind, *(round(v,5) if isinstance(v,(int,float)) else v for v in values))
    for kind,args,_,_ in objects:
        if kind=='line':
            commands.append(f'line ({args[0]} {args[1]} 0) ({args[2]} {args[3]} 0)')
        elif kind=='circle':commands.append(f'circle ({args[0]} {args[1]} 0) {args[2]}')
        else:
            x,y,value,height=args
            if '"' in value or '\n' in value or len(value.encode())>4000:
                raise ValueError('Недопустимый текст чертежа')
            commands.append(f'text "{value}" ({x} {y} 0) {height}')
        expected.append(record(kind,args))
    with CONVERTER_LOCK, tempfile.TemporaryDirectory(prefix='yellow-dwg-') as td:
        path=Path(td);script=path/'drawing.dwgadd';dwg=path/'drawing.dwg';dxf=path/'roundtrip.dxf'
        script.write_text('\n'.join(commands)+'\n')
        for command in ([str(writer),'--as','r2000','-o',str(dwg),str(script)],
                        [str(reader),'-o',str(dxf),str(dwg)]):
            run=subprocess.run(command,timeout=30,check=True,capture_output=True)
            if b'ERROR' in run.stderr or b'Ignored' in run.stderr:
                raise RuntimeError('DWG не прошёл проверку конвертера. PDF и DXF доступны.')
        doc=ezdxf.readfile(dxf)
        if doc.audit().has_errors or doc.units!=4:
            raise RuntimeError('DWG не прошёл проверку структуры или единиц')
        actual=[]
        for e in doc.modelspace():
            if e.dxftype()=='LINE':actual.append(record('line',[e.dxf.start.x,e.dxf.start.y,e.dxf.end.x,e.dxf.end.y]))
            elif e.dxftype()=='CIRCLE':actual.append(record('circle',[e.dxf.center.x,e.dxf.center.y,e.dxf.radius]))
            elif e.dxftype()=='TEXT':actual.append(record('text',[e.dxf.insert.x,e.dxf.insert.y,e.dxf.text,e.dxf.height]))
            else:raise RuntimeError('Неожиданный объект в DWG')
        if Counter(actual)!=Counter(expected):
            raise RuntimeError('DWG не прошёл сверку геометрии или надписей. PDF и DXF доступны.')
        if doc.styles.get('Standard').dxf.font!='Arial.ttf':
            raise RuntimeError('DWG не прошёл проверку шрифта')
        data=dwg.read_bytes()
        if not data.startswith(b'AC1015'):raise RuntimeError('Неверный формат DWG')
        return data


def generate(raw, format):
    if format not in ('pdf','dxf','dwg'):raise ValueError('Неизвестный формат')
    model=prepare(raw);objects=scene(model)
    if format=='pdf':return pdf_bytes(objects)
    doc=dxf_document(objects)
    if format=='dxf':
        stream=io.StringIO();doc.write(stream);return stream.getvalue().encode('utf-8')
    converter=converter_path()
    if not converter.is_file():return native_dwg(objects)
    with CONVERTER_LOCK, tempfile.TemporaryDirectory(prefix='yellow-link-') as td:
        source=Path(td)/'in';target=Path(td)/'out';source.mkdir();target.mkdir();doc.saveas(source/'link.dxf')
        env={**os.environ,'QT_QPA_PLATFORM':'offscreen'}
        subprocess.run([str(converter),str(source),str(target),'ACAD2018','DWG','0','1','*.dxf'],env=env,timeout=45,check=True,capture_output=True)
        output=target/'link.dwg'
        if not output.is_file():raise RuntimeError('Конвертер не создал DWG')
        data=output.read_bytes()
        if not data.startswith(b'AC1032'):raise RuntimeError('Неверный формат DWG')
        return data
