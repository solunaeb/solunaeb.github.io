// 서비스 워커 — 첫 접속 때 모든 리소스(편지·음원 포함)를 저장해 오프라인에서도 동작
importScripts('./data/build-info.js');
const APP_VERSION = 'v1.6.1';
const CACHE = `neuru-${APP_VERSION}-${self.CONTENT_BUILD || 'dev'}`;
const CORE = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/main.js', './js/config.js', './js/time.js', './js/store.js', './js/content.js', './js/audio.js',
  './js/scene.js', './js/sprites.js', './js/cat.js', './js/effects.js', './js/weather.js', './js/notify.js',
  './js/ui.js', './js/panels.js', './js/catdraw.js', './js/room2.js', './js/speech.js', './js/chat.js', './js/secure.js',
  './fonts/Galmuri11.woff2', './fonts/Galmuri11-Bold.woff2', './fonts/GalmuriMono11.woff2', './fonts/Galmuri9.woff2', './fonts/Galmuri14.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png', './icons/badge-96.png', './icons/icon-maskable-512.png',
  './data/content.json', './data/build-info.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.concat(self.CONTENT_FILES || self.CONTENT_AUDIO || []));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.searchParams.has('__time')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});

// 웹 푸시 (GitHub Actions 가 보냄)
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || '널 사랑할고양', {
    body: data.body || '', tag: data.tag, icon: './icons/icon-192.png', badge: './icons/badge-96.png', data: { url: './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  })());
});
