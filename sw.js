const CACHE_NAME = "dcp-bucket-list-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
      await self.clients.claim();

      // Refresh any already-open installed app/window once so it immediately
      // picks up the newest HTML instead of staying on the old cached shell.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        clients.map(client => client.navigate(client.url).catch(() => null))
      );
    })()
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const isNavigation = request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});