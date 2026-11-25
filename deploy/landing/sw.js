// The office app moved from / to /admin/ (ADR-0023). Browsers and iPads that installed it at /
// still have its old service worker; this replacement removes it, drops its caches and sends
// the open windows to the same page under /admin/ (data in IndexedDB stay: same origin).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;
      for (const key of await caches.keys()) {
        if (key.endsWith(scope)) await caches.delete(key);
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        const url = new URL(client.url);
        if (!/^\/(admin|ukazka|spike)\//.test(url.pathname)) {
          client.navigate(`/admin${url.pathname === '/' ? '/' : url.pathname}${url.search}`);
        }
      }
    })(),
  );
});
