// Service worker: vždy se nejdřív zeptá serveru na nejnovější verzi souborů
// (obejde 10minutovou mezipaměť GitHub Pages). Bez internetu použije uloženou kopii.
const CACHE = 'fantom';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Jen vlastní soubory hry; mapové dlaždice a knihovny nechává být
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
