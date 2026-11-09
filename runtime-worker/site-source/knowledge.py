"""Knowledge hub and the educational battery anatomy interactive."""
from pathlib import Path

def build(page, intro, link, t):
    page('knowledge', 'База знаний', intro('YELLOW / KNOWLEDGE', 'База знаний.', 'Knowledge base.', 'Как устроены аккумуляторы и что влияет на их работу.', 'Understand batteries and the factors that affect their performance.') + '<section class="section wrap"><div class="editorial-grid"><article class="editorial-card"><p class="eyebrow">01 / '+t('ИНТЕРАКТИВНЫЙ ГИД', 'INTERACTIVE GUIDE')+'</p><h2>'+t('Анатомия стационарной АКБ', 'Stationary battery anatomy')+'</h2><p>'+t('Устройство батареи, соединения, разряд и диагностика. Меняйте параметры и наблюдайте результат на схемах.', 'Explore construction, connections, discharge and diagnostics. The interactive guide is currently available in Russian.')+'</p>'+link('/knowledge/battery-anatomy/', 'Открыть интерактивный гид →', 'Open guide in Russian →', 'text-link')+'</article></div></section>')
    page('knowledge/battery-anatomy', 'Анатомия стационарной АКБ', Path(__file__).with_name('battery-anatomy.html').read_text())
