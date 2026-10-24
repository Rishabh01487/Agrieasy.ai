// Agrieasy.ai service worker — offline-first app shell
const VERSION = "agrieasy-v2.1.0";
const CORE = ["./", "index.html", "styles.css", "kb.js", "plan.js", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
        const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
      }).catch(() => caches.match("./index.html")))
    );
  }
});
// WebLLM weights are cached by the WebLLM library itself (Cache Storage), so the
// downloaded model also works offline without extra handling here.
