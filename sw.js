const CACHE_NAME = 'elite-erp-v2';
const ASSETS = [
  'index.html',
  'style.css',
  'app.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instalação: Salva os arquivos no cachê
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Ativação: Limpa cachês antigos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

// Estratégia: Tenta rede, se falhar (offline), usa o cachê
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});