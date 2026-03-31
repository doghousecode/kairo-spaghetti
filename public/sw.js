const CACHE = 'kairo-v1';

// Precache the app shell and wallpaper on install
const PRECACHE_URLS = [
  '/',
  '/spag.jpg',
  '/manifest.json',
  '/icon.png',
  '/apple-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept API calls — let them fail naturally so the app can handle offline state
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for images (wallpaper, icons)
  if (
    e.request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i.test(url.pathname)
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Cache-first for Vite-hashed JS/CSS bundles (filenames contain a content hash, so stale is safe)
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML navigation — update the shell when online, fall back to cache when not
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }
});
