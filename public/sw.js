self.addEventListener('push', function (event) {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }

  const options = {
    body: payload.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: payload.tag ?? 'checkmark',
    requireInteraction: payload.requireInteraction ?? true,
    vibrate: [200, 100, 200],
    renotify: true,
    actions: payload.actions ?? [],
    data: payload.data ?? {},
  }

  // Tell any open windows so they can show an in-app toast + play sound
  const notifyClients = self.clients
    .matchAll({ includeUncontrolled: true, type: 'window' })
    .then((windowClients) =>
      windowClients.forEach((client) =>
        client.postMessage({
          type: 'push-received',
          title: payload.title,
          body: payload.body,
        })
      )
    )

  event.waitUntil(
    Promise.all([
      notifyClients,
      self.registration.showNotification(payload.title, options),
    ])
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const action = event.action

  if (action === 'extend') {
    event.waitUntil(
      fetch('/api/checkin/extend', { method: 'POST', credentials: 'include' })
        .then(() => clients.openWindow('/me'))
        .catch(() => clients.openWindow('/me'))
    )
    return
  }

  if (action === 'checkout') {
    event.waitUntil(
      fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'midnight_auto_checkout' }),
        credentials: 'include',
      })
        .then(() => clients.openWindow('/me'))
        .catch(() => clients.openWindow('/me'))
    )
    return
  }

  const url = event.notification.data?.url ?? '/me'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes('/me') && 'focus' in client) return client.focus()
        }
        return clients.openWindow(url)
      })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
