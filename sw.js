// KIMCHI MART REWARDS — service worker
// Network-first for HTML/JS/CSS so deploys are picked up immediately,
// cache-first for icons/static assets.
const CACHE = 'kmr-v4';

const CORE = [
  './',
  './index.html',
  './login.html',
  './deals.html',
  './refer.html',
  './history.html',
  './account.html',
  './membership.html',
  './subscribe.html',
  './admin-deals.html',
  './admin-notify.html',
  './admin-referrals.html',
  './pos-import.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './pwa-assets/icon-192.png',
  './pwa-assets/icon-512.png',
  './pwa-assets/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only same-origin GET
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never intercept Firebase live traffic
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebasedatabase.app')) return;

  const isStatic = /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)
                || url.pathname.endsWith('.webmanifest');

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Network-first for HTML / JS / CSS
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
