'use client'

import { useState } from 'react'
import type { PresenceEvent } from '@/lib/db/queries/events'
import type { MatchedBy } from '@/lib/signals'
import { fmtTime, durationLabel } from '@/lib/client/format-time'
import { en } from '@/locales/en'


interface EventCardProps {
  event: PresenceEvent & {
    matched_by?: MatchedBy
    matched_signals?: string[]
  }
  onNoteUpdate?: (id: string, note: string) => void
}

export default function EventCard({ event, onNoteUpdate }: EventCardProps) {
  const geoLabel = event.location_label ?? null
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(event.note ?? '')
  const [saving, setSaving] = useState(false)
  const isRemote = event.event_type === "remote_checkin";

  const trustFlags: string[] = (() => {
    try { return event.trust_flags ? JSON.parse(event.trust_flags) as string[] : [] }
    catch { return [] }
  })()
  const isOutsideRadius = trustFlags.includes('checkout_outside_radius')

  const duration = durationLabel(event.checkin_at, event.checkout_at)

  const transparency = (() => {
    if (event.matched_by == null) return null
    switch (event.matched_by) {
      case 'verified':
        return { label: en.meTimeline.matchedVerified, color: 'var(--teal)' }
      case 'partial':
        return { label: en.meTimeline.matchedPartial, color: 'var(--amber)' }
      case 'none':
        return { label: en.meTimeline.matchedNone, color: 'var(--text-muted)' }
      case 'override':
        return { label: en.meTimeline.matchedOverride, color: 'var(--brand)' }
      default:
        return null
    }
  })()

  // "1:37 PM - 2:15 PM" or just "1:37 PM"
  const timeRange = event.checkout_at
    ? `${fmtTime(event.checkin_at)} - ${fmtTime(event.checkout_at)}`
    : fmtTime(event.checkin_at)

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

  return (
    <div
      style={{
        background: "var(--surface-0)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        marginBottom: "8px",
      }}
    >
      {/* Top row: time range + distance badge + type badge + duration */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "13px",
            color: "var(--text-primary)",
            fontWeight: 400,
          }}
        >
          {timeRange}
        </span>

        {duration && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {duration}
          </span>
        )}

        {geoLabel && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--brand)",
              background: "color-mix(in srgb, var(--brand) 10%, transparent)",
              padding: "2px 8px",
              borderRadius: "20px",
            }}
          >
            {geoLabel}
          </span>
        )}
      </div>

      {transparency && (
        <div style={{ marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              color: transparency.color,
            }}
          >
            {transparency.label}
          </span>
          {event.matched_signals && event.matched_signals.length > 0 && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "11px",
                color: "var(--text-muted)",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {en.meTimeline.matchedSignals}: {event.matched_signals.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Checkout distance badge */}
      {event.checkout_location_mismatch != null && (
        <div style={{ marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: isOutsideRadius ? 600 : 400,
              color: isOutsideRadius
                ? "var(--danger, #dc2626)"
                : "var(--text-muted)",
              background: isOutsideRadius
                ? "color-mix(in srgb, var(--danger, #dc2626) 10%, transparent)"
                : "var(--surface-1)",
              padding: "3px 8px",
              borderRadius: "4px",
              border: isOutsideRadius
                ? "1px solid var(--danger, #dc2626)"
                : "1px solid var(--border)",
            }}
          >
            {isOutsideRadius ? "⚠" : "✓"} {event.checkout_location_mismatch}m
            away from office
            {isOutsideRadius ? " - outside radius" : ""}
          </span>
        </div>
      )}

      {/* Note */}
      <div style={{ marginBottom: "8px" }}>
        {editingNote ? (
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
                if (e.key === "Escape") setEditingNote(false);
              }}
              autoFocus
              placeholder="Add a note…"
              style={{
                flex: 1,
                height: "34px",
                padding: "0 10px",
                border: "1px solid var(--brand)",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                fontFamily: "DM Sans, sans-serif",
                background: "var(--surface-0)",
                outline: "none",
              }}
            />
            <button
              onClick={saveNote}
              disabled={saving}
              style={{
                height: "34px",
                padding: "0 12px",
                background: "var(--brand)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              fontSize: "13px",
              fontFamily: "DM Sans, sans-serif",
              color: noteValue ? "var(--text-secondary)" : "var(--text-muted)",
            }}
          >
            {noteValue || "Add a note…"}
          </button>
        )}
      </div>

      {/* Location rows: Check-in + Checkout */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Check-in location */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              width: "60px",
              flexShrink: 0,
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Check-in
          </span>

          {isRemote ? (
            <span
              style={{
                fontSize: "11px",
                color: "var(--amber)",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
              }}
            >
              Remote
            </span>
          ) : event.gps_lat !== null && event.gps_lng !== null ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${event.gps_lat}&mlon=${event.gps_lng}&zoom=16`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "11px",
                fontFamily: "DM Sans, sans-serif",
                color: "var(--brand)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ color: "var(--teal)" }}>◉</span>
              {geoLabel ??
                `${event.gps_lat.toFixed(4)}, ${event.gps_lng.toFixed(4)}`}
            </a>
          ) : null}
        </div>

        {/* Checkout location */}
        {event.checkout_at && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                width: "60px",
                flexShrink: 0,
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Checkout
            </span>

            {isRemote ? (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--amber)",
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: 600,
                }}
              >
                Remote
              </span>
            ) : event.checkout_gps_lat !== null &&
              event.checkout_gps_lng !== null ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${event.checkout_gps_lat}&mlon=${event.checkout_gps_lng}&zoom=16`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "11px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--brand)",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    color: isOutsideRadius
                      ? "var(--danger, #dc2626)"
                      : "var(--teal)",
                  }}
                >
                  ◉
                </span>
                {event.checkout_location_label ??
                  `${event.checkout_gps_lat.toFixed(4)}, ${event.checkout_gps_lng.toFixed(4)}`}
              </a>
            ) : (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                {en.meTimeline.checkoutLocationNotCaptured}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
