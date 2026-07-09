/**
 * movieCC Service Worker (SSR Desktop)
 * Caching strategies:
 * - CacheFirst: CSS, JS, fonts, favicon
 * - StaleWhileRevalidate: Images
 * - NetworkFirst: HTML pages
 */

const CACHE_VERSION = 'moviecc-v2';
const STATIC_CACHE = CACHE_VERSION + '-static';
const IMAGE_CACHE = CACHE_VERSION + '-images';

const PRECACHE_URLS = [
  '/',
  '/css/bundle.min.css',
  '/js/app.min.js',
  '/images/favicon.svg',
  '/images/no-poster.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== IMAGE_CACHE)
            .map((k) => caches.delete(k))
        );
      }),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/app/')) return;

  if (url.pathname.match(/\.(css|js|woff2?|svg|ico)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|avif)$/) || url.pathname.startsWith('/images/')) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match('/');
    if (fallback) return fallback;
    return new Response('<h1>Offline</h1><p>Vui lòng kiểm tra kết nối mạng.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
