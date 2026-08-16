// Service Worker - 在庫チェックアプリ
const CACHE_NAME = 'zaiko-app-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/firebase-config.js',
  './js/inventory-service.js',
  './js/shopping-service.js',
  './js/camera-manager.js',
  './js/detection/detection-service.js',
  './js/detection/local-engine.js',
  './js/detection/cloud-engine.js',
  './manifest.json'
];

// TensorFlow.js関連（大きいのでランタイムキャッシュ）
const TF_CACHE_NAME = 'zaiko-tf-v1';

// インストール: 静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== TF_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// フェッチ: キャッシュファースト（静的）、ネットワークファースト（API）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase/Google APIはネットワークファースト
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebase')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // TensorFlow.js CDNはキャッシュファースト（大きいので）
  if (url.hostname.includes('cdn.jsdelivr.net') && url.pathname.includes('tensorflow')) {
    event.respondWith(cacheFirst(event.request, TF_CACHE_NAME));
    return;
  }

  // 静的アセットはキャッシュファースト
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
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
  } catch (e) {
    return new Response('オフライン', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('オフライン', { status: 503 });
  }
}
