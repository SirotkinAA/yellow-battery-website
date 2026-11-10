"""Public entry points for the two battery technologies and calculators."""
def cards(t,link):
    return '<div class="direction-grid">'+''.join(
        '<article class="direction-card"><p class="eyebrow">'+tag+'</p><h2>'+t(ru,en)+'</h2><p>'+t(desc_ru,desc_en)+'</p><div class="button-row">'+link(url,'Смотреть каталог →','Explore products →','text-link')+link(calc,calc_ru,calc_en,'button dark')+'</div></article>'
        for tag,ru,en,desc_ru,desc_en,url,calc,calc_ru,calc_en in [
            ('LEAD-ACID / AGM','Свинцовые батареи','Lead-acid batteries','Батареи AGM, расчёт автономии, стеллажи и мониторинг батарей.','AGM batteries, runtime sizing, racks and battery monitoring.','/catalog/','/runtime/','Калькулятор свинцовых АКБ ↗','Lead-acid calculator ↗'),
            ('LITHIUM / LiFePO₄','Литиевые решения','Lithium solutions','Батарейные шкафы и подбор литиевой системы по нагрузке и времени автономии.','Battery cabinets and lithium system sizing by load and runtime.','/lithium/','/lithium/#battery-calculator','Литиевый калькулятор ↗','Lithium calculator ↗')])+'</div>'
def home(t,link):
    return '<section class="section wrap"><p class="eyebrow">YELLOW / BATTERY SOLUTIONS</p><h1>'+t('Две технологии. Ваше решение.','Two technologies. Your solution.')+'</h1>'+cards(t,link)+'</section>'
def calculators(t,link):
    return '<section class="page-intro wrap"><p class="eyebrow">YELLOW / CALCULATORS</p><h1>'+t('Батарейные калькуляторы','Battery calculators')+'</h1><p class="intro-text">'+t('Выберите технологию батарей для расчёта. У каждого направления свой инструмент и исходные данные.','Choose a battery technology. Each calculator uses its own methods and product data.')+'</p></section><section class="section wrap">'+cards(t,link)+'</section>'
