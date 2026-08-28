/* Backbone service worker.
 *
 * Strategy: cache-first with a network fallback. The app is small, fully
 * offline-capable, and has no server, so a precached app shell is enough.
 *
 * ON EVERY RELEASE:
 *   1. Bump CACHE below (wt-v1 -> wt-v2 -> ...). Nothing updates without this.
 *   2. Keep PRECACHE in sync with the files that actually exist.
 *
 * No skipWaiting() here on purpose: app.js detects the waiting worker and only
 * offers "Update ready — Restart" when no workout is in progress, so a reload
 * can never interrupt a live session.
 */

const CACHE = 'wt-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/home.css',
  './css/workout.css',
  './css/history.css',
  './data/routines.js',
  './js/app.js',
  './js/store.js',
  './js/wakelock.js',
  './js/planner.js',
  './js/timer.js',
  './js/cues.js',
  './js/charts.js',
  './js/views/home.js',
  './js/views/workout.js',
  './js/views/history.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Individual adds so one missing file cannot fail the whole install.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] precache miss', url, err);
          })
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin go straight to network

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Runtime-cache same-origin successes so first-visit misses self-heal.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Offline navigation: fall back to the app shell.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
