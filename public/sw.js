/**
 * MusicShare Service Worker
 * - Caches the app shell for fast loads and offline fallback
 * - Required for Chrome's PWA install prompt
 */

const CACHE_NAME = 'musicshare-v1';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = ['/', '/manifest.json', '/favicon.png', '/icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Remove old caches from previous versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls — always go to network for those
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Serve from cache first; if not cached, fetch from network
      return (
        cached ||
        fetch(event.request).catch(() => {
          // If both fail (offline + not cached), return the cached root as fallback
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        })
      );
    })
  );
});
