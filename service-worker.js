const CACHE_NAME = 'minijuegos-cen-v12';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/css/game.css',
  './src/js/audio.js',
  './src/js/economy.js',
  './src/js/ui.js',
  './src/js/game.js',
  './assets/icons/flappy-cen.svg',
  './assets/icons/cengames-mark.svg',
  './assets/icons/flappy-birdcen-logo.svg',
  './assets/avatars/sol.svg',
  './assets/avatars/luna.svg',
  './assets/avatars/pixel.svg',
  './assets/avatars/rayo.svg',
  './assets/avatars/ola.svg',
  './assets/avatars/cometa.svg',
  './assets/avatars/prisma.svg',
  './assets/avatars/orbita.svg',
  './assets/avatars/flora.svg',
  './assets/avatars/neon.svg',
  './assets/images/personaje/cuerpo.png',
  './assets/images/personaje/brazo_i.png',
  './assets/images/personaje/brazo_d.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => (key.startsWith('flappy-cen-pro-') || key.startsWith('cen-crew-') || key.startsWith('minijuegos-cen-')) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
