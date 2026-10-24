const CACHE_NAME = 'minijuegos-cen-v49';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/css/game.css?v=42',
  './src/js/audio.js?v=35',
  './src/js/economy.js?v=30',
  './src/js/store-ui.js?v=28',
  './src/js/theme.js?v=23',
  './src/js/ui.js?v=30',
  './src/js/game-config.js?v=29',
  './src/js/game-pace.js?v=29',
  './src/js/game-scene.js?v=29',
  './src/js/game-character.js?v=28',
  './src/js/game-overlay.js?v=28',
  './src/js/game.js?v=29',
  './src/js/fighter/config.js',
  './src/js/fighter/engine.js',
  './src/js/fighter/random.js',
  './src/js/fighter/sprite-contract.js',
  './src/js/fighter/roster.js',
  './src/js/fighter/team-match.js',
  './src/js/fighter/cpu.js',
  './src/js/fighter/learning.js',
  './src/js/fighter/renderer.js?v=42',
  './src/js/fighter/game.js?v=42',
  './assets/fighters/stages/01-biblioteca.png',
  './assets/fighters/stages/02-campus-nocturno.png',
  './assets/fighters/stages/03-jardin.png',
  './assets/fighters/stages/04-fachada.png',
  './assets/fighters/stages/05-monumento.png',
  './assets/fighters/roster-atlas.png',
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
  './assets/avatars/community/avatar-01.webp',
  './assets/avatars/community/avatar-02.webp',
  './assets/avatars/community/avatar-03.webp',
  './assets/avatars/community/avatar-04.webp',
  './assets/avatars/community/avatar-05.webp',
  './assets/avatars/community/avatar-06.webp',
  './assets/avatars/community/avatar-07.webp',
  './assets/avatars/community/avatar-08.webp',
  './assets/avatars/community/avatar-09.webp',
  './assets/avatars/community/avatar-10.webp',
  './assets/avatars/community/avatar-11.webp',
  './assets/avatars/community/avatar-12.webp',
  './assets/avatars/community/avatar-13.webp',
  './assets/avatars/community/avatar-14.webp',
  './assets/avatars/community/avatar-15.webp',
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
