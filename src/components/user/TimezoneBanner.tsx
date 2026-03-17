'use client'

import { useState, useEffect } from 'react'

interface Props {
  /** Stored timezone from DB (null = never set) */
  storedTimezone: string | null
  /** Whether the user has previously confirmed their timezone */
  confirmed: boolean
}

/**
 * Shows a one-time banner when the user's timezone has not yet been confirmed.
 * Detects browser TZ on mount, pre-fills it, and lets the user confirm or change.
 * Disappears permanently after confirmation.
 */
export default function TimezoneBanner({ storedTimezone, confirmed }: Props) {
  const [visible, setVisible] = useState(false)
  const [tz, setTz] = useState(storedTimezone ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (confirmed) return
    // Detect browser timezone
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detected) setTz(detected)
    setVisible(true)
  }, [confirmed])

  if (!visible) return null

  async function confirm() {
    setSaving(true)
    try {
      await fetch('/api/me/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz, confirm: true }),
      })
      setVisible(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--brand) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: '16px',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}
    >
      <div style={{ marginBottom: '8px' }}>
        Your timezone is detected as{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{tz || '—'}</strong>.
        Check-in times are displayed in this timezone.
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            placeholder="e.g. Asia/Kolkata"
            style={{
              flex: 1,
              height: '32px',
              padding: '0 8px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => setEditing(false)}
            style={{
              height: '32px',
              padding: '0 10px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '8px', marginTop: editing ? '8px' : '0' }}>
        <button
          onClick={confirm}
          disabled={saving || !tz}
          style={{
            height: '30px',
            padding: '0 14px',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{
              height: '30px',
              padding: '0 14px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-secondary)',
            }}
          >
            Change
          </button>
        )}
      </div>
    </div>
  )
}
