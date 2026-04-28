export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    let isNew = false
    if (!sub) {
      const keyRes = await fetch('/api/push/vapid-public-key')
      if (!keyRes.ok) return
      const { publicKey } = (await keyRes.json()) as { publicKey: string }
      const rawKey = Uint8Array.from(
        atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      )
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawKey,
      })
      isNew = true
    }
    if (!isNew) return
    const p256dhBuffer = sub.getKey('p256dh')
    const authBuffer = sub.getKey('auth')
    if (!p256dhBuffer || !authBuffer) return
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authBuffer))),
        },
      }),
    })
  } catch {
    // push not available — silent
  }
}
