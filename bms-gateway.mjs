const previewOrigin = 'https://test.yellow-battery.com';

function isPrivatePath(path) {
  return /^\/(admin|partner-api|embed)(\/|$)/.test(path) ||
    path.startsWith('/runtime/api/') || path.startsWith('/catalog/v1/');
}

function publicPage(response, url) {
  return new HTMLRewriter()
    .on('.test-strip, meta[name="robots"]', {
      element(element) { element.remove(); }
    })
    .on('.bms-catalog-hero .button-row', {
      element(element) {
        element.append('<a class="button" href="/hmi/"><span data-lang="ru">Открыть демо HMI</span><span data-lang="en" hidden>Explore HMI demo</span></a>', {html: true});
      }
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
