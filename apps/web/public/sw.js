// Minimal offline shell cache. Network-first for navigation; stale-while-revalidate for static.
const VERSION = "v1";
const STATIC_CACHE = `vfd-static-${VERSION}`;
const NAVIGATION_CACHE = `vfd-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, NAVIGATION_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Never intercept API or NextAuth — let sync engine detect offline cleanly.
  if (url.pathname.startsWith("/api/")) return;

  // App navigations: network-first with offline fallback to last cached version.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(NAVIGATION_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(NAVIGATION_CACHE);
          const cached = await cache.match(request);
          return (
            cached ??
            (await cache.match("/dashboard")) ??
            new Response("Offline", { status: 503 })
          );
        }
      })()
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached ?? network;
      })()
    );
  }
});
