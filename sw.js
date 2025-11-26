const CACHE_NAME = 'petir-v5-fix-excel'; // Ganti versi biar browser refresh
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js' // Cache library excel juga
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa install service worker baru
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Hapus cache lama yang bandel
          }
        })
      );
    })
  );
});
