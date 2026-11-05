// Retirement worker for existing installations. Atlas API and private reports
// are intentionally network-only; do not retain the legacy generic cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('kenya-landlord-link') || key.startsWith('homara-atlas')).map(key => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    await Promise.all(windows.map(client => client.navigate(client.url)));
  })());
});
