const CACHE_NAME = 'ninja-dash-v16';

// Obavezni resursi (moraju postojati) — keširaju se atomično.
const CORE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/config.js',
  './js/storage.js',
  './js/audio.js',
  './js/input.js',
  './js/player.js',
  './js/entities.js',
  './js/levels.js',
  './js/ui.js',
  './js/game.js'
];

// Opcioni resursi (audio/ikone) — mogu nedostajati; keširamo pojedinačno bez pada install-a.
const OPTIONAL = [
  './icon-192.png',
  './icon-512.png',
  './assets/music.mp3',
  './assets/jump.mp3',
  './assets/gameover.mp3',
  './assets/coin.mp3',
  './assets/orb.mp3',
  './assets/pad.mp3',
  './assets/complete.mp3',
  './assets/level1.mp3',
  './assets/level2.mp3',
  './assets/level3.mp3',
  './assets/level4.mp3',
  './assets/level5.mp3'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE);
      // Opcione pokušavamo pojedinačno — nedostajući fajl ne ruši instalaciju.
      await Promise.allSettled(OPTIONAL.map(url => cache.add(url)));
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
