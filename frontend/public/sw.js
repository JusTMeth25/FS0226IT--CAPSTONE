/*
 * Service worker di VinylDex (PWA).
 * - La pagina e i file dell'app restano in cache: l'app si apre anche senza rete (i dati no).
 * - Le chiamate /api e il WebSocket dell'hotel non passano mai dalla cache.
 * - Le notifiche "pacchetto gratis pronto" le mostra da qui, su richiesta della pagina.
 */
const CACHE = 'vinyldex-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('/ws')) return;

  // Pagina: prima la rete (per avere sempre l'ultima versione), senza rete quella in cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // File dell'app (con l'hash nel nome) e immagini: prima la cache, poi la rete.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && (url.pathname.includes('/assets/') || /\.(png|jpg|svg|webp|woff2?)$/.test(url.pathname))) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});

// Clic sulla notifica: si apre (o si riporta in primo piano) l'app sulla pagina dei pacchetti.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './#/packs';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
