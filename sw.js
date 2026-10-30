/* Stoneley Games offline support for the website: keeps the home page and every game on the phone
   so they open with no connection. tools/build.py rewrites VERSION whenever a game changes. */
const VERSION = "d4d940b923";
const CACHE = "stoneley-games-" + VERSION;
const CORE = [
  "./", "./index.html", "./shell.js", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable.png", "./apple-touch-icon.png",
  "./games/word-rattle/index.html", "./games/link-up/index.html", "./games/cross-sums/index.html", "./games/gem-bastion/index.html", "./games/topple/index.html", "./games/mudlark/index.html", "./games/boxed-in/index.html", "./games/echo-cartographer/index.html"
];

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
  if (url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (/(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(url.hostname)) e.respondWith(cacheFirst(req));
});
function cacheKey(req) {
  const u = new URL(req.url);
  u.hash = ""; u.search = "";
  if (u.pathname.endsWith("/")) u.pathname += "index.html";
  return u.href;
}
async function networkFirst(req) {
  const c = await caches.open(CACHE), key = cacheKey(req);
  try {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch (err) {
    return (await c.match(key)) || (await c.match(req, { ignoreSearch: true })) || Response.error();
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
