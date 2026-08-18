'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import type { PresenceEvent } from '@/lib/db/queries/events'
import type { MatchedBy } from '@/lib/signals'
import EventCard from '@/components/user/EventCard'
import { en } from '@/locales/en'

type TimelineEvent = PresenceEvent & {
  matched_by?: MatchedBy
  matched_signals?: string[]
}

function getMonthBounds() {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    start: firstOfMonth.toISOString().split('T')[0],
    end: now.toISOString().split('T')[0],
  }
}

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>()
  for (const event of events) {
    // slice(0,10) handles both ISO "2026-03-17T..." and SQLite "2026-03-17 ..." formats
    const date = event.checkin_at.slice(0, 10)
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
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false);
  const [workspaces, setWorkspaces] = useState<{ slug: string; name: string }[]>([])
  const [workspaceSlug, setWorkspaceSlug] = useState<string | null>(null)
  const [regularizationByEventId, setRegularizationByEventId] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({})
  const nextOffsetRef = useRef(0);

  const fetchRegularizations = useCallback(async () => {
    if (!workspaceSlug) { setRegularizationByEventId({}); return }
    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(workspaceSlug)}/regularizations`)
      const data = await res.json()
      const map: Record<string, 'pending' | 'approved' | 'rejected'> = {}
      for (const r of data.regularizationRequests ?? []) {
        if (r.presence_event_id) map[r.presence_event_id] = r.status
      }
      setRegularizationByEventId(map)
    } catch {
      // silent - the "Request correction" button just won't reflect existing requests
    }
  }, [workspaceSlug])

  useEffect(() => { fetchRegularizations() }, [fetchRegularizations])

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.created_at) {
          const minDate = data.user.created_at.slice(0, 10)
          setJoinedDate(minDate)
          if (startDate < minDate) setStartDate(minDate)
        }
        if (Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces)
          if (data.workspaces.length === 1) {
            setWorkspaceSlug(data.workspaces[0].slug);
          }
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchEvents = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        if (!append) nextOffsetRef.current = 0;
        const reqOffset = append ? nextOffsetRef.current : 0;
        const qs = `start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z&limit=10&offset=${reqOffset}`;
        const url = workspaceSlug
          ? `/api/me/ws/${encodeURIComponent(workspaceSlug)}/events?${qs}`
          : `/api/events?${qs}`;
        const res = await fetch(url);
        const data = await res.json();
        const nextEvents = (data.events ?? []) as TimelineEvent[];
        setEvents((prev) => (append ? [...prev, ...nextEvents] : nextEvents));
        setTotal(data.total ?? 0);
        nextOffsetRef.current = reqOffset + nextEvents.length;
      } catch {
        // silent
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [startDate, endDate, workspaceSlug],
  );

  useEffect(() => {
    nextOffsetRef.current = 0;
    fetchEvents()
  }, [fetchEvents])

  function handleNoteUpdate(id: string, note: string) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, note } : e)))
  }

  const showWorkspaceFilter = workspaces.length > 1;
  const workspaceFilterDisabled = showWorkspaceFilter ? false : true;
  const canViewMore = !loading && events.length < total;

  const grouped = groupByDate(events)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => (a > b ? -1 : 1))

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
      {/* Header */}
      <h1
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: "22px",
          fontWeight: 700,
          color: "var(--navy)",
          marginBottom: "16px",
        }}
      >
        Timeline
      </h1>

      {/* Workspace filter (transparency context) */}
      {showWorkspaceFilter && (
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {en.meTimeline.workspaceLabel}
          </label>
          <select
            value={workspaceSlug ?? ""}
            disabled={workspaceFilterDisabled}
            onChange={(e) =>
              setWorkspaceSlug(e.target.value === "" ? null : e.target.value)
            }
            style={{
              width: "100%",
              height: "40px",
              padding: "0 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              fontFamily: "DM Sans, sans-serif",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">{en.meTimeline.workspaceAll}</option>
            {workspaces.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.name}
              </option>
            ))}
          </select>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
              marginTop: "8px",
              lineHeight: 1.45,
            }}
          >
            {en.meTimeline.transparencyHint}
          </p>
        </div>
      )}

      {/* Date filter */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            From
          </label>
          <input
            type="date"
            value={startDate}
            min={joinedDate ?? undefined}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: "100%",
              height: "40px",
              padding: "0 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              fontFamily: "DM Sans, sans-serif",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            To
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: "100%",
              height: "40px",
              padding: "0 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              fontFamily: "DM Sans, sans-serif",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Summary line */}
      {!loading && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            fontFamily: "DM Sans, sans-serif",
            marginBottom: "16px",
          }}
        >
          {total} check-in{total !== 1 ? "s" : ""} · {sortedDates.length} day
          {sortedDates.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Skeleton */}
      {loading && (
        <div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: "88px",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                marginBottom: "8px",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {/* Grouped events */}
      {!loading && sortedDates.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: "var(--text-muted)",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          <p>{en.meTimeline.emptyNoCheckinsTitle}</p>
          <p style={{ fontSize: "13px", marginTop: "4px" }}>
            {en.meTimeline.emptyNoCheckinsBody}
          </p>
        </div>
      )}

      {!loading &&
        sortedDates.map((date) => (
          <section key={date} style={{ marginBottom: "20px" }}>
            <h2
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              {formatDateHeading(date)}
            </h2>
            {grouped.get(date)!.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onNoteUpdate={handleNoteUpdate}
                workspaceSlug={workspaceSlug}
                regularizationStatus={regularizationByEventId[event.id]}
                onRegularizationSubmitted={fetchRegularizations}
              />
            ))}
          </section>
        ))}

      {!loading && loadingMore && (
        <div>
          {[1, 2, 3].map((i) => (
            <div
              key={`load-more-${i}`}
              style={{
                height: "88px",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                marginBottom: "8px",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {/* View more */}
      {!loading && canViewMore && (
        <div style={{ marginTop: "12px" }}>
          <button
            onClick={() => fetchEvents({ append: true })}
            disabled={loadingMore}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: loadingMore ? "default" : "pointer",
            }}
          >
            {loadingMore ? en.meTimeline.loadingMore : en.meTimeline.viewMore}
          </button>
        </div>
      )}
    </div>
  );
}
