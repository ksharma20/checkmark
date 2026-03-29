'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { PresenceEvent } from '@/lib/db/queries/events'
import { fmtTimeOnDate } from '@/lib/client/format-time'
import { en } from '@/locales/en'
import {
  STALE_NOTIF_KEY,
  STALE_NOTIF_EVENT_KEY,
  NOTIF_TAG_STALE,
  NOTIF_TAG_AUTO_CHECKOUT,
} from '@/lib/constants'

// Notification schedule (hours from check-in): 4, 8, 12, 16, 18, 20, 22 — then auto-checkout at 24h
const NOTIFICATION_SCHEDULE_H = [4, 8, 12, 16, 18, 20, 22]
const AUTO_CHECKOUT_H = 24
const NOTIFICATION_MESSAGES = en.notifications.stale

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null
}

type ToastType = 'success' | 'info' | 'error'

export default function CheckinButtons({ activeEvent: initialActiveEvent }: CheckinButtonsProps) {
  const router = useRouter()
  const [state, setState] = useState<'checked_in' | 'checked_out'>(
    initialActiveEvent ? 'checked_in' : 'checked_out'
  )
  const [activeEvent, setActiveEvent] = useState(initialActiveEvent)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const notifTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Schedule browser notifications at 8h, 12h, 16h, 18h, 20h, 22h; auto-checkout at 24h
  useEffect(() => {
    if (!activeEvent) return

    const checkinMs = new Date(
      activeEvent.checkin_at.includes('T')
        ? activeEvent.checkin_at
        : activeEvent.checkin_at.replace(' ', 'T') + 'Z'
    ).getTime()

    notifTimers.current.forEach(clearTimeout)
    notifTimers.current = []

    try {
      const storedEventId = localStorage.getItem(STALE_NOTIF_EVENT_KEY)
      if (storedEventId !== activeEvent.id) {
        localStorage.setItem(STALE_NOTIF_EVENT_KEY, activeEvent.id)
        localStorage.setItem(STALE_NOTIF_KEY, '0')
      }
    } catch { /* localStorage may be unavailable */ }

    let sentSoFar = 0
    try {
      sentSoFar = parseInt(localStorage.getItem(STALE_NOTIF_KEY) ?? '0', 10)
    } catch { /* ignore */ }

    // Schedule the 6 notifications
    NOTIFICATION_SCHEDULE_H.slice(sentSoFar).forEach((hour, i) => {
      const fireAt = checkinMs + hour * 60 * 60 * 1000
      const delay = fireAt - Date.now();
      if (delay <= 0) return;
      const notifIndex = sentSoFar + i + 1;
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(STALE_NOTIF_KEY, String(notifIndex));
        } catch {
          /* ignore */
        }
        fireStaleNotification(hour);
      }, delay);
      notifTimers.current.push(timer);
    })

    // Schedule auto-checkout at 24h
    const autoCheckoutAt = checkinMs + AUTO_CHECKOUT_H * 60 * 60 * 1000
    const autoDelay = autoCheckoutAt - Date.now()
    if (autoDelay > 0) {
      const timer = setTimeout(() => { void triggerAutoCheckout() }, autoDelay)
      notifTimers.current.push(timer)
    } else {
      // Already past 24h — trigger immediately
      void triggerAutoCheckout()
    }

    return () => {
      notifTimers.current.forEach(clearTimeout)
      notifTimers.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id])

  async function fireStaleNotification(hour: number) {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    const msg = NOTIFICATION_MESSAGES[hour] ?? {
      title: en.notifications.staleFallback.title,
      body: en.notifications.staleFallback.body(hour),
    }
    const opts: NotificationOptions = { body: msg.body, icon: '/favicon.ico', tag: NOTIF_TAG_STALE }
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification(msg.title, opts)
        return
      } catch { /* fall through to page notification */ }
    }
    new Notification(msg.title, opts)
  }

  async function triggerAutoCheckout() {
    try {
      const res = await fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'maximum_hours_exceeded' }),
      })
      if (res.ok) {
        setState('checked_out')
        setActiveEvent(null)
        try {
          localStorage.removeItem(STALE_NOTIF_KEY)
          localStorage.removeItem(STALE_NOTIF_EVENT_KEY)
        } catch { /* ignore */ }
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const opts: NotificationOptions = { body: en.notifications.autoCheckout.body, icon: '/favicon.ico', tag: NOTIF_TAG_AUTO_CHECKOUT }
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => reg.showNotification(en.notifications.autoCheckout.title, opts)).catch(() => {
              new Notification(en.notifications.autoCheckout.title, opts)
            })
          } else {
            new Notification(en.notifications.autoCheckout.title, opts)
          }
        }
        router.refresh()
      }
    } catch { /* silent — will retry on next page load */ }
  }

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  function showToast(message: string, type: ToastType = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  type GpsResult =
    | { ok: true; lat: number; lng: number; accuracy: number }
    | { ok: false; reason: 'denied' | 'timeout' | 'unavailable' }

  async function collectGps(): Promise<GpsResult> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve({ ok: false, reason: 'unavailable' })
        return
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
          if (err.code === 1) resolve({ ok: false, reason: 'denied' })
          else if (err.code === 3) resolve({ ok: false, reason: 'timeout' })
          else resolve({ ok: false, reason: 'unavailable' })
        },
        { timeout: 8000, maximumAge: 30000 }
      )
    })
  }

  function getWifiSsid(): string | null {
    if (typeof navigator === 'undefined') return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (navigator as any).connection?.ssid ?? null
  }

  async function handleCheckin() {
    if (state !== 'checked_out' || loading) return
    setLoading(true)
    try {
      const gps = await collectGps()
      const wifi = getWifiSsid()
      const gpsCoords = gps.ok ? gps : null

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps_lat: gpsCoords?.lat,
          gps_lng: gpsCoords?.lng,
          gps_accuracy_m: gpsCoords?.accuracy ? Math.round(gpsCoords.accuracy) : undefined,
          wifi_ssid: wifi ?? undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setState('checked_in')
        setActiveEvent(data.event)
        await requestNotificationPermission()
        if (gps.ok) {
          showToast('Checked in!', 'success')
        } else if (gps.reason === 'denied') {
          showToast('Checked in without GPS. Location access was blocked — enable it in browser settings to verify your presence.', 'info')
        } else if (gps.reason === 'timeout') {
          showToast("Checked in without GPS. Couldn't get your location in time.", 'info')
        } else {
          showToast('Checked in without GPS — location helps orgs verify your presence.', 'info')
        }
        router.refresh()
      } else if (res.status === 409) {
        setState('checked_in')
        showToast(data.error || 'Already checked in.', 'info')
        router.refresh()
      } else {
        showToast(data.error || 'Check-in failed', 'error')
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckout() {
    if (state !== 'checked_in' || loading) return
    setLoading(true)
    try {
      const gps = await collectGps()
      const wifi = getWifiSsid()
      const gpsCoords = gps.ok ? gps : null

      const res = await fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps_lat: gpsCoords?.lat,
          gps_lng: gpsCoords?.lng,
          gps_accuracy_m: gpsCoords?.accuracy ? Math.round(gpsCoords.accuracy) : undefined,
          wifi_ssid: wifi ?? undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        const hrs = data.duration_hours ? `${data.duration_hours.toFixed(1)}h` : ''
        setState('checked_out')
        setActiveEvent(null)
        notifTimers.current.forEach(clearTimeout)
        notifTimers.current = []
        try {
          localStorage.removeItem(STALE_NOTIF_KEY)
          localStorage.removeItem(STALE_NOTIF_EVENT_KEY)
        } catch { /* ignore */ }
        showToast(`Checked out${hrs ? ` — ${hrs} logged` : ''}`, 'success')
        router.refresh()
      } else if (res.status === 409) {
        setState('checked_out')
        setActiveEvent(null)
        showToast(data.error || "You're not checked in.", 'info')
        router.refresh()
      } else {
        showToast(data.error || 'Checkout failed', 'error')
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const toastBg =
    toast?.type === 'error'
      ? 'var(--danger)'
      : toast?.type === 'info'
      ? 'var(--amber)'
      : 'var(--teal)'

  const isCheckedIn = state === 'checked_in'

  const todayDisplay = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      {/* Date header */}
      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontFamily: 'DM Sans, sans-serif',
          marginBottom: '4px',
        }}
      >
        {todayDisplay}
      </p>

      {/* Status line */}
      <p
        style={{
          fontSize: '15px',
          fontFamily: 'DM Sans, sans-serif',
          color: isCheckedIn ? 'var(--teal)' : 'var(--text-secondary)',
          marginBottom: '16px',
        }}
      >
        {isCheckedIn && activeEvent
          ? `Checked in at ${fmtTimeOnDate(activeEvent.checkin_at)}`
          : 'Not checked in yet'}
      </p>

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: toastBg,
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '12px',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            lineHeight: 1.4,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* "I'm here" — only when CHECKED_OUT */}
      {!isCheckedIn && (
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
      )}

      {/* "I'm leaving" — only when CHECKED_IN */}
      {isCheckedIn && (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: '100%',
            height: '64px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '15px',
            fontWeight: 500,
            fontFamily: 'DM Sans, sans-serif',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Getting location…' : "I'm leaving"}
        </button>
      )}
    </div>
  )
}
