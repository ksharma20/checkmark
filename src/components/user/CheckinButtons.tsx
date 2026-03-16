'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PresenceEvent } from '@/lib/db/queries/events'

interface CheckinButtonsProps {
  activeEvent: PresenceEvent | null
}

type ToastType = 'success' | 'info' | 'error'

export default function CheckinButtons({ activeEvent }: CheckinButtonsProps) {
  const router = useRouter()
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
        () => resolve(null),
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

      if (res.ok) {
        showToast(gps ? 'Checked in!' : "Checked in without GPS — location helps orgs verify your presence.", gps ? 'success' : 'info')
        router.refresh()
      } else {
        const data = await res.json()
        showToast(data.error || 'Check-in failed', 'error')
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        const hrs = data.duration_hours ? `${data.duration_hours.toFixed(1)}h` : ''
        showToast(`Checked out${hrs ? ` — ${hrs} logged` : ''}`, 'success')
        router.refresh()
      } else {
        showToast('Checkout failed', 'error')
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

      {/* Active check-in status */}
      {activeEvent && (
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

      {/* I'm here button — always shown */}
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
          marginBottom: activeEvent ? '8px' : '0',
          letterSpacing: '-0.2px',
        }}
      >
        {loading && !activeEvent ? 'Getting location…' : "I'm here"}
      </button>

      {/* I'm leaving button — only if active check-in */}
      {activeEvent && (
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            width: '100%',
            height: '48px',
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
          {loading ? 'Checking out…' : "I'm leaving"}
        </button>
      )}
    </div>
  )
}
