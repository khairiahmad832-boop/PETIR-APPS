const CACHE_NAME = 'petir-v10-ultimate'; // Versi Baru
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Cache Library Eksternal agar loading cepat
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 1. Install Service Worker & Cache File
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa install langsung tanpa menunggu
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('PETIR V10: Caching files');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Ambil file dari Cache atau Internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Jika ada di cache, pakai itu. Jika tidak, ambil dari internet.
        return response || fetch(event.request);
      })
  );
});

// 3. Hapus Cache Lama (Pembersihan Otomatis)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('PETIR V10: Menghapus cache lama ->', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
