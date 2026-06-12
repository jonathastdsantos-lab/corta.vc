// Corta.vc Service Worker — cache shell para PWA offline
const CACHE_NAME = 'corta-vc-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/manifest.json',
  '/ui.jsx',
  '/data.jsx',
  '/tweaks-panel.jsx',
  '/plans.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Só intercepta GET
  if (event.request.method !== 'GET') return;
  // Não intercepta requisições Supabase/API
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('anthropic')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cacheia apenas respostas ok de arquivos estáticos
        if (response.ok && (url.pathname.endsWith('.css') || url.pathname.endsWith('.jsx') || url.pathname.endsWith('.js'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
