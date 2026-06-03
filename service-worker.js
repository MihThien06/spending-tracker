// service-worker.js — Cache app để dùng offline
const CACHE_NAME = 'spending-tracker-v1';

// Danh sách file cần cache
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/db.js',
  '/js/app.js',
  '/manifest.json',
];

// Cài đặt: cache tất cả file
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Khi fetch: dùng cache trước, fallback về network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});