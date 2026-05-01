export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  function devLog(...args: unknown[]) {
    if (!process.env.VAPID_PUBLIC_KEY) console.info("[push]", ...args);
  }

  function base64UrlToUint8Array(input: string): Uint8Array {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLen);
    const raw = atob(padded);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    let isNew = false
    if (!sub) {
      const keyRes = await fetch('/api/push/vapid-public-key')
      if (!keyRes.ok) {
        devLog("vapid public key unavailable", keyRes.status);
        return;
      }
      const { publicKey } = (await keyRes.json()) as { publicKey: string };
      // TS lib types can treat Uint8Array as ArrayBufferLike; PushManager expects BufferSource.
      const rawKey = base64UrlToUint8Array(
        publicKey,
      ) as unknown as BufferSource;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawKey,
      })
      isNew = true
    }

    const THROTTLE_MS = 24 * 60 * 60 * 1000;
    const THROTTLE_KEY = "checkmark.pushLastUpsertAt";
    const now = Date.now();
    const lastUpsert = (() => {
      try {
        return Number(localStorage.getItem(THROTTLE_KEY) ?? "0");
      } catch {
        return 0;
      }
    })();
    const shouldUpsert =
      isNew || !lastUpsert || now - lastUpsert >= THROTTLE_MS;
    if (!shouldUpsert) return;

    const p256dhBuffer = sub.getKey('p256dh')
    const authBuffer = sub.getKey('auth')
    if (!p256dhBuffer || !authBuffer) return
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhBuffer))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authBuffer))),
        },
      }),
    });
    if (res.ok) {
      try {
        localStorage.setItem(THROTTLE_KEY, String(now));
      } catch {
        // ignore storage failures
      }
      devLog(
        isNew ? "subscribed + upserted" : "upserted existing subscription",
      );
    } else {
      devLog("upsert failed", res.status);
    }
  } catch {
    // push not available — silent
  }
}
