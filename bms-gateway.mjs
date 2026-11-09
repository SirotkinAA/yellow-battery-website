const service = 'https://test.yellow-battery.com';
const contact = 'mailto:admin@yellow-battery.com';
const sharedAssets = new Set(['/assets/site.css', '/assets/site.js', '/assets/navigation.css', '/assets/yellow.svg',
  '/assets/bms.css', '/assets/bms.js', '/assets/bms-sizing.js']);

function isBmsPage(path) {
  return path === '/bms' || path.startsWith('/bms/');
}

function isBmsAsset(path) {
  return sharedAssets.has(path) || path.startsWith('/assets/bms/') ||
    path.startsWith('/assets/docs/yellow-bms/');
}

function publicPage(response) {
  return new HTMLRewriter()
    .on('.test-strip, .account-link, meta[name="robots"], script[src^="/assets/prices.js"], script[src^="/assets/navigation.js"]', {
      element(element) { element.remove(); }
    })
    .on('a[href^="/"]', {
      element(element) {
        const href = element.getAttribute('href');
        const path = new URL(href, service).pathname;
        if (path === '/' || isBmsPage(path) || isBmsAsset(path)) return;
        if (path === '/contacts/') element.setAttribute('href', contact);
        else if (path === '/documents/') element.setAttribute('href', '/bms/#documentation');
        else element.remove();
      }
    })
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!isBmsPage(url.pathname) && !isBmsAsset(url.pathname)) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
    }
    const upstream = new URL(service);
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const requestHeaders = new Headers();
    for (const name of ['Accept', 'Range', 'If-Range', 'If-None-Match', 'If-Modified-Since']) {
      if (request.headers.has(name)) requestHeaders.set(name, request.headers.get(name));
    }
    try {
      const response = await fetch(upstream, {method: request.method, headers: requestHeaders, redirect: 'manual'});
      const headers = new Headers(response.headers);
      headers.delete('Set-Cookie');
      const location = headers.get('Location');
      if (location) {
        const target = new URL(location, service);
        if (target.origin === service) headers.set('Location', target.pathname + target.search + target.hash);
      }
      const html = response.ok && isBmsPage(url.pathname) && headers.get('Content-Type')?.includes('text/html');
      if (html) {
        headers.delete('X-Robots-Tag');
        headers.delete('Content-Length');
        headers.delete('ETag');
      }
      const result = new Response(response.body, {status: response.status, headers});
      return html && request.method === 'GET' ? publicPage(result) : result;
    } catch {
      return new Response('BMS catalogue temporarily unavailable.', {status: 503, headers: {'Cache-Control': 'no-store'}});
    }
  }
};
