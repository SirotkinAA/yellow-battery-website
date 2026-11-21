const previewOrigin = 'https://test.yellow-battery.com';
const hmiDemoBlock = `
<section class="wrap yellow-hmi-feature-wrap" aria-labelledby="yellow-hmi-title" id="hmi-demo">
<style>
.yellow-hmi-feature-wrap{padding-top:12px;padding-bottom:56px}
.yellow-hmi-feature{display:grid;grid-template-columns:1fr 1.05fr;gap:44px;align-items:center;background:#eeefe8;padding:40px}
.yellow-hmi-feature .hmi-label{display:inline-block;background:#f4d830;padding:7px 10px;font-size:12px;letter-spacing:1px;margin:0 0 20px}
.yellow-hmi-feature h2{font-size:clamp(28px,3vw,42px);font-weight:500;line-height:1.12;letter-spacing:-1px;margin:0 0 20px}
.yellow-hmi-feature .hmi-description{font-size:17px;line-height:1.6;max-width:390px;margin:0 0 24px}
.yellow-hmi-feature .hmi-launch{background:#202522;color:#fff;display:inline-flex;justify-content:center;align-items:center;padding:16px 24px;text-decoration:none;border:1px solid #202522;font-size:16px;line-height:1.4}
.yellow-hmi-feature .hmi-launch:hover{background:#373d38}
.yellow-hmi-feature .hmi-note{font-size:13px;color:#626860;margin:14px 0 0}
.yellow-hmi-feature .hmi-preview{position:relative;padding:18px 0 0 16px;min-width:0}
.yellow-hmi-feature .hmi-preview:before{content:"";position:absolute;top:0;left:0;width:48%;height:46%;background:#f4d830}
.yellow-hmi-feature .hmi-screen{position:relative;border:3px solid #37464d;border-radius:4px;background:#d7ebfa;box-shadow:0 8px 18px #20252212;color:#344b5a;font-family:Arial,sans-serif}
.yellow-hmi-feature .hmi-screen-top{display:flex;justify-content:space-between;gap:12px;padding:12px;background:#add0e7;font-size:12px}
.yellow-hmi-feature .hmi-screen-body{display:grid;grid-template-columns:105px minmax(0,1fr);min-height:240px}
.yellow-hmi-feature .hmi-side{padding:18px 10px;background:#2d4050;color:#e8f0f5;font-size:11px;display:flex;flex-direction:column;gap:22px}
.yellow-hmi-feature .hmi-side strong{color:#f4d830;letter-spacing:.6px;font-size:16px}
.yellow-hmi-feature .hmi-content{background:#fff;margin:12px;padding:12px;min-width:0}
.yellow-hmi-feature .hmi-tabs{display:flex;gap:16px;border-bottom:1px solid #dce5eb;margin-bottom:14px}
.yellow-hmi-feature .hmi-tabs label{font-size:12px;padding-bottom:10px;cursor:pointer}
.yellow-hmi-feature .hmi-radio{position:absolute;opacity:0;width:1px;height:1px}
.yellow-hmi-feature #hmi-preview-data:focus-visible ~ .hmi-tabs label[for="hmi-preview-data"],
.yellow-hmi-feature #hmi-preview-events:focus-visible ~ .hmi-tabs label[for="hmi-preview-events"]{outline:2px solid #176e7e;outline-offset:3px}
.yellow-hmi-feature #hmi-preview-data:checked ~ .hmi-tabs label[for="hmi-preview-data"],
.yellow-hmi-feature #hmi-preview-events:checked ~ .hmi-tabs label[for="hmi-preview-events"]{color:#176e7e;border-bottom:2px solid #176e7e}
.yellow-hmi-feature #hmi-preview-data:checked ~ .hmi-events,
.yellow-hmi-feature #hmi-preview-events:checked ~ .hmi-data{display:none}
.yellow-hmi-feature .hmi-preview-caption{font-size:12px;margin:0 0 10px}
.yellow-hmi-feature .hmi-table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}
.yellow-hmi-feature .hmi-table td,.yellow-hmi-feature .hmi-table th{padding:9px 4px;text-align:left;border-bottom:1px solid #e3e9ed;font-weight:400}
.yellow-hmi-feature .hmi-table .hmi-warning{background:#fff0d1;color:#80500f}
.yellow-hmi-feature .hmi-events p{font-size:12px;margin:0 0 13px}
.yellow-hmi-feature .hmi-events time{color:#657c8c}
@media(max-width:900px){.yellow-hmi-feature{grid-template-columns:1fr;gap:30px;padding:28px}.yellow-hmi-feature .hmi-description{max-width:600px}.yellow-hmi-feature .hmi-preview{max-width:600px;width:100%}}
@media(max-width:450px){.yellow-hmi-feature{padding:22px}.yellow-hmi-feature .hmi-side{display:none}.yellow-hmi-feature .hmi-screen-body{grid-template-columns:1fr}.yellow-hmi-feature .hmi-content{margin:8px;padding:8px}.yellow-hmi-feature .hmi-table{font-size:11px}}
</style>
<div class="yellow-hmi-feature">
<div><p class="hmi-label"><span data-lang="ru">ДЕМО HMI</span><span data-lang="en" hidden>HMI DEMO</span></p>
<h2 id="yellow-hmi-title"><span data-lang="ru">Посмотрите,<br>что видит оператор.</span><span data-lang="en" hidden>Explore the<br>operator interface.</span></h2>
<p class="hmi-description"><span data-lang="ru">Откройте интерфейс системы. Проверьте показания АКБ, изучите историю отключений и журнал аварий.</span><span data-lang="en" hidden>Explore battery readings, historical power outages and the alarm log in the system interface.</span></p>
<a class="hmi-launch" href="/hmi/"><span data-lang="ru">Открыть демо HMI</span><span data-lang="en" hidden>Explore HMI demo</span></a>
<p class="hmi-note"><span data-lang="ru">Демонстрационные данные · вход заполнен</span><span data-lang="en" hidden>Sample data · sign-in details prefilled</span></p></div>
<div class="hmi-preview" aria-label="YELLOW HMI preview"><div class="hmi-screen">
<div class="hmi-screen-top"><span data-lang="ru">Система мониторинга батарей</span><span data-lang="en" hidden>Battery monitoring system</span><span>DEMO</span></div>
<div class="hmi-screen-body"><div class="hmi-side" aria-hidden="true"><strong>YELLOW</strong><span data-lang="ru">Текущие данные</span><span data-lang="en" hidden>Real-time data</span><span data-lang="ru">История</span><span data-lang="en" hidden>History</span><span data-lang="ru">История аварий</span><span data-lang="en" hidden>Alarm log</span></div>
<div class="hmi-content">
<input class="hmi-radio" type="radio" id="hmi-preview-data" name="hmi-preview" checked aria-label="Battery readings">
<input class="hmi-radio" type="radio" id="hmi-preview-events" name="hmi-preview" aria-label="Historical events">
<div class="hmi-tabs"><label for="hmi-preview-data"><span data-lang="ru">Текущие данные</span><span data-lang="en" hidden>Readings</span></label><label for="hmi-preview-events"><span data-lang="ru">События</span><span data-lang="en" hidden>Events</span></label></div>
<div class="hmi-data"><p class="hmi-preview-caption"><span data-lang="ru">Группа АКБ 1 · Напряжение</span><span data-lang="en" hidden>Battery group 1 · Voltage</span></p>
<table class="hmi-table"><thead><tr><th><span data-lang="ru">АКБ</span><span data-lang="en" hidden>Cell</span></th><th>V</th><th>°C</th><th><span data-lang="ru">Состояние</span><span data-lang="en" hidden>Status</span></th></tr></thead>
<tbody><tr><td>01</td><td>13.52</td><td>24.1</td><td><span data-lang="ru">Норма</span><span data-lang="en" hidden>Normal</span></td></tr><tr><td>02</td><td>13.49</td><td>24.3</td><td><span data-lang="ru">Норма</span><span data-lang="en" hidden>Normal</span></td></tr><tr class="hmi-warning"><td>03</td><td>12.78</td><td>24.7</td><td><span data-lang="ru">Ниже порога</span><span data-lang="en" hidden>Below limit</span></td></tr><tr><td>04</td><td>13.51</td><td>24.2</td><td><span data-lang="ru">Норма</span><span data-lang="en" hidden>Normal</span></td></tr></tbody></table></div>
<div class="hmi-events"><p><time>10:00</time><br><span data-lang="ru">Отключение питания</span><span data-lang="en" hidden>Power outage</span></p><p><time>10:25 · #03</time><br><span data-lang="ru">Напряжение ниже порога</span><span data-lang="en" hidden>Voltage below threshold</span></p><p><time>12:00 · #03</time><br><span data-lang="ru">Параметры восстановлены</span><span data-lang="en" hidden>Normal readings restored</span></p></div>
</div></div></div></div>
</div></section>`;

function isPrivatePath(path) {
  return /^\/(admin|partner-api|embed)(\/|$)/.test(path) ||
    path.startsWith('/runtime/api/') || path.startsWith('/catalog/v1/');
}

function publicPage(response, url) {
  return new HTMLRewriter()
    .on('#monitor-example', {
      element(element) {
        if (url.pathname === '/bms' || url.pathname === '/bms/') element.remove();
      }
    })
    .on('.test-strip, meta[name="robots"]', {
      element(element) { element.remove(); }
    })
    .on('.bms-catalog-hero', {
      element(element) {
        element.after(hmiDemoBlock, {html: true});
      }
    })
    .on('script[src^="/assets/navigation.js"]', {
      element(element) { element.setAttribute('src', '/assets/navigation.js?v=main-20261121'); }
    })
    .on('[href], [src], [action]', {
      element(element) {
        for (const attribute of ['href', 'src', 'action']) {
          const value = element.getAttribute(attribute);
          if (value && (value === previewOrigin || value.startsWith(previewOrigin + '/'))) {
            element.setAttribute(attribute, url.origin + value.slice(previewOrigin.length));
          }
        }
      }
    })
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/hmi' || url.pathname.startsWith('/hmi/')) {
      return env.ASSETS.fetch(request);
    }
    try {
      // The original request origin is retained for cookies, CSRF and generated links.
      const response = await env.CATALOGUE.fetch(request);
      const headers = new Headers(response.headers);
      if (url.pathname === '/assets/navigation.js' && response.ok && request.method === 'GET') {
        const source = (await response.text()).replace(
          "if(!document.querySelector('.test-strip'))",
          "if(location.hostname.startsWith('test.')&&!document.querySelector('.test-strip'))"
        );
        headers.delete('Content-Length');
        headers.delete('ETag');
        headers.set('Cache-Control', 'no-cache');
        return new Response(source, {status: response.status, headers});
      }
      const location = headers.get('Location');
      if (location) {
        const target = new URL(location, url);
        if (target.origin === previewOrigin) {
          headers.set('Location', url.origin + target.pathname + target.search + target.hash);
        }
      }
      const html = response.ok && !isPrivatePath(url.pathname) &&
        headers.get('Content-Type')?.includes('text/html');
      if (html) {
        headers.delete('X-Robots-Tag');
        headers.delete('Content-Length');
        headers.delete('ETag');
      }
      const result = new Response(response.body, {status: response.status, statusText: response.statusText, headers});
      return html && request.method === 'GET' ? publicPage(result, url) : result;
    } catch {
      return new Response('Сайт временно недоступен. Повторите запрос через несколько секунд.', {
        status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}
      });
    }
  }
};
