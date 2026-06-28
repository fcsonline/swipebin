/*
 * SwipeBin service worker — offline app shell + runtime asset caching.
 *
 * Strategy:
 *   - Navigations: network-first, fall back to the cached app shell when offline.
 *   - Static assets (Vite's hashed JS/CSS, icons, fonts): stale-while-revalidate.
 *   - /api/* and previews: never cached — they mutate real files on disk, and a
 *     stale decision could lie about what's been deleted. Network only.
 *
 * Bump CACHE_VERSION to force every client to drop old caches on activation.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `swipebin-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `swipebin-runtime-${CACHE_VERSION}`;

// Minimal shell precached on install so the app boots with no network.
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Tolerate a missing entry rather than failing the whole install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page trigger an immediate update (used after a new SW is found).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; let cross-origin requests pass through.
  if (url.origin !== self.location.origin) return;
  // Never cache API calls or image previews — always hit the live server.
  if (url.pathname.startsWith('/api/')) return;

  // App navigations: try the network, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((hit) => hit || caches.match('/')),
      ),
    );
    return;
  }

  // Everything else (hashed assets, icons): stale-while-revalidate.
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
