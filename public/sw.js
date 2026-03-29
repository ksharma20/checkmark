// CheckMark service worker — handles background notification delivery and clicks.
// Kept minimal: no caching strategy, no offline support (handled by native PWA install).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/me') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow('/me')
    })
  )
})
