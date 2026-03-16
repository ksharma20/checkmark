'use client'

import { useState } from 'react'
import type { PresenceEvent } from '@/lib/db/queries/events'

const EVENT_TYPE_LABELS: Record<string, string> = {
  office_checkin: 'Office',
  client_visit: 'Client visit',
  manual_log: 'Manual',
}

interface EventCardProps {
  event: PresenceEvent
  onDelete?: (id: string) => void
  onNoteUpdate?: (id: string, note: string) => void
}

function durationLabel(checkin: string, checkout: string | null): string | null {
  if (!checkout) return null
  const diff = new Date(checkout).getTime() - new Date(checkin).getTime()
  const hrs = diff / (1000 * 60 * 60)
  if (hrs < 1) return `${Math.round(hrs * 60)}m`
  return `${hrs.toFixed(1)}h`
}

function isWithin5Min(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000
}

export default function EventCard({ event, onDelete, onNoteUpdate }: EventCardProps) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(event.note ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [canDelete] = useState(() => isWithin5Min(event.created_at))

  const duration = durationLabel(event.checkin_at, event.checkout_at)
  const typeLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type

  async function saveNote() {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteValue }),
      })
      if (res.ok) {
        setEditingNote(false)
        onNoteUpdate?.(event.id, noteValue)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this check-in? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete?.(event.id)
      } else {
        const data = await res.json()
        alert(data.error || 'Delete failed')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginBottom: '8px',
      }}
    >
      {/* Top row: time + type badge + duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            color: 'var(--text-primary)',
            fontWeight: 400,
          }}
        >
          {new Date(event.checkin_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {event.checkout_at &&
            ` — ${new Date(event.checkout_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </span>

        {duration && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {duration}
          </span>
        )}

        <span
          style={{
            marginLeft: 'auto',
            fontSize: '11px',
            fontFamily: 'DM Sans, sans-serif',
            color: 'var(--brand)',
            background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
            padding: '2px 8px',
            borderRadius: '20px',
          }}
        >
          {typeLabel}
        </span>
      </div>

      {/* Note */}
      <div style={{ marginBottom: '8px' }}>
        {editingNote ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNote()
                if (e.key === 'Escape') setEditingNote(false)
              }}
              autoFocus
              placeholder="Add a note…"
              style={{
                flex: 1,
                height: '34px',
                padding: '0 10px',
                border: '1px solid var(--brand)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                background: 'var(--surface-0)',
                outline: 'none',
              }}
            />
            <button
              onClick={saveNote}
              disabled={saving}
              style={{
                height: '34px',
                padding: '0 12px',
                background: 'var(--brand)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              color: noteValue ? 'var(--text-secondary)' : 'var(--text-muted)',
            }}
          >
            {noteValue || 'Add a note…'}
          </button>
        )}
      </div>

      {/* Meta: WiFi + GPS + delete */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {event.wifi_ssid && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-muted)',
            }}
          >
            ⌬ {event.wifi_ssid}
          </span>
        )}

        {event.gps_lat !== null && event.gps_lng !== null && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${event.gps_lat}&mlon=${event.gps_lng}&zoom=16`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--brand)',
              textDecoration: 'none',
            }}
          >
            ◉ {event.gps_lat.toFixed(4)}, {event.gps_lng.toFixed(4)}
          </a>
        )}

        {canDelete && onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--danger)',
              fontFamily: 'DM Sans, sans-serif',
              padding: 0,
            }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}
