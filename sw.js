// Yalda Anar - service worker (v0.0.5, auto-update)
// Precaches the full app shell; network-first for navigations so installed PWAs pick up new versions,
// cache-first for assets. The page shows an "update available" banner (gamekit.js) -> postMessage('skipWaiting').
const CACHE = 'yalda-anar-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './main.js',
  './mobile-ux.js',
  './gamekit.js',
  './vendor/howler.min.js',
  './vendor/sfx/shoot.wav',
  './vendor/sfx/hit.wav',
  './vendor/sfx/explode.wav',
  './vendor/sfx/coin.wav',
  './vendor/sfx/jump.wav',
  './vendor/sfx/over.wav',
  './vendor/sfx/start.wav',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (e) => {
  // No skipWaiting here: a new SW waits so gamekit.js can show an "update available"
  // banner and the user chooses when to apply it (postMessage('skipWaiting') below).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Navigations: network-first so users get the latest HTML/version automatically.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match(req)))
    );
    return;
  }
  // Assets: cache-first, fall back to network (and cache it).
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
