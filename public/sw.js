// ===== IIDZII POS Service Worker - العمل بدون إنترنت =====
const CACHE_NAME = 'iidzii-v2';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './assets/index.js',
  './assets/index.css',
  './fonts/Ubuntu Arabic Regular.otf',
  './iidzii.png',
  './icon.png'
];

// تثبيت: تخزين جميع الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// تفعيل: حذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// اعتراض الطلبات: الكاش أولاً
self.addEventListener('fetch', (event) => {
  // تجاهل الطلبات غير HTTP
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // إذا فشل الاتصال، أعد صفحة index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
