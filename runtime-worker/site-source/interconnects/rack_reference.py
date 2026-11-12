"""Build a read-only rack reference viewer from the evidence registry."""
from rack_public import public_data
from wiring_panel import content as wiring_content
import html
import json
from pathlib import Path

def content():
    data=json.loads((Path(__file__).resolve().parents[1]/'battery_rack/reference_data.json').read_text())
    data['configurations']+=json.loads((Path(__file__).resolve().parents[1]/'battery_rack/open_extended_data.json').read_text())['configurations']
    payload=html.escape(json.dumps(public_data(data),ensure_ascii=False),quote=True)
    models=html.escape((Path(__file__).parent/'data/products.json').read_text(),quote=True)
    planner=(Path(__file__).parent/'rack-planner.html').read_text().replace('__WIRING_PANEL__',wiring_content()).replace('__MODELS__',models).replace('__REFERENCE_COUNT__',str(len(data['configurations'])))
    lengths=''.join(f'<option>{int(length)}</option>' for length in sorted({r['dimensions_mm'][0] for r in data['configurations']}))
    return f'''<script src="/assets/rack-components-data.js" defer></script><script src="/assets/rack-components.js" defer></script><script src="/assets/rack-cladded-data.js" defer></script><script src="/assets/rack-match.js" defer></script><script src="/assets/rack-layout.js" defer></script><script src="/assets/rack-cladded-layout.js" defer></script><script src="/assets/rack-wiring.js" defer></script><script src="/assets/layout-interconnects.js" defer></script><script src="/assets/rack-wiring-ui.js" defer></script><script src="/assets/rack-planner.js" defer></script><link rel="stylesheet" href="/assets/racks.css"><script src="/assets/racks.js" defer></script>
<section class="wrap page-intro"><p class="eyebrow">RACKS / КОМПОНОВКА БАТАРЕЙ</p><h1>Стеллажи для батарей</h1><p class="intro-text">Выберите модель и количество батарей, сравните размещение и получите 3D-вид и габаритный эскиз с изометрией.</p><div class="button-row"><a class="button dark" href="/racks/cladded/"><span data-lang="ru">Каталог закрытых стеллажей →</span><span data-lang="en" hidden>Cladded rack catalogue →</span></a><a class="button outline" href="/racks/catalog/"><span data-lang="ru">Каталог открытых стеллажей →</span><span data-lang="en" hidden>Open rack catalogue →</span></a></div></section>
{planner}<section class="wrap rack-view" data-rack-catalog="{payload}">
<h2>Конфигурации AlphaSYS с геометрической моделью</h2><p><a href="/racks/catalog/">Каталог 114 стеллажей и их BOM →</a> · <a href="/racks/components/">Детали и аксессуары →</a> · <a href="/racks/cladded/">Закрытые стеллажи →</a></p><p>Для компоновки доступны {len(data['configurations'])} конфигураций разных серий длиной 600–3450 мм. Для подключённых позиций оси рам и уровни сверены с чертежами; остальные позиции доступны в каталоге.</p><div class="rack-controls"><label>Серия<select id="rack-family"></select></label><label>Длина стеллажа<select id="rack-length">{lengths}</select> мм</label><label>Исполнение<select id="rack-case"><option value="STANDARD">Обычное</option><option value="H" selected>H</option></select></label></div>
<p class="rack-notice">Просмотр эталонов. Подбор под конкретные батареи и несущая способность ещё не подтверждены.</p>
<div id="rack-result" aria-live="polite"></div><noscript>Для выбора конфигурации включите JavaScript.</noscript>
<p class="muted">Источник: наблюдения AlphaSYS 7.6.0 за сентябрь–октябрь 2026. Номинальные секции определены по кодировке балок; чертёж ниже — схема расположения рам. Полная ведомость крепежа пока неизвестна.</p></section>'''
