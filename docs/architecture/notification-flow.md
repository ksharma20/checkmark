# Notification & Push Flow

---

## 1. Overview

CheckMark sends two categories of notifications:

| Category | Trigger | Mechanism |
|----------|---------|-----------|
| Stale reminders | 4h, 8h, 12h, 16h, 18h, 20h, 22h from check-in | Client `setTimeout` + SW `showNotification` |
| Auto-checkout warning | T−15 min before `scheduled_checkout_at` | Client `setTimeout` + SW `showNotification` |
| Auto-checkout | At `scheduled_checkout_at` (T+12h) | Client `setTimeout` → `POST /api/checkin/checkout` |
| Server push (cron) | Hourly cron (server-driven) | `POST /api/push/cron` → `sendPushToUser()` → VAPID → SW |

Notes:
- The cron endpoint requires `Authorization: Bearer ${CRON_SECRET}` and is **disabled** if `CRON_SECRET` is not set in the runtime environment.
- The bundled GitHub Actions workflow (`.github/workflows/push-reminders.yml`) is intentionally skipped unless both `CRON_SECRET` and `APP_URL` secrets are configured in that repo.

When the app is **open**: `showNotification()` fires + `playChime()` sounds + in-app toast appears.
When the app is **closed**: SW receives the push event → OS notification popup.

---

## 2. Push Subscription Setup

```mermaid
sequenceDiagram
  participant U as Browser
  participant SW as Service Worker
  participant API as /api/push/*
  participant DB as push_subscriptions

  Note over U: After successful check-in

  U->>U: navigator.serviceWorker.ready
  U->>SW: reg.pushManager.getSubscription()
  alt no existing subscription
    U->>API: GET /api/push/vapid-public-key
    API-->>U: { publicKey: "BF..." }
    U->>U: Convert base64url → Uint8Array
    U->>SW: reg.pushManager.subscribe({\n  userVisibleOnly: true,\n  applicationServerKey: rawKey\n})
    SW-->>U: PushSubscription { endpoint, keys }
  end
  U->>API: POST /api/push/subscribe\n{ endpoint, keys: { p256dh, auth } }
  API->>API: getServerUser() - userId from header
  API->>DB: upsertPushSubscription(userId, endpoint, p256dh, auth)
  API-->>U: { success: true }
```

---

## 3. Client-Side Notification Scheduling

```mermaid
flowchart TD
  A[activeEvent changes\nor page loads with activeEvent] --> B[useEffect fires]
  B --> C[Clear all existing timers\nnotifTimers.current.forEach clearTimeout]
  C --> D[checkinMs = new Date activeEvent.checkin_at]
  D --> E[scheduledCheckoutMs =\nactiveEvent.scheduled_checkout_at\n?? checkinMs + 12h]

  subgraph StaleTimers["Stale Reminder Timers"]
    E --> F{For each hour in\n4,8,12,16,18,20,22}
    F --> G[delay = checkinMs + hour×3600000 − now]
    G --> H{delay > 0?}
    H -->|Yes| I[window.setTimeout\nfireStaleNotification hour\n+ in-app toast\n+ playChime]
    H -->|No| J[skip - already past]
  end

  subgraph WarningTimer["Auto-checkout Warning"]
    E --> K[warningDelay = scheduledCheckoutMs − 15min − now]
    K --> L{warningDelay > 0?}
    L -->|Yes| M[window.setTimeout\nfireMidnightWarning\n+ playChime + toast]
    L -->|No - in warning window| N[fire immediately]
  end

  subgraph CheckoutTimer["Auto-checkout"]
    E --> O[checkoutDelay = scheduledCheckoutMs − now]
    O --> P{checkoutDelay > 0?}
    P -->|Yes| Q[window.setTimeout\ntriggerAutoCheckout]
    P -->|No - overdue| R[triggerAutoCheckout immediately]
  end
```

---

## 4. Notification Display - Browser/SW Path

```mermaid
flowchart TD
  A[fireStaleNotification or\nfireMidnightWarning called] --> B[playChime\nWeb Audio API tone]
  B --> C[onFired callback\nshowToast in-app]
  C --> D{'serviceWorker' in navigator?}
  D -->|Yes| E[navigator.serviceWorker.ready]
  E --> F[reg.showNotification title, opts]
  F --> G[SW shows OS notification\nrequireInteraction: true]
  D -->|No fallback| H[new Notification title, opts]
  H --> I[Basic browser notification]
```

**requireInteraction: true** - notification stays visible until user interacts. Without this, notifications auto-dismiss in a few seconds on some platforms.

**Why notifications might appear only in notification center (not as popups):** Chrome's per-site "quiet notifications" setting. Users can change this at `chrome://settings/content/notifications → [site] → Allow popups`.

---

## 5. Service Worker Push Handler

```mermaid
sequenceDiagram
  participant Server as Server (sendPushToUser)
  participant PS as Browser Push Service (GCM/FCM)
  participant SW as public/sw.js
  participant OS as Operating System
  participant Page as Open Browser Tab

  Server->>PS: webpush.sendNotification(subscription, payload)
  PS->>SW: push event

  SW->>SW: event.data.json() → payload

  par Notify open tabs
    SW->>Page: clients.matchAll()\nclient.postMessage({ type: 'push-received', ...payload })
  and Show OS notification
    SW->>OS: registration.showNotification(title, {\n  body, icon, tag, requireInteraction,\n  actions: [extend, checkout],\n  vibrate: [200,100,200]\n})
  end

  OS-->>User: Notification popup / system tray
```

---

## 6. In-App Notification (When Page is Open)

When the service worker sends a `postMessage` to open tabs, `CheckinButtons` listens:

```mermaid
sequenceDiagram
  participant SW as Service Worker
  participant CK as CheckinButtons useEffect
  participant UI as Toast + Audio

  SW->>CK: navigator.serviceWorker message event\n{ type: 'push-received', title, body }
  CK->>UI: playChime() - Web Audio API tone
  CK->>UI: showToast(body, 'info') - 4s in-app banner
```

This means even if the OS notification is silenced, the app always shows a visible + audible alert when it's open.

---

## 7. Notification Click - Service Worker Handler

```mermaid
flowchart TD
  A[User clicks OS notification] --> B{action?}
  B -->|'extend'| C[POST /api/checkin/extend\n+ clients.openWindow /me]
  B -->|'checkout'| D[POST /api/checkin/checkout\nreason: midnight_auto_checkout\n+ clients.openWindow /me]
  B -->|no action - notification body click| E[clients.matchAll type:window]
  E --> F{existing /me tab open?}
  F -->|Yes| G[client.focus]
  F -->|No| H[clients.openWindow /me]
  C --> I[extend handler: setScheduledCheckout\nnow + 8h]
```

---

## 8. Sound - Web Audio API Chime

No audio file needed. Generates a pure-tone chime at runtime:

```typescript
function playChime(): void {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  // Three-tone sequence: 880Hz → 1100Hz → 880Hz
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)
  osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
  osc.start()
  osc.stop(ctx.currentTime + 0.7)
}
```

Plays regardless of OS notification settings (it's direct audio output, not tied to the notification system).

---

## 9. Notification Deduplication

Each notification type uses a unique `tag`:

| Notification | Tag | requireInteraction |
|-------------|-----|-------------------|
| Stale reminder | `checkmark-stale` | `true` |
| Auto-checkout warning | `checkmark-midnight-warning` | `true` |
| Check-in confirmation | `checkmark-checkin-confirm` | `false` |

Using the same `tag` replaces the previous notification with the same tag - no notification spam. The stale reminder at 4h replaces itself at 8h, 12h, etc.

---

## 10. Push Subscription Cleanup

When a push delivery fails with HTTP 410 (Gone - subscription expired), the endpoint is automatically removed:

```typescript
// In lib/push.ts
.catch(async (err: { statusCode?: number }) => {
  if (err.statusCode === 410) {
    await deletePushSubscription(userId, sub.endpoint)
  }
})
```
