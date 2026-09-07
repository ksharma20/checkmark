'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button, Chip, Divider, EmptyState, Skeleton, SplitBar, toneForMatchedBy,
} from '@/components/ui'
import { fmtTime, fmtTimeOnDate, durationLabel } from '@/lib/client/format-time'
import { wsPerson } from '@/locales/en/ws-person'
import type { AttendanceSummary } from '@/lib/attendance-summary'
import type { MatchedBy } from '@/lib/signals'

/**
 * What one person's presence actually looks like, on their own page.
 *
 * Two halves, and they are deliberately two requests rather than one: the
 * summary is a fixed 30-day aggregate that never changes as you read it, while
 * the timeline is paginated and grows. Folding them into one endpoint would
 * mean re-computing the aggregate on every "load more".
 *
 * Read-only, and there is no `canWrite`. A correction to a past day is not made
 * here - it goes through the Approvals queue, which writes an `admin_overrides`
 * row rather than editing the event. Offering an edit affordance on this screen
 * would imply presence data is mutable, and it is not.
 */

/** Keyed on `MatchedBy` so a new match state cannot be added without a label. */
const MATCH_LABEL: Record<MatchedBy, string> = {
  verified: wsPerson.matchedVerified,
  partial: wsPerson.matchedPartial,
  override: wsPerson.matchedOverride,
  none: wsPerson.matchedNone,
}

interface TimelineEvent {
  id: string
  checkin_at: string
  checkout_at: string | null
  matched_by: MatchedBy
  location_label: string | null
  note: string | null
}

interface TimelinePage {
  events: TimelineEvent[]
  pagination: { offset: number; limit: number; total: number; nextOffset: number | null }
}

interface Props {
  slug: string
  /**
   * A **users.id**. Both endpoints this tab calls - `.../timeline` and
   * `.../attendance` - take one, which is why the tab is handed a user id
   * rather than the membership record id the Leave tab uses.
   */
  userId: string
}

export default function EmployeeActivityTab({ slug, userId }: Props) {
  const base = `/api/ws/${slug}/members/${userId}`

  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [summaryFailed, setSummaryFailed] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [timelineFailed, setTimelineFailed] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const res = await fetch(`${base}/attendance`)
      if (!res.ok) { setSummaryFailed(true); return }
      const data = await res.json() as { summary: AttendanceSummary }
      setSummary(data.summary)
    } catch {
      setSummaryFailed(true)
    } finally {
      setSummaryLoading(false)
    }
  }, [base])

  const loadPage = useCallback(async (offset: number) => {
    // The first page owns the skeleton; every later page owns the button's
    // busy state, so the list never blanks out under the reader.
    if (offset === 0) setTimelineLoading(true); else setLoadingMore(true)
    try {
      const res = await fetch(`${base}/timeline?offset=${offset}`)
      if (!res.ok) { setTimelineFailed(true); return }
      const data = await res.json() as TimelinePage
      setEvents((prev) => offset === 0 ? data.events : [...prev, ...data.events])
      setNextOffset(data.pagination.nextOffset)
      setTotal(data.pagination.total)
    } catch {
      setTimelineFailed(true)
    } finally {
      setTimelineLoading(false)
      setLoadingMore(false)
    }
  }, [base])

  useEffect(() => { void loadSummary() }, [loadSummary])
  useEffect(() => { void loadPage(0) }, [loadPage])

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div className="t-h2">{wsPerson.activityTitle}</div>
          <span className="t-muted">{wsPerson.activityRange}</span>
        </div>

        {summaryLoading ? (
          <div className="field-grid mt-12">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="stack-sm">
                <Skeleton width="60%" height={11} />
                <Skeleton width="40%" height={28} />
              </div>
            ))}
          </div>
        ) : summaryFailed ? (
          <EmptyState title={wsPerson.activityLoadFailed} />
        ) : !summary || summary.workingDays === 0 ? (
          <EmptyState title={wsPerson.activityEmpty} hint={wsPerson.activityEmptyHint} />
        ) : (
          <>
            <div className="field-grid mt-12">
              <Tile label={wsPerson.activityOffice} value={summary.officeDays} accent="accent-brand" />
              <Tile label={wsPerson.activityRemote} value={summary.remoteDays} accent="accent-amber" />
              <Tile label={wsPerson.activityAbsent} value={summary.absentDays} accent="accent-danger" />
              <Tile label={wsPerson.activityHolidays} value={summary.holidayDays} />
            </div>
            <SplitBar
              className="mt-16"
              segments={[
                { value: summary.officeDays, color: 'var(--brand)', label: wsPerson.activityOffice },
                { value: summary.remoteDays, color: 'var(--amber)', label: wsPerson.activityRemote },
                { value: summary.absentDays, color: 'var(--danger)', label: wsPerson.activityAbsent },
              ]}
            />
            <div className="t-muted mt-12">{wsPerson.activityWorkdays(summary.workingDays)}</div>
          </>
        )}
      </div>

      <div className="card">
        <div className="t-h2 mb-12">{wsPerson.timelineTitle}</div>

        {timelineLoading ? (
          <div className="stack">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="stack-sm">
                <Skeleton width="45%" />
                <Skeleton width="30%" height={11} />
              </div>
            ))}
          </div>
        ) : timelineFailed ? (
          <EmptyState title={wsPerson.timelineLoadFailed} />
        ) : events.length === 0 ? (
          <EmptyState title={wsPerson.timelineEmpty} hint={wsPerson.timelineEmptyHint} />
        ) : (
          <>
            {events.map((event, i) => (
              <div key={event.id}>
                {i > 0 && <Divider />}
                <div className="row-between">
                  <div className="min-w-0">
                    <div className="t-rowtitle">{fmtTimeOnDate(event.checkin_at)}</div>
                    <div className="t-rowsub">{subtitleFor(event)}</div>
                    {event.note && (
                      <div className="t-rowsub t-prewrap">{`${wsPerson.timelineNote}: ${event.note}`}</div>
                    )}
                  </div>
                  <Chip tone={toneForMatchedBy(event.matched_by)}>{MATCH_LABEL[event.matched_by]}</Chip>
                </div>
              </div>
            ))}

            <div className="row-between mt-16">
              <span className="t-muted">{wsPerson.timelineCount(events.length, total)}</span>
              {nextOffset !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => void loadPage(nextOffset)}
                >
                  {wsPerson.timelineMore}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** One `.t-eyebrow` + `.stat-num` pair. Local because it is four lines used
 *  four times, and `StatCard` is a whole `.card` - nesting cards inside a card
 *  is the shadow-free design system's one way of looking broken. */
function Tile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <div className="t-eyebrow">{label}</div>
      <div className={['stat-num', accent].filter(Boolean).join(' ')}>{value}</div>
    </div>
  )
}

/** "→ 6:12 PM · 4hr 30min · Bengaluru", or the open-event line. */
function subtitleFor(event: TimelineEvent): string {
  const parts: string[] = []
  if (event.checkout_at) {
    parts.push(`→ ${fmtTime(event.checkout_at)}`)
    const duration = durationLabel(event.checkin_at, event.checkout_at)
    if (duration) parts.push(duration)
  } else {
    parts.push(wsPerson.timelineOpen)
  }
  parts.push(event.location_label ?? wsPerson.timelineNoLocation)
  return parts.join(' · ')
}
