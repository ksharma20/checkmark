'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PresenceEvent } from '@/lib/db/queries/events'
import EventCard from '@/components/user/EventCard'

function getMonthBounds() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    start: firstOfMonth.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  }
}

function groupByDate(events: PresenceEvent[]): Map<string, PresenceEvent[]> {
  const groups = new Map<string, PresenceEvent[]>()
  for (const event of events) {
    const date = event.checkin_at.split('T')[0]
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(event)
  }
  return groups
}

function formatDateHeading(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export default function TimelinePage() {
  const defaults = getMonthBounds()
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [events, setEvents] = useState<PresenceEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/events?start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z&limit=300`
      )
      const data = await res.json()
      setEvents(data.events ?? [])
      setTotal(data.total ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setTotal((t) => t - 1)
  }

  function handleNoteUpdate(id: string, note: string) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, note } : e)))
  }

  const grouped = groupByDate(events)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => (a > b ? -1 : 1))

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '16px',
        }}
      >
        Timeline
      </h1>

      {/* Date filter */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'DM Sans, sans-serif',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'DM Sans, sans-serif',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Summary line */}
      {!loading && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontFamily: 'DM Sans, sans-serif',
            marginBottom: '16px',
          }}
        >
          {total} check-in{total !== 1 ? 's' : ''} · {sortedDates.length} day{sortedDates.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Skeleton */}
      {loading && (
        <div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '88px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '8px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Grouped events */}
      {!loading && sortedDates.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: 'var(--text-muted)',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <p>No check-ins in this date range.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Try expanding the date range above.
          </p>
        </div>
      )}

      {!loading &&
        sortedDates.map((date) => (
          <section key={date} style={{ marginBottom: '20px' }}>
            <h2
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              {formatDateHeading(date)}
            </h2>
            {grouped.get(date)!.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={handleDelete}
                onNoteUpdate={handleNoteUpdate}
              />
            ))}
          </section>
        ))}
    </div>
  )
}
