'use client'

/**
 * `/me/timeline` - the member's own check-in history.
 *
 * Scoped to the workspace the top-bar pill names, whenever there is one. This
 * screen used to carry a second workspace selector of its own (plus an "All
 * workspaces" option reading the unscoped `/api/events`), which meant the
 * shell's pill and this dropdown could disagree. Now it reads
 * `useWorkspaceScope()` like every other `/me` screen and calls
 * `/api/me/ws/[slug]/events`, so what the member sees is exactly the
 * AND-semantics evaluation their admin sees.
 *
 * WITH NO WORKSPACE AT ALL it falls back to `/api/events`, the member's own
 * unscoped history. `/me` is a product on its own - a person can record their
 * presence and read it back without any organisation - and an empty screen was
 * the old answer to that. **This is not the retired "All workspaces" option
 * coming back:** that was a THIRD reading offered alongside two real ones, so a
 * member with workspaces could choose a view whose chips had quietly vanished.
 * The fallback is reachable only when there is nothing to scope to, is never a
 * choice, and adds no picker. Its rows carry no `matched_by` because there is
 * nothing to verify against, and `personalOnlyNote` says so rather than leaving
 * a column of missing chips to be read as a bug.
 *
 * Loaded data carries the slug it was fetched for, so switching workspace
 * invalidates it by construction rather than by a reset effect - one
 * workspace's events are never painted while the pill names another.
 *
 * This screen is read-only about corrections. It used to offer "Request
 * correction" on any event that came back `partial` or `none`, and to fetch
 * `/regularizations` purely to badge those rows. Both moved to the Correction
 * tab on `/me/leave`, which reaches the case an event row never could: forgot to
 * check in at all, so there is no event and no row to hang a button on.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PresenceEvent } from '@/lib/db/queries/events'
import type { MatchedBy } from '@/lib/signals'
import EventCard from '@/components/user/EventCard'
import { Button, Card, EmptyState, Field, Input, Skeleton } from '@/components/ui'
import { en } from '@/locales/en'
import { meSettings } from '@/locales/en/me-settings'
import { useWorkspaceScope } from '../workspace-scope'

/**
 * The match fields are OPTIONAL rather than required, because the two readings
 * differ in exactly that: the workspace-scoped endpoint always returns them and
 * the personal one never does. `EventCard` already renders the chip on
 * `matched_by != null`, so absence is the whole mechanism - no flag is threaded
 * down to tell it to hide anything.
 */
type TimelineEvent = PresenceEvent & {
  matched_by?: MatchedBy
  matched_signals?: string[]
}

/**
 * A loaded page of events, tagged with the scope it was fetched for.
 *
 * `null` is the personal reading, and it is a real value rather than a missing
 * one: it has to compare equal to the current scope, or the page would never
 * count as fresh and the skeleton would never clear.
 */
interface TimelineData {
  slug: string | null
  events: TimelineEvent[]
  total: number
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

/** Three card-shaped placeholders, mirroring the height of a real event row. */
function EventSkeletons({ idPrefix }: { idPrefix: string }) {
  return (
    // No wrapper gap: `.card + .card` already spaces adjacent cards by 14px.
    <div aria-hidden>
      {[0, 1, 2].map((i) => (
        <Card key={`${idPrefix}-${i}`} style={{ padding: '14px 16px' }}>
          <div className="row-between" style={{ marginBottom: '10px' }}>
            <Skeleton width={120} height={15} />
            <Skeleton width={72} height={18} radius={999} />
          </div>
          <Skeleton width="70%" height={12} />
        </Card>
      ))}
    </div>
  )
}

export default function TimelinePage() {
  const { slug } = useWorkspaceScope()
  const defaults = getMonthBounds()
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(defaults.start)
  const [endDate, setEndDate] = useState(defaults.end)
  const [joinedDate, setJoinedDate] = useState<string | null>(null)
  const [data, setData] = useState<TimelineData | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const nextOffsetRef = useRef(0)

  // The account's created_at is the floor of the date pickers - no event can
  // predate it, so offering earlier dates only invites empty results.
  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((json) => {
        if (json.user?.created_at) {
          const minDate = json.user.created_at.slice(0, 10)
          setJoinedDate(minDate)
          setStartDate((prev) => (prev < minDate ? minDate : prev))
        }
      })
      .catch(() => {})
  }, [])

  const fetchEvents = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append
      if (append) setLoadingMore(true)
      else {
        nextOffsetRef.current = 0
        setData(null)
      }
      const reqOffset = append ? nextOffsetRef.current : 0
      try {
        const qs = `start=${startDate}T00:00:00Z&end=${endDate}T23:59:59Z&limit=10&offset=${reqOffset}`
        // Both endpoints take the same query string and answer the same
        // `{ events, total }`; only the workspace-scoped one adds the match
        // fields. `/api/events` resolves the user from `x-user-id` and filters
        // on it, so it can only ever return the caller's own rows.
        const url = slug
          ? `/api/me/ws/${encodeURIComponent(slug)}/events?${qs}`
          : `/api/events?${qs}`
        const res = await fetch(url)
        const json = await res.json()
        const nextEvents = (json.events ?? []) as TimelineEvent[]
        setData((prev) => ({
          slug,
          // Only extend a page that belongs to this same workspace.
          events: append && prev?.slug === slug ? [...prev.events, ...nextEvents] : nextEvents,
          total: json.total ?? 0,
        }))
        nextOffsetRef.current = reqOffset + nextEvents.length
      } catch {
        // A failed first page resolves to "nothing here" rather than a skeleton
        // that never goes away.
        if (!append) setData({ slug, events: [], total: 0 })
      } finally {
        if (append) setLoadingMore(false)
      }
    },
    [startDate, endDate, slug],
  )

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function handleNoteUpdate(id: string, note: string) {
    setData((prev) =>
      prev
        ? { ...prev, events: prev.events.map((e) => (e.id === id ? { ...e, note } : e)) }
        : prev,
    )
  }

  const title = (
    <h1 className="t-h1" style={{ color: 'var(--navy)', margin: 0 }}>
      {meSettings.timeline.title}
    </h1>
  )

  const fresh = data !== null && data.slug === slug ? data : null
  const loading = fresh === null
  const events = fresh?.events ?? []
  const total = fresh?.total ?? 0
  const canViewMore = !loading && events.length < total

  const grouped = groupByDate(events)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => (a > b ? -1 : 1))

  return (
    <div className="stack">
      {title}

      {/* Date range. `min` is the account's created_at - no events exist before it. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Field label={meSettings.timeline.rangeFrom} htmlFor="timeline-start">
          <Input
            id="timeline-start"
            type="date"
            value={startDate}
            min={joinedDate ?? undefined}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label={meSettings.timeline.rangeTo} htmlFor="timeline-end">
          <Input
            id="timeline-end"
            type="date"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>

      {!loading && (
        <p className="t-muted" style={{ margin: 0 }}>
          {meSettings.timeline.summary(total, sortedDates.length)}
        </p>
      )}

      {/* Only in the personal reading, and only once - not per row. */}
      {!slug && (
        <p className="t-muted" style={{ margin: 0 }}>
          {meSettings.timeline.personalOnlyNote}
        </p>
      )}

      {loading && <EventSkeletons idPrefix="initial" />}

      {!loading && sortedDates.length === 0 && (
        <EmptyState
          title={en.meTimeline.emptyNoCheckinsTitle}
          hint={en.meTimeline.emptyNoCheckinsBody}
        />
      )}

      {!loading &&
        sortedDates.map((date) => (
          <section key={date}>
            <h2 className="t-eyebrow" style={{ margin: '0 0 8px' }}>
              {formatDateHeading(date)}
            </h2>
            {grouped.get(date)!.map((event) => (
              <EventCard key={event.id} event={event} onNoteUpdate={handleNoteUpdate} />
            ))}
          </section>
        ))}

      {!loading && loadingMore && <EventSkeletons idPrefix="more" />}

      {!loading && canViewMore && (
        <Button
          variant="secondary"
          block
          loading={loadingMore}
          onClick={() => fetchEvents({ append: true })}
        >
          {loadingMore ? en.meTimeline.loadingMore : en.meTimeline.viewMore}
        </Button>
      )}
    </div>
  )
}
