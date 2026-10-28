/* Word Rattle offline support: keeps the game on the phone so it opens with no connection. */
const CACHE = "wordrattle-v4";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" || url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(url.hostname)) e.respondWith(cacheFirst(req));
});
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  const key = req.mode === "navigate" ? "./index.html" : req;
  try {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(key, { ignoreSearch: true });
    return hit || Response.error();
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") c.put(req, res.clone());
    return res;
  } catch (err) { return Response.error(); }
}
