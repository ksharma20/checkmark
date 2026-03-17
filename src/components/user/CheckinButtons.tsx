'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PresenceEvent } from '@/lib/db/queries/events'

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null
}

type ToastType = 'success' | 'info' | 'error'

export default function CheckinButtons({ activeEvent: initialActiveEvent }: CheckinButtonsProps) {
  const router = useRouter()
  // Track state locally so button switches instantly on action success;
  // server refresh then confirms the ground truth.
  const [state, setState] = useState<'checked_in' | 'checked_out'>(
    initialActiveEvent ? 'checked_in' : 'checked_out'
  )
  const [activeEvent, setActiveEvent] = useState(initialActiveEvent)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  function showToast(message: string, type: ToastType = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function collectGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          if (err.code === 1) {
            // PERMISSION_DENIED — surface this in the toast after action
          }
          resolve(null)
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

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps_lat: gps?.lat,
          gps_lng: gps?.lng,
          gps_accuracy_m: gps?.accuracy ? Math.round(gps.accuracy) : undefined,
          wifi_ssid: wifi ?? undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        // Switch state immediately — don't wait for server refresh
        setState('checked_in')
        setActiveEvent(data.event)
        showToast(
          gps ? 'Checked in!' : 'Checked in without GPS — location helps orgs verify your presence.',
          gps ? 'success' : 'info'
        )
        router.refresh() // server re-renders to confirm
      } else if (res.status === 409) {
        // Already checked in — re-sync state
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
      // Capture location signals at checkout time
      const gps = await collectGps()
      const wifi = getWifiSsid()

      const res = await fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gps_lat: gps?.lat,
          gps_lng: gps?.lng,
          gps_accuracy_m: gps?.accuracy ? Math.round(gps.accuracy) : undefined,
          wifi_ssid: wifi ?? undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        const hrs = data.duration_hours ? `${data.duration_hours.toFixed(1)}h` : ''
        setState('checked_out')
        setActiveEvent(null)
        showToast(`Checked out${hrs ? ` — ${hrs} logged` : ''}`, 'success')
        router.refresh()
      } else if (res.status === 409) {
        // Not checked in — re-sync
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

  return (
    <div>
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

      {/* Active check-in status — shown when checked in */}
      {isCheckedIn && activeEvent && (
        <div
          style={{
            padding: '10px 14px',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--teal)',
            fontSize: '14px',
            fontFamily: 'DM Sans, sans-serif',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '8px', color: 'var(--teal)' }}>●</span>
          Active since{' '}
          {new Date(activeEvent.checkin_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
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
