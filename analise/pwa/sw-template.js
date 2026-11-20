// SERVICE WORKER do Apex Performance (/analise/) — gerado no build (vite.config.ts).
// Guarda no aparelho tudo o que o app precisa para abrir sem internet (HTML, JS, CSS,
// fontes, ícones). Os dados continuam no localStorage/IndexedDB, como sempre.
// - Arquivos do build: primeiro o cache (têm nome com hash, não mudam).
// - Página (navegação): primeiro a rede; sem rede, a cópia guardada.
// - Todo o resto (clima, sync, mapa de ruas, CDN do OCR): vai direto à rede, sem cache.
const VERSION = '__VERSION__';
const CACHE = 'apex-analise-' + VERSION;
const FILES = __FILES__; // relativos a este arquivo
const URLS = FILES.map((f) => new URL(f, self.location).href);
const INDEX = new URL('./', self.location).href;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('apex-analise-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // rede externa: sem interferência
  if (req.mode === 'navigate') {
    if (!url.href.startsWith(INDEX)) return; // só as páginas do /analise/ (nunca o app da raiz nem o /analise-v1/)
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(INDEX, copy)); }
      return r;
    }).catch(() => caches.match(INDEX, { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
});
