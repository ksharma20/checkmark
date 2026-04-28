import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import { countWorkdays, dateKeyInTimezone, nextDateKey, summarizeAttendanceDays } from '@/lib/attendance-summary'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'

export type StatsInterval = 'week' | 'month' | '3month' | 'custom'

export interface MemberStat {
  user_id: string
  member_id: string
  email: string
  full_name: string | null
  role: string
  joined_at: string          // workspace join date YYYY-MM-DD
  office_days: number
  remote_days: number
  absent_days: number
  total_working_days: number // effective working days from join date
  total_hours: number
  avg_hours_per_day: number
  multi_loc_days: number
}

export interface MemberStatsResponse {
  interval: StatsInterval
  members: MemberStat[]
  total_working_days: number
}

function zp(n: number) { return String(n).padStart(2, '0') }

/** Sum session hours for completed events */
function sessionHours(checkin: string, checkout: string | null): number {
  if (!checkout) return 0
  const cin = new Date(checkin.includes('T') ? checkin : checkin.replace(' ', 'T') + 'Z').getTime()
  const cout = new Date(checkout.includes('T') ? checkout : checkout.replace(' ', 'T') + 'Z').getTime()
  return Math.max(0, (cout - cin) / (1000 * 60 * 60))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const interval = (sp.get('interval') ?? 'month') as StatsInterval

  const tz = ctx.workspace.display_timezone
  const todayStr = todayInTz(tz)
  const [todayYear, todayMonth] = todayStr.split('-').map(Number)

  let startDate: string
  let endDate: string = todayStr

  if (interval === 'week') {
    const [year, month, day] = todayStr.split('-').map(Number)
    const d = new Date(Date.UTC(year, month - 1, day - 6))
    startDate = d.toISOString().slice(0, 10)
  } else if (interval === 'month') {
    startDate = `${todayYear}-${zp(todayMonth)}-01`
  } else if (interval === '3month') {
    const d = new Date(Date.UTC(todayYear, todayMonth - 1, 1))
    d.setUTCMonth(d.getUTCMonth() - 2, 1)
    startDate = d.toISOString().slice(0, 10)
  } else if (interval === 'custom') {
    const s = sp.get('start')
    const e = sp.get('end')
    startDate = s ?? `${todayYear}-${zp(todayMonth)}-01`
    endDate = e ?? todayStr
  } else {
    // fallback: current month
    startDate = `${todayYear}-${zp(todayMonth)}-01`
  }

  const effectiveEndDate = endDate > todayStr ? todayStr : endDate
  const startUtc = localMidnightToUtc(startDate, tz)
  const endUtc = localMidnightToUtc(nextDateKey(endDate), tz)

  const [events, members] = await Promise.all([
    queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, { startDate: startUtc, endDate: endUtc }),
    getActiveMembersWithDetails(ctx.workspace.id),
  ])

  const global_working_days = countWorkdays(startDate, effectiveEndDate)

  // Group events by user
  const byUser = new Map<string, typeof events>()
  for (const ev of events) {
    const arr = byUser.get(ev.user_id) ?? []
    arr.push(ev)
    byUser.set(ev.user_id, arr)
  }

  const memberStats: MemberStat[] = members.map((m) => {
    const userEvents = byUser.get(m.user_id) ?? []

    // Per-member effective start: later of range start or workspace join date
    const joinedDateStr = dateKeyInTimezone(m.added_at, tz)
    const effectiveStart = joinedDateStr > startDate ? joinedDateStr : startDate
    const countedEvents = userEvents.filter((event) => {
      const day = dateKeyInTimezone(event.checkin_at, tz)
      return day >= effectiveStart && day <= effectiveEndDate
    })

    // Group events by calendar day
    const eventsByDay = new Map<string, typeof countedEvents>()
    for (const ev of countedEvents) {
      const dayKey = dateKeyInTimezone(ev.checkin_at, tz)
      const arr = eventsByDay.get(dayKey) ?? []
      arr.push(ev)
      eventsByDay.set(dayKey, arr)
    }

    const multiLocDaySet = new Set<string>()
    let totalHours = 0

    for (const [dayKey, dayEvs] of eventsByDay) {
      if (dayEvs.some((ev) => (ev.checkout_location_mismatch ?? 0) > 0)) {
        multiLocDaySet.add(dayKey)
      }
      for (const ev of dayEvs) {
        totalHours += sessionHours(ev.checkin_at, ev.checkout_at)
      }
    }

    const summary = summarizeAttendanceDays({
      events: countedEvents,
      startDate: effectiveStart,
      endDate: effectiveEndDate,
      timezone: tz,
      todayDate: todayStr,
    })
    const present_days = summary.officeDays + summary.remoteDays
    const avg_hours_per_day = present_days > 0
      ? Math.round((totalHours / present_days) * 10) / 10
      : 0

    return {
      user_id: m.user_id,
      member_id: m.member_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      joined_at: joinedDateStr,
      office_days: summary.officeDays,
      remote_days: summary.remoteDays,
      absent_days: summary.absentDays,
      total_working_days: summary.workingDays,
      total_hours: Math.round(totalHours * 10) / 10,
      avg_hours_per_day,
      multi_loc_days: multiLocDaySet.size,
    }
  })

  return NextResponse.json({
    interval,
    members: memberStats,
    total_working_days: global_working_days,
  } satisfies MemberStatsResponse)
}
