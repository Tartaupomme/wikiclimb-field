const CACHE_NAME = 'wc-field-v6';

// Fichiers essentiels mis en cache à l'installation
const ASSETS = [
  './',
  './index.html',
  './boolder-blocs.geojson',
  './boolder-rochers.geojson',
  './drone-missions.json',
  './boulder-groups.json',
  './photo-groups.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
];

// Domaines de tuiles carte — cachées progressivement quand l'utilisateur navigue
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'data.geopf.fr',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Nettoyer les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Tuiles carte : network-first, puis cache en fallback
  // Les tuiles visitées en ligne sont gardées pour l'offline
  if (TILE_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Autres fichiers : cache-first (assets installés)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
