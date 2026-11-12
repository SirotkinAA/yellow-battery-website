"""One-shelf AGM layout prototype, independent of the rack planner."""
import html
from wiring_panel import content as wiring_content, scripts as wiring_scripts
from pathlib import Path
from cabinet_layout import content as cabinet_content


def content():
    root = Path(__file__).parent
    models = html.escape((root / 'data/products.json').read_text(), quote=True)
    def field(key, title, value, minimum, step='1'):
        return f'<label>{title}<input id="shelf-{key}" type="number" min="{minimum}" step="{step}" value="{value}" required></label>'
    return f'''<link rel="stylesheet" href="/assets/cabinet-shelf.css">
<link rel="stylesheet" href="/assets/racks.css">{wiring_scripts()}<script src="/assets/cabinet-shelf-core.js" defer></script><script src="/assets/cabinet-layout.js" defer></script><script src="/assets/cabinet-shelf.js" defer></script>
<section class="wrap page-intro"><p class="eyebrow">RITTAL / AGM / КОМПОНОВКА ШКАФА</p><h1>Батареи в шкафу.</h1><p class="intro-text">Выберите типоразмер Rittal VX ESS и рассчитайте предварительную компоновку AGM-батарей.</p><p><a href="/racks/">← Конфигуратор стеллажей</a> · <a href="#cabinet">К компоновке шкафа ↓</a></p></section>
<section class="wrap shelf-app" data-shelf-models="{models}">
<form id="shelf-form" class="shelf-panel" novalidate><h2>Исходные данные</h2>
<label>Шкаф Rittal VX ESS<select id="shelf-enclosure"></select></label><p id="shelf-enclosure-source" class="shelf-small"></p><label>Модель AGM<select id="shelf-model"></select></label><p id="shelf-source" class="shelf-small"></p>
<div class="shelf-fields">{field('length','Длина АКБ, мм',151,1,'0.1')}{field('width','Ширина АКБ, мм',98,1,'0.1')}{field('mass','Масса АКБ, кг',3.4,0.01,'0.01')}{field('count','Нужно разместить, шт.',12,1)}{field('gap','Между АКБ, мм',10,0,'0.1')}{field('edge','От края полки, мм',10,0,'0.1')}{field('allowance','Прибавка к Д и Ш, мм',0,0,'0.1')}</div>
<p class="shelf-small">Размеры и масса из каталога — номинальные. Прибавка увеличивает каждый габарит АКБ целиком; массу можно увеличить вручную с учётом допуска. Зазоры 10 мм — начальное допущение, их нужно проверить по требованиям батареи и подключения.</p>
<label>Ориентация<select id="shelf-orientation"><option value="auto">Автоматически: больше батарей</option><option value="0">0° — длина по ширине полки</option><option value="90">90° — ширина по ширине полки</option></select></label>
<p class="shelf-small">АКБ стоят вертикально. Сравниваются прямоугольные сетки с единой ориентацией; смешанное размещение не рассчитывается.</p></form>
<div class="shelf-panel shelf-output"><div class="shelf-heading"><h2>Одна полка · вид сверху</h2><span id="shelf-article">9692.020</span></div><p id="shelf-spec">Полезная площадь 509 × 514 мм · статическая нагрузка до 200 кг</p><div id="shelf-error" role="alert" hidden></div><div id="shelf-result" aria-live="polite"></div><div id="shelf-drawing"></div><div id="shelf-comparison"></div></div>
</section>{cabinet_content()}{wiring_content()}<section class="wrap shelf-notes"><h2>Границы расчёта</h2><p>Это предварительная геометрическая компоновка. Расчёт не подтверждает доступ к клеммам, трассы кабелей, вентиляцию и распределение нагрузки по опорной поверхности. Расстановка центрирована; остаток ряда также центрирован.</p><p>Число полок рассчитано по введённым допущениям; ведомость компонентов неполная. Монтажные уровни и общая нагрузка шкафа требуют проверки. В источниках по раме есть расхождение: 10 000 и 15 000 Н; автоматически выбирать одно значение пока нельзя.</p><p><a href="https://www.rittal.com/pdf-creator/variant/uk-en/9692020" target="_blank" rel="noopener">Паспорт полки Rittal 9692.020 ↗</a> · <a href="https://www.rittal.com/pdf-creator/variant/sk-sk/9690020" target="_blank" rel="noopener">Шкаф Rittal 9690.020 ↗</a></p></section>'''
