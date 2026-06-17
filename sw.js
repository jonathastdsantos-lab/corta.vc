// Corta.vc Service Worker — cache shell para PWA offline
// v3: só intercepta recursos same-origin; CDNs externos passam direto.
const CACHE_NAME = 'corta-vc-v3';

// Recursos locais a pré-cachear (sem config.js — anon key deve ser sempre fresca)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
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

  const url = new URL(event.request.url);

  // ─── CRÍTICO: Nunca interceptar recursos cross-origin ───────────────────────
  // Se interceptarmos CDNs (unpkg, jsdelivr, fonts.google) e a fetch falhar,
  // o fallback retorna /index.html com MIME text/html — o browser bloqueia
  // scripts e CSS com tipo errado, causando tela branca permanente.
  if (url.origin !== self.location.origin) return;

  // Também não intercepta config.js — anon key precisa sempre estar fresca
  if (url.pathname === '/config.js') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cacheia apenas recursos locais estáticos com resposta OK
        const shouldCache = response.ok && (
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.jsx') ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.json')
        );
        if (shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback SPA apenas para navegação (não para assets)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        // Para outros recursos locais que falharem, retorna erro real
        return new Response('Recurso offline', { status: 503 });
      });
    })
  );
});
