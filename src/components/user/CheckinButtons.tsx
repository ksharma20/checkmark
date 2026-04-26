'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { PresenceEvent } from '@/lib/db/queries/events'
import { fmtTimeOnDate, fmtHours } from '@/lib/client/format-time'
import { en } from '@/locales/en'
const STALE_NOTIF_KEY = en.constants.staleNotifKey;
const STALE_NOTIF_EVENT_KEY = en.constants.staleNotifEventKey;
const NOTIF_TAG_AUTO_CHECKOUT = en.constants.notifTagAutoCheckout
import { startProgress, stopProgress } from '@/components/shared/TopProgressBar'
import { collectDeviceInfo } from '@/lib/client/device-info'

const NOTIFICATION_SCHEDULE_H = [4, 8, 12, 16, 18, 20, 22];
const NOTIFICATION_MESSAGES = en.notifications.stale
const NOTIF_TAG_STALE = en.constants.notifTagStale;
const AUTO_CHECKOUT_H = 12;

/** Play a short chime via Web Audio API — works regardless of OS notification mode. */
function playChime(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    /* audio context not available */
  }
}

async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const keyRes = await fetch('/api/push/vapid-public-key')
      if (!keyRes.ok) return
      const { publicKey } = await keyRes.json() as { publicKey: string }
      const rawKey = Uint8Array.from(
        atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0)
      )
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawKey,
      })
    }
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

async function fireStaleNotification(
  hour: number,
  onFired?: () => void,
): Promise<void> {
  playChime();
  onFired?.();
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const msg = NOTIFICATION_MESSAGES[hour] ?? {
    title: en.notifications.staleFallback.title,
    body: en.notifications.staleFallback.body(hour),
  };
  const opts: NotificationOptions = {
    body: msg.body,
    icon: "/icon-192.png",
    tag: NOTIF_TAG_STALE,
    requireInteraction: true,
    data: { url: "/me" },
  };
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(msg.title, opts);
      return;
    } catch {
      /* fall through */
    }
  }
  new Notification(msg.title, opts);
}

async function fireMidnightWarning(onFired?: () => void): Promise<void> {
  playChime();
  onFired?.();
  if (typeof window === "undefined") return;
  const opts = {
    body: "You'll be automatically checked out in 15 minutes. Still at work?",
    icon: "/icon-192.png",
    tag: "checkmark-midnight-warning",
    requireInteraction: true,
    actions: [
      { action: "extend", title: "Still here (+8h)" },
      { action: "checkout", title: "Check out now" },
    ],
    data: { url: "/me" },
  };
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("CheckMark: Auto-checkout soon", opts);
      return;
    } catch {
      // fall through to basic Notification
    }
  }
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("CheckMark: Auto-checkout soon", opts);
  }
}

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null
  name: string
}

type ToastType = 'success' | 'info' | 'error'

export default function CheckinButtons({
  activeEvent: initialActiveEvent,
  name,
}: CheckinButtonsProps) {
  const router = useRouter();
  const [state, setState] = useState<"checked_in" | "checked_out">(
    initialActiveEvent ? "checked_in" : "checked_out",
  );
  const [activeEvent, setActiveEvent] = useState(initialActiveEvent);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const notifTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Listen for push messages from the service worker — show in-app toast + play chime
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; title?: string; body?: string }
        | undefined;
      if (data?.type === "push-received") {
        playChime();
        showToast(data.body ?? data.title ?? "Notification", "info");
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule midnight warning (15 min before scheduled checkout) and auto-checkout
  useEffect(() => {
    if (!activeEvent) return;

    const checkinMs = new Date(
      activeEvent.checkin_at.includes("T")
        ? activeEvent.checkin_at
        : activeEvent.checkin_at.replace(" ", "T") + "Z",
    ).getTime();

    const scheduledCheckoutMs = activeEvent.scheduled_checkout_at
      ? new Date(activeEvent.scheduled_checkout_at).getTime()
      : checkinMs + AUTO_CHECKOUT_H * 60 * 60 * 1000; // fallback: 12h from checkin

    // Clear any existing timers
    if (notifTimers.current) {
      notifTimers.current.forEach(clearTimeout);
      notifTimers.current = [];
    }

    // Stale reminders at 4h, 8h, 12h, 16h, 18h, 20h, 22h from check-in time
    for (const hour of NOTIFICATION_SCHEDULE_H) {
      const delay = checkinMs + hour * 60 * 60 * 1000 - Date.now();
      if (delay > 0) {
        const toastMsg =
          NOTIFICATION_MESSAGES[hour]?.body ??
          `${hour}h since check-in — still working?`;
        notifTimers.current.push(
          setTimeout(() => {
            void fireStaleNotification(hour, () => showToast(toastMsg, "info"));
          }, delay),
        );
      }
    }

    let sentSoFar = 0
    try {
      sentSoFar = parseInt(localStorage.getItem(STALE_NOTIF_KEY) ?? '0', 10)
    } catch { /* ignore */ }

    NOTIFICATION_SCHEDULE_H.slice(sentSoFar).forEach((hour, i) => {
      const fireAt = checkinMs + hour * 60 * 60 * 1000
      const delay = fireAt - Date.now()
      if (delay <= 0) return
      const notifIndex = sentSoFar + i + 1
      const timer = setTimeout(() => {
        try { localStorage.setItem(STALE_NOTIF_KEY, String(notifIndex)) } catch { /* ignore */ }
        fireStaleNotification(hour)
      }, delay)
      notifTimers.current.push(timer)
    })

    const autoCheckoutAt = checkinMs + AUTO_CHECKOUT_H * 60 * 60 * 1000
    const autoDelay = autoCheckoutAt - Date.now()
    if (autoDelay > 0) {
      const timer = setTimeout(() => { void triggerAutoCheckout() }, autoDelay)
      notifTimers.current.push(timer)
    } else {
      void triggerAutoCheckout()
    }

    return () => {
      if (notifTimers.current) {
        notifTimers.current.forEach(clearTimeout);
        notifTimers.current = [];
      }
    };
  }, [activeEvent?.id, activeEvent?.scheduled_checkout_at]);

  async function triggerAutoCheckout(): Promise<void> {
    try {
      await fetch("/api/checkin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "midnight_auto_checkout" }),
      });
      // Reload to update UI
      window.location.reload();
    } catch {
      // silent
    }
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  function showToast(message: string, type: ToastType = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  type GpsResult =
    | { ok: true; lat: number; lng: number; accuracy: number }
    | { ok: false; reason: "denied" | "timeout" | "unavailable" };

  async function collectGps(): Promise<GpsResult> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        resolve({ ok: false, reason: "unavailable" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          if (err.code === 1) resolve({ ok: false, reason: "denied" });
          else if (err.code === 3) resolve({ ok: false, reason: "timeout" });
          else resolve({ ok: false, reason: "unavailable" });
        },
        { timeout: 8000, maximumAge: 30000 },
      );
    });
  }

  async function handleCheckin() {
    if (state !== "checked_out" || loading) return;
    setLoading(true);
    startProgress();
    try {
      const gps = await collectGps();
      const gpsCoords = gps.ok ? gps : null;
      const deviceInfo = await collectDeviceInfo().catch(() => null);

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_lat: gpsCoords?.lat,
          gps_lng: gpsCoords?.lng,
          gps_accuracy_m: gpsCoords?.accuracy
            ? Math.round(gpsCoords.accuracy)
            : undefined,
          device_info: deviceInfo ? JSON.stringify(deviceInfo) : null,
          device_timezone: deviceInfo?.timezone ?? null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setState('checked_in')
        setActiveEvent(data.event)
        await requestNotificationPermission()
        showToast('Checked in!', 'success')
        router.refresh()
      } else if (res.status === 409) {
        setState("checked_in");
        showToast(data.error || "Already checked in.", "info");
        router.refresh();
      } else {
        showToast(data.error || "Check-in failed", "error");
      }
    } catch {
      showToast('Check-in failed. Please check your connection and try again.', 'error')
    } finally {
      stopProgress();
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (state !== "checked_in" || loading) return;
    setLoading(true);
    startProgress();
    try {
      const gps = await collectGps();
      const gpsCoords = gps.ok ? gps : null;

      const res = await fetch("/api/checkin/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gps_lat: gpsCoords?.lat,
          gps_lng: gpsCoords?.lng,
          gps_accuracy_m: gpsCoords?.accuracy
            ? Math.round(gpsCoords.accuracy)
            : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const hrs = data.duration_hours ? fmtHours(data.duration_hours) : "";
        setState("checked_out");
        setActiveEvent(null);
        notifTimers.current.forEach(clearTimeout);
        notifTimers.current = [];
        try {
          localStorage.removeItem(STALE_NOTIF_KEY);
          localStorage.removeItem(STALE_NOTIF_EVENT_KEY);
        } catch {
          /* ignore */
        }
        showToast(`Checked out${hrs ? ` — ${hrs} logged` : ""}`, "success");
        router.refresh();
      } else if (res.status === 409) {
        setState("checked_out");
        setActiveEvent(null);
        showToast(data.error || "You're not checked in.", "info");
        router.refresh();
      } else {
        showToast(data.error || "Checkout failed", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      stopProgress();
      setLoading(false);
    }
  }

  const toastBg =
    toast?.type === "error"
      ? "var(--danger)"
      : toast?.type === "info"
        ? "var(--amber)"
        : "var(--teal)";

  const isCheckedIn = state === "checked_in";

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      {/* Greeting */}
      <p
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: "32px",
          fontWeight: 700,
          color: "var(--navy)",
          marginBottom: "6px",
        }}
      >
        Hi, {name}
      </p>

      {/* Date header */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          fontFamily: "DM Sans, sans-serif",
          marginBottom: "4px",
        }}
      >
        {todayDisplay}
      </p>

      {/* Status line */}
      <p
        style={{
          fontSize: "15px",
          fontFamily: "DM Sans, sans-serif",
          color: isCheckedIn ? "var(--teal)" : "var(--text-secondary)",
          marginBottom: "16px",
        }}
      >
        {isCheckedIn && activeEvent
          ? `Checked in at ${fmtTimeOnDate(activeEvent.checkin_at)}`
          : "Not checked in yet"}
      </p>

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: toastBg,
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            marginBottom: "12px",
            fontSize: "14px",
            fontFamily: "DM Sans, sans-serif",
            lineHeight: 1.4,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* "I'm here" — only when CHECKED_OUT */}
      {!isCheckedIn && (
        <>
          <button
            onClick={handleCheckin}
            disabled={loading}
            style={{
              width: '100%',
              height: '64px',
              background: loading ? 'var(--brand-hover)' : 'var(--brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '18px',
              fontWeight: 700,
              fontFamily: 'Syne, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.2px',
            }}
          >
            {loading ? 'Getting location…' : "I'm here"}
          </button>

        </>
      )}

      {/* "I'm leaving" — only when CHECKED_IN */}
      {isCheckedIn && (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: "100%",
            height: "64px",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "DM Sans, sans-serif",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Getting location…" : "I'm leaving"}
        </button>
      )}
    </div>
  );
}
