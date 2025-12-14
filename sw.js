const CACHE_NAME = 'petir-v17-hyper-pro-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  // Library Eksternal (Dicache agar offline/loading cepat)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Inter:wght@300;400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  // Audio Alarm
  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
];

// 1. INSTALL SERVICE WORKER
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa aktif segera
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('PETIR SYSTEM: Caching Assets...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. FETCH RESOURCES (CACHE FIRST STRATEGY)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Jika ada di cache, pakai itu. Jika tidak, ambil dari internet.
        return response || fetch(event.request);
      })
  );
});

// 3. ACTIVATE & CLEANUP OLD CACHE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('PETIR SYSTEM: Menghapus Cache Lama ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
