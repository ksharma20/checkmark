import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'

export type StatsInterval = 'week' | 'month' | '3month'

export interface MemberStat {
  user_id: string
  member_id: string
  email: string
  full_name: string | null
  role: string
  office_days: number
  remote_days: number
  absent_days: number
  total_working_days: number
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

/** Count Mon–Fri days in [startUtc, endUtc] (ISO date strings) */
function countWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate.slice(0, 10) + 'T00:00:00Z')
  const end = new Date(endDate.slice(0, 10) + 'T00:00:00Z')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

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

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  let startDate: string
  let endDate: string = todayStr + 'T23:59:59Z'

  if (interval === 'week') {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - 6)
    startDate = d.toISOString().slice(0, 10) + 'T00:00:00Z'
  } else if (interval === 'month') {
    const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1
    startDate = `${y}-${zp(m)}-01T00:00:00Z`
  } else if (interval === '3month') {
    const d = new Date(now)
    d.setUTCMonth(d.getUTCMonth() - 2, 1)
    startDate = d.toISOString().slice(0, 10) + 'T00:00:00Z'
  } else if (interval === '6month') {
    const d = new Date(now)
    d.setUTCMonth(d.getUTCMonth() - 5, 1)
    startDate = d.toISOString().slice(0, 10) + 'T00:00:00Z'
  } else {
    // year
    startDate = `${now.getUTCFullYear()}-01-01T00:00:00Z`
  }

  const [events, members] = await Promise.all([
    queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, { startDate, endDate }),
    getActiveMembersWithDetails(ctx.workspace.id),
  ])

  const total_working_days = countWorkingDays(startDate, endDate)

  // Group events by user
  const byUser = new Map<string, typeof events>()
  for (const ev of events) {
    const arr = byUser.get(ev.user_id) ?? []
    arr.push(ev)
    byUser.set(ev.user_id, arr)
  }

  const memberStats: MemberStat[] = members.map((m) => {
    const userEvents = byUser.get(m.user_id) ?? []

    // Distinct days by signal type
    const officeDaySet = new Set<string>()
    const remoteDaySet = new Set<string>()
    const multiLocDaySet = new Set<string>()
    let totalHours = 0

    for (const ev of userEvents) {
      const dayKey = (ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z').slice(0, 10)
      if (ev.matched_by === 'verified' || ev.matched_by === 'override') {
        officeDaySet.add(dayKey)
      } else {
        // partial, or none (checked in but outside office signal) → remote
        remoteDaySet.add(dayKey)
      }
      if (ev.checkout_location_mismatch === 1) {
        multiLocDaySet.add(dayKey)
      }
      totalHours += sessionHours(ev.checkin_at, ev.checkout_at)
    }

    const office_days = officeDaySet.size
    const remote_days = remoteDaySet.size
    const present_days = new Set([...officeDaySet, ...remoteDaySet]).size
    const absent_days = Math.max(0, total_working_days - present_days)
    const avg_hours_per_day = present_days > 0
      ? Math.round((totalHours / present_days) * 10) / 10
      : 0

    return {
      user_id: m.user_id,
      member_id: m.member_id,
      email: m.email,
      full_name: m.full_name,
      role: m.role,
      office_days,
      remote_days,
      absent_days,
      total_working_days,
      total_hours: Math.round(totalHours * 10) / 10,
      avg_hours_per_day,
      multi_loc_days: multiLocDaySet.size,
    }
  })

  return NextResponse.json({
    interval,
    members: memberStats,
    total_working_days,
  } satisfies MemberStatsResponse)
}
