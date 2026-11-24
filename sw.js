/* Plans service worker — offline app shell + Apple Calendar hand-off */
const CACHE = 'plans-v1.5.1';
const SHELL = [
  './', './index.html', './styles.css?v=1.5.1', './app.js?v=1.5.1', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Builds a real text/calendar response for ".../calendar/<name>.ics?e=<base64url>"
   so iOS shows its native "Add All" calendar preview (works from the Home Screen too). */
function calendarResponse(url) {
  try {
    let b64 = (url.searchParams.get('e') || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const name = decodeURIComponent(url.pathname.split('/').pop() || 'plan.ics').replace(/[^\w.-]/g, '') || 'plan.ics';
    return new Response(bytes, { status: 200, headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'no-store'
    } });
  } catch (err) {
    return new Response('Could not build the calendar event.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle our own files; place search + map tiles go straight to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/calendar/') && url.pathname.endsWith('.ics') && url.searchParams.has('e')) {
    e.respondWith(calendarResponse(url));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
