import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ slug: string }> }

export type InsightInterval = 'today' | 'week' | 'month' | '3month' | '6month' | 'year' | 'custom'

export interface InsightBucket {
  label: string    // display label (e.g. "9 AM", "Mon 17", "Mar")
  key: string      // sort key (ISO string or hour number)
  unique_users: number   // distinct users who had at least one check-in
  total_checkins: number // total events (could be multiple per user per day)
  total_hours: number    // sum of all session durations (completed events only)
}

export interface InsightsResponse {
  interval: InsightInterval
  buckets: InsightBucket[]
  total_members: number
  peak_bucket: string | null   // key of the highest unique_users bucket
  avg_daily_users: number
  total_checkins: number
  total_hours: number
}

/** Zero-pad to 2 digits */
function zp(n: number) { return String(n).padStart(2, '0') }

/** ISO date from UTC components */
function isoDate(y: number, m: number, d: number) {
  return `${y}-${zp(m)}-${zp(d)}`
}

/** Sum session hours for completed events */
function sessionHours(events: { checkin_at: string; checkout_at: string | null }[]): number {
  let total = 0
  for (const ev of events) {
    if (!ev.checkout_at) continue
    const cin = new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z').getTime()
    const cout = new Date(ev.checkout_at.includes('T') ? ev.checkout_at : ev.checkout_at.replace(' ', 'T') + 'Z').getTime()
    total += Math.max(0, (cout - cin) / (1000 * 60 * 60))
  }
  return Math.round(total * 10) / 10
}

/**
 * GET /api/ws/[slug]/insights?interval=today|week|month|3month|6month|year
 *
 * Returns time-bucketed check-in data for the insights charts.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const url = new URL(request.url)
  const interval = (url.searchParams.get('interval') ?? 'month') as InsightInterval
  const fromParam = url.searchParams.get('from') // YYYY-MM-DD (custom only)
  const toParam   = url.searchParams.get('to')   // YYYY-MM-DD (custom only)

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Compute date range and bucket definitions based on interval
  let startDate: string
  let endDate: string
  type BucketDef = {
    key: string
    label: string
    match: (dt: Date) => boolean
    // When set, use presence-based counting (session spans the bucket window)
    matchPresence?: (cinDt: Date, coutDt: Date | null) => boolean
  }
  const bucketDefs: BucketDef[] = []

  if (interval === 'today') {
    const tz = ctx.workspace.display_timezone || 'UTC'

    // Helper: date string (YYYY-MM-DD) in workspace timezone
    const localDateStr = (dt: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)

    // Helper: local hour (0-23) in workspace timezone
    const localHour = (dt: Date) => {
      const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(dt)
      return parseInt(s, 10) % 24 // some locales return "24" for midnight
    }

    // "Today" in workspace timezone
    const localToday = localDateStr(now)
    const nowLocalH = localHour(now)

    // Fetch a ±1 day UTC window to capture all events that are "today" in any timezone offset
    const [ly, lm, ld] = localToday.split('-').map(Number)
    startDate = new Date(Date.UTC(ly, lm - 1, ld - 1)).toISOString().slice(0, 10) + 'T00:00:00Z'
    endDate   = new Date(Date.UTC(ly, lm - 1, ld + 1)).toISOString().slice(0, 10) + 'T23:59:59Z'

    // Only generate buckets up to current local hour - no future zero-count buckets
    // so the graph stops at now instead of dropping to zero for hours that haven't happened
    for (let h = 0; h <= nowLocalH; h++) {
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
      const bucketH = h  // capture for closure

      bucketDefs.push({
        key: zp(h),
        label,
        match: (dt) => localDateStr(dt) === localToday && localHour(dt) === bucketH,
        // Presence-based: person counts for every hour from check-in until checkout
        // This makes the graph stay flat (e.g. check-in 8AM still in office → flat line 8→now)
        matchPresence: (cinDt, coutDt) => {
          const cinDate = localDateStr(cinDt)
          const cinH = localHour(cinDt)

          // Checked in after this bucket - not present yet
          if (cinDate > localToday || (cinDate === localToday && cinH > bucketH)) return false

          // Current hour: only count people still checked in right now
          if (bucketH === nowLocalH) return !coutDt

          // Past hours: still active (no checkout) - present through now
          if (!coutDt) return true

          // Past hours: checked out - present only if checkout was in this hour or later
          const coutDate = localDateStr(coutDt)
          const coutH = localHour(coutDt)
          return coutDate > localToday || (coutDate === localToday && coutH >= bucketH)
        },
      })
    }
  } else if (interval === 'week') {
    const weekAgo = new Date(now)
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 6)
    startDate = weekAgo.toISOString().slice(0, 10) + 'T00:00:00Z'
    endDate = todayStr + 'T23:59:59Z'
    // Daily buckets for last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - i)
      const dayStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
      bucketDefs.push({
        key: dayStr,
        label,
        match: (dt) => dt.toISOString().slice(0, 10) === dayStr,
      })
    }
  } else if (interval === 'month') {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    startDate = isoDate(year, month, 1) + 'T00:00:00Z'
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    endDate = isoDate(year, month, lastDay) + 'T23:59:59Z'
    // Daily buckets 1..lastDay
    for (let d = 1; d <= lastDay; d++) {
      const dayStr = isoDate(year, month, d)
      bucketDefs.push({ key: dayStr, label: String(d), match: (dt) => dt.toISOString().slice(0, 10) === dayStr })
    }
  } else if (interval === '3month') {
    const start = new Date(now)
    start.setUTCMonth(start.getUTCMonth() - 2, 1)
    startDate = isoDate(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) + 'T00:00:00Z'
    endDate = todayStr + 'T23:59:59Z'
    // Weekly buckets
    const cur = new Date(start)
    while (cur <= now) {
      const weekStart = cur.toISOString().slice(0, 10)
      const weekEnd = new Date(cur)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      const weekEndStr = weekEnd.toISOString().slice(0, 10)
      const label = `${cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      const ws = weekStart, we = weekEndStr
      bucketDefs.push({
        key: ws,
        label,
        match: (dt) => dt.toISOString().slice(0, 10) >= ws && dt.toISOString().slice(0, 10) <= we,
      })
      cur.setUTCDate(cur.getUTCDate() + 7)
    }
  } else if (interval === '6month') {
    const start = new Date(now)
    start.setUTCMonth(start.getUTCMonth() - 5, 1)
    startDate = isoDate(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) + 'T00:00:00Z'
    endDate = todayStr + 'T23:59:59Z'
    // Monthly buckets
    const cur = new Date(start)
    while (cur.getUTCFullYear() < now.getUTCFullYear() ||
           (cur.getUTCFullYear() === now.getUTCFullYear() && cur.getUTCMonth() <= now.getUTCMonth())) {
      const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1
      const monthKey = isoDate(y, m, 1)
      const label = cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const monthEnd = isoDate(y, m, lastD)
      bucketDefs.push({
        key: monthKey,
        label,
        match: (dt) => dt.toISOString().slice(0, 10) >= monthKey && dt.toISOString().slice(0, 10) <= monthEnd,
      })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
  } else if (interval === 'custom') {
    if (!fromParam || !toParam) {
      return NextResponse.json({ error: 'Missing from/to params', code: 'BAD_REQUEST' }, { status: 400 })
    }
    startDate = fromParam + 'T00:00:00Z'
    endDate   = toParam   + 'T23:59:59Z'
    const fromD = new Date(startDate)
    const toD   = new Date(endDate)
    const daysDiff = (toD.getTime() - fromD.getTime()) / (1000 * 60 * 60 * 24)

    if (daysDiff <= 31) {
      // Daily buckets
      const cur = new Date(fromD)
      while (cur <= toD) {
        const dayStr = cur.toISOString().slice(0, 10)
        const label  = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        bucketDefs.push({ key: dayStr, label, match: (dt) => dt.toISOString().slice(0, 10) === dayStr })
        cur.setUTCDate(cur.getUTCDate() + 1)
      }
    } else if (daysDiff <= 90) {
      // Weekly buckets
      const cur = new Date(fromD)
      while (cur <= toD) {
        const ws  = cur.toISOString().slice(0, 10)
        const we  = new Date(cur); we.setUTCDate(we.getUTCDate() + 6)
        const weStr = we.toISOString().slice(0, 10)
        const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        bucketDefs.push({ key: ws, label, match: (dt) => dt.toISOString().slice(0, 10) >= ws && dt.toISOString().slice(0, 10) <= weStr })
        cur.setUTCDate(cur.getUTCDate() + 7)
      }
    } else {
      // Monthly buckets
      const cur = new Date(Date.UTC(fromD.getUTCFullYear(), fromD.getUTCMonth(), 1))
      const toMonth = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), 1))
      while (cur <= toMonth) {
        const y = cur.getUTCFullYear(), m = cur.getUTCMonth() + 1
        const monthKey = isoDate(y, m, 1)
        const lastD    = new Date(Date.UTC(y, m, 0)).getUTCDate()
        const monthEnd = isoDate(y, m, lastD)
        const label    = cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
        bucketDefs.push({ key: monthKey, label, match: (dt) => dt.toISOString().slice(0, 10) >= monthKey && dt.toISOString().slice(0, 10) <= monthEnd })
        cur.setUTCMonth(cur.getUTCMonth() + 1)
      }
    }
  } else {
    // year - 12 monthly buckets
    const year = now.getUTCFullYear()
    startDate = `${year}-01-01T00:00:00Z`
    endDate = `${year}-12-31T23:59:59Z`
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for (let m = 1; m <= 12; m++) {
      const monthKey = isoDate(year, m, 1)
      const lastD = new Date(Date.UTC(year, m, 0)).getUTCDate()
      const monthEnd = isoDate(year, m, lastD)
      bucketDefs.push({
        key: monthKey,
        label: months[m - 1],
        match: (dt) => dt.toISOString().slice(0, 10) >= monthKey && dt.toISOString().slice(0, 10) <= monthEnd,
      })
    }
  }

  // Fetch events using queryWorkspaceEvents (applies plan + signal matching)
  const allEvents = await queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, {
    startDate,
    endDate,
  })

  // Only count events that are truly "in office" - same logic as the dashboard tile:
  // exclude remote_checkin and any office_checkin that failed signal matching (unverified)
  const events = allEvents.filter(
    (ev) => ev.event_type !== 'remote_checkin' && (ev.matched_by === 'verified' || ev.matched_by === 'override')
  )

  const tz = ctx.workspace.display_timezone || 'UTC'
  const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

  // Calculate true period totals (not summed from buckets)
  // For 'today', we only count events that started today in workspace TZ
  const periodEvents = interval === 'today'
    ? events.filter(ev => {
        const cinDt = new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z')
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(cinDt) === localToday
      })
    : events

  const total_checkins_period = periodEvents.length
  const total_hours_period = sessionHours(periodEvents)

  const total_members = (await getActiveMemberIds(ctx.workspace.id)).length

  // Build buckets
  const buckets: InsightBucket[] = bucketDefs.map((def) => {
    if (def.matchPresence) {
      // Presence-based: count users whose session spans this hour window
      const present = events.filter((ev) => {
        const cinDt = new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z')
        const coutDt = ev.checkout_at
          ? new Date(ev.checkout_at.includes('T') ? ev.checkout_at : ev.checkout_at.replace(' ', 'T') + 'Z')
          : null
        return def.matchPresence!(cinDt, coutDt)
      })
      return {
        label: def.label,
        key: def.key,
        unique_users: new Set(present.map((e) => e.user_id)).size,
        // For hourly buckets, only count check-ins that actually HAPPENED in this hour
        // and hours from sessions that STARTED in this hour.
        // This avoids double-counting when summing buckets (though we now pass totals separately).
        total_checkins: events.filter(ev => def.match(new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z'))).length,
        total_hours: sessionHours(events.filter(ev => def.match(new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z')))),
      }
    }

    // Default: bucket by checkin_at timestamp
    const matching = events.filter((ev) => def.match(new Date(
      ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z'
    )))
    const unique_users = new Set(matching.map((e) => e.user_id)).size
    return {
      label: def.label,
      key: def.key,
      unique_users,
      total_checkins: matching.length,
      total_hours: sessionHours(matching),
    }
  })

  const maxBucket = buckets.reduce<InsightBucket | null>(
    (best, b) => b.unique_users > (best?.unique_users ?? -1) ? b : best, null
  )

  const daysWithData = buckets.filter((b) => b.unique_users > 0).length
  const avg_daily_users = daysWithData > 0
    ? Math.round((buckets.reduce((s, b) => s + b.unique_users, 0) / daysWithData) * 10) / 10
    : 0

  const response: InsightsResponse = {
    interval,
    buckets,
    total_members,
    peak_bucket: maxBucket?.unique_users ? maxBucket.key : null,
    avg_daily_users,
    total_checkins: total_checkins_period,
    total_hours: total_hours_period,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
