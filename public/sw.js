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

/**
 * Open the URL a push asked for.
 *
 * Order matters, and the old version had it wrong: it focused *any* window
 * whose URL merely contained '/me' and then returned, so `data.url` was thrown
 * away for anybody with the PWA already open - a document-rejected push landed
 * you on the check-in screen. The rules now are:
 *
 *   1. a client already on the target URL  → just focus it (no reload)
 *   2. any other open client               → navigate it, then focus
 *   3. nothing open                        → open a new window
 *
 * `client.navigate()` is only available to a service worker on same-origin
 * clients it controls, so step 3 also catches the case where it is missing.
 */
function openTarget(url) {
  const target = new URL(url, self.location.origin).href
  return clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === target && 'focus' in client) return client.focus()
      }
      for (const client of windowClients) {
        if ('navigate' in client) {
          return client
            .navigate(target)
            .then((navigated) => (navigated && 'focus' in navigated ? navigated.focus() : undefined))
            .catch(() => clients.openWindow(target))
        }
      }
      return clients.openWindow(target)
    })
    .catch(() => clients.openWindow(target))
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const action = event.action

  if (action === 'extend') {
    event.waitUntil(
      fetch('/api/checkin/extend', { method: 'POST', credentials: 'include' })
        .then(() => openTarget('/me'))
        .catch(() => openTarget('/me'))
    )
    return
  }

  if (action === 'checkout') {
    event.waitUntil(
      fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'push_action_checkout' }),
        credentials: 'include',
      })
        .then(() => openTarget('/me'))
        .catch(() => openTarget('/me'))
    )
    return
  }

  // Every server-side push now carries `data.url`, built by
  // `notificationHref()` - the same resolver the in-app rows use, so tapping a
  // push and tapping its feed row land in the same place. '/me' is the
  // fallback for a legacy notification stored before that existed.
  event.waitUntil(openTarget(event.notification.data?.url ?? '/me'))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
