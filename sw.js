const CACHE = 'jultidningar-v7';
const FILER = ['./', './index.html', './app.js', './style.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILER)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CACHE + '-bilder').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // Supabase går alltid mot nätet
  if (url.pathname.includes('/katalog/')) { // katalogbilder ändras aldrig: cache först
    e.respondWith(caches.match(e.request).then(s => s || fetch(e.request).then(svar => { caches.open(CACHE + '-bilder').then(c => c.put(e.request, svar.clone())); return svar; })));
    return;
  }
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(svar => {
      const kopia = svar.clone();
      caches.open(CACHE).then(c => c.put(e.request, kopia));
      return svar;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(s => s || caches.match('./index.html')))
  );
});
