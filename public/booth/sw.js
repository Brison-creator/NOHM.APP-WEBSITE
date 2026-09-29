// Keeps the booth running when the venue Wi-Fi doesn't. Everything the booth
// needs is cached on first load; after that it tries the network first (so a
// fix on the site reaches the booth) and falls back to the cache after three
// seconds or when offline. Bump CACHE when the list changes.
var CACHE = 'nohm-booth-v1';
var FILES = [
  '/booth/',
  '/booth/booth.css',
  '/booth/booth.js',
  '/booth/manifest.webmanifest',
  '/booth/qr-try.svg',
  '/booth/icon-192.png',
  '/booth/icon-512.png',
  '/booth/apple-touch-icon.png',
  '/how-it-works/demo.js',
  '/how-it-works/demo.css',
  '/type.css',
  '/pricing.js',
  '/fonts/sora/sora-latin-700-800.woff2',
  '/fonts/manrope/manrope-latin-400-700.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  var cached = function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || (req.mode === 'navigate' ? caches.match('/booth/') : undefined);
    });
  };
  var network = fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  });
  var slow = new Promise(function (resolve) { setTimeout(resolve, 3000); }).then(cached);
  e.respondWith(
    Promise.race([network, slow]).then(function (r) { return r || network; })
      .catch(function () { return cached().then(function (r) { return r || Response.error(); }); })
  );
});
