'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DisputeEvent, DisputesResponse } from '@/app/api/ws/[slug]/disputes/route'

const skeletonStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: '6px',
}

function formatUtc(s: string | null, tz: string): string {
  if (!s) return '—'
  const norm = s.includes('T') ? (s.endsWith('Z') ? s : s + 'Z') : s.replace(' ', 'T') + 'Z'
  return new Date(norm).toLocaleString('en-IN', {
    timeZone: tz, day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function durationHours(checkin: string, checkout: string | null): string {
  if (!checkout) return '—'
  const cin = new Date(checkin.includes('T') ? checkin : checkin.replace(' ', 'T') + 'Z').getTime()
  const cout = new Date(checkout.includes('T') ? checkout : checkout.replace(' ', 'T') + 'Z').getTime()
  const h = Math.round((cout - cin) / (1000 * 60 * 60) * 10) / 10
  return `${h}h`
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function getThisMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(last).padStart(2, '0')}` }
}

interface Props { slug: string; tz: string }

export default function DisputesClient({ slug, tz }: Props) {
  const defaultRange = getThisMonthRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [data, setData] = useState<DisputesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [overriding, setOverriding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})

  const fetchDisputes = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/disputes?start=${start}&end=${end}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchDisputes(startDate, endDate) }, [fetchDisputes, startDate, endDate])

  async function handleOverride(eventId: string) {
    setOverriding(eventId)
    try {
      const res = await fetch(`/api/ws/${slug}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, note: noteInputs[eventId] ?? '' }),
      })
      if (res.ok) await fetchDisputes(startDate, endDate)
    } finally {
      setOverriding(null)
    }
  }

  async function handleRemoveOverride(eventId: string) {
    setRemoving(eventId)
    try {
      const res = await fetch(`/api/ws/${slug}/disputes/${eventId}`, { method: 'DELETE' })
      if (res.ok) await fetchDisputes(startDate, endDate)
    } finally {
      setRemoving(null)
    }
  }

  const unmatched = data?.events.filter((e) => !e.overridden) ?? []
  const overridden = data?.events.filter((e) => e.overridden) ?? []

  return (
    <div>
      {/* Date range controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="date" value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            height: '36px', padding: '0 10px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            background: 'var(--surface-0)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
        <input
          type="date" value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            height: '36px', padding: '0 10px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            background: 'var(--surface-0)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => { const r = getThisMonthRange(); setStartDate(r.start); setEndDate(r.end) }}
          style={{
            height: '36px', padding: '0 12px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            background: 'var(--surface-2)', color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          This month
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...skeletonStyle, height: '64px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : !data?.signals_configured ? (
        <div style={{
          background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
          border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
        }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            No location signals configured. Disputes only apply when WiFi, GPS, or IP signals are set up in Settings.
            Without signals, all check-ins are counted automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Unmatched events */}
          <section style={{ marginBottom: '36px' }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700,
              color: 'var(--navy)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              Not counted
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
                background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
                color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                borderRadius: '4px', padding: '1px 7px',
              }}>
                {unmatched.length}
              </span>
            </h2>

            {unmatched.length === 0 ? (
              <div style={{
                background: 'var(--surface-0)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center',
              }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
                  No unmatched events in this period.
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {unmatched.map((ev, i) => (
                  <EventRow
                    key={ev.event_id}
                    ev={ev} tz={tz}
                    isLast={i === unmatched.length - 1}
                    overriding={overriding === ev.event_id}
                    noteValue={noteInputs[ev.event_id] ?? ''}
                    onNoteChange={(v) => setNoteInputs((prev) => ({ ...prev, [ev.event_id]: v }))}
                    onOverride={() => handleOverride(ev.event_id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Already overridden */}
          {overridden.length > 0 && (
            <section>
              <h2 style={{
                fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700,
                color: 'var(--navy)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                Overridden (counted)
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
                  background: 'color-mix(in srgb, var(--teal) 10%, transparent)',
                  color: 'var(--teal)', border: '1px solid color-mix(in srgb, var(--teal) 30%, transparent)',
                  borderRadius: '4px', padding: '1px 7px',
                }}>
                  {overridden.length}
                </span>
              </h2>
              <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {overridden.map((ev, i) => (
                  <OverriddenRow
                    key={ev.event_id}
                    ev={ev} tz={tz}
                    isLast={i === overridden.length - 1}
                    removing={removing === ev.event_id}
                    onRemove={() => handleRemoveOverride(ev.event_id)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function EventRow({
  ev, tz, isLast, overriding, noteValue, onNoteChange, onOverride,
}: {
  ev: DisputeEvent; tz: string; isLast: boolean
  overriding: boolean; noteValue: string
  onNoteChange: (v: string) => void
  onOverride: () => void
}) {
  const ini = initials(ev.member_name)
  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap',
    }}>
      {/* Avatar */}
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
        background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
        color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {ini}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: '180px' }}>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          {ev.member_name}
        </p>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          {ev.member_email}
        </p>
        <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {formatUtc(ev.checkin_at, tz)}
          </span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
            {durationHours(ev.checkin_at, ev.checkout_at)}
          </span>
          {ev.location_label && (
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
              📍 {ev.location_label}
            </span>
          )}
          {ev.has_gps && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GPS</span>}
          {ev.has_wifi && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>WiFi</span>}
        </div>
        {ev.note && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
            "{ev.note}"
          </p>
        )}
      </div>

      {/* Override action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Note (optional)"
          value={noteValue}
          onChange={(e) => onNoteChange(e.target.value)}
          style={{
            height: '32px', padding: '0 10px', fontSize: '12px',
            fontFamily: 'DM Sans, sans-serif',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-0)', color: 'var(--text-primary)',
            outline: 'none', width: '140px',
          }}
        />
        <button
          type="button"
          disabled={overriding}
          onClick={onOverride}
          style={{
            height: '32px', padding: '0 12px',
            fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
            background: 'var(--teal)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: overriding ? 'default' : 'pointer',
            opacity: overriding ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {overriding ? 'Counting…' : 'Count this event'}
        </button>
      </div>
    </div>
  )
}

function OverriddenRow({
  ev, tz, isLast, removing, onRemove,
}: {
  ev: DisputeEvent; tz: string; isLast: boolean
  removing: boolean; onRemove: () => void
}) {
  const ini = initials(ev.member_name)
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      background: 'color-mix(in srgb, var(--teal) 4%, transparent)',
    }}>
      <div style={{
        width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
        background: 'color-mix(in srgb, var(--teal) 15%, transparent)',
        color: 'var(--teal)', fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {ini}
      </div>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 2px' }}>
          {ev.member_name}
          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--teal)', fontWeight: 400 }}>overridden</span>
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {formatUtc(ev.checkin_at, tz)}
          </span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
            {durationHours(ev.checkin_at, ev.checkout_at)}
          </span>
        </div>
      </div>
      <button
        type="button"
        disabled={removing}
        onClick={onRemove}
        style={{
          height: '30px', padding: '0 10px',
          fontFamily: 'DM Sans, sans-serif', fontSize: '12px',
          background: 'transparent', color: 'var(--danger)',
          border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
          borderRadius: 'var(--radius-sm)', cursor: removing ? 'default' : 'pointer',
          opacity: removing ? 0.6 : 1,
        }}
      >
        {removing ? 'Removing…' : 'Revert'}
      </button>
    </div>
  )
}
