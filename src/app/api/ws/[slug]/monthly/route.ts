import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { getPlanLimits } from '@/lib/plans'
import type { MatchedBy } from '@/lib/signals'

interface Props { params: Promise<{ slug: string }> }

export type DayStatus = 'office' | 'remote' | 'absent' | 'future'

export interface MemberMonthRow {
  user_id: string
  name: string
  email: string
  days: Record<string, DayStatus>  // key = 'YYYY-MM-DD'
  office_days: number
  remote_days: number
  absent_days: number
}

export interface MonthlyResponse {
  year: number
  month: number
  days_in_month: number
  working_days: number
  signals_configured: boolean
  members: MemberMonthRow[]
}

function isWorkday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z')
  const dow = d.getUTCDay()
  return dow !== 0 && dow !== 6
}

function countWorkdays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (isWorkday(dateStr)) count++
  }
  return count
}

function isOfficeMatch(matchedBy: MatchedBy): boolean {
  return matchedBy === 'verified' || matchedBy === 'override'
}

/**
 * GET /api/ws/[slug]/monthly?year=YYYY&month=M
 *
 * Returns per-day attendance status for each active member in the given month.
 * Defaults to current month.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workspace } = ctx
  const url = new URL(request.url)
  const now = new Date()

  const year = parseInt(url.searchParams.get('year') ?? String(now.getUTCFullYear()), 10)
  const month = parseInt(url.searchParams.get('month') ?? String(now.getUTCMonth() + 1), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  // Plan history gate check
  const planLimits = getPlanLimits(workspace.plan)
  if (planLimits.historyMonths !== null) {
    const gateDate = new Date()
    gateDate.setMonth(gateDate.getMonth() - planLimits.historyMonths)
    const requestDate = new Date(year, month - 1, 1)
    if (requestDate < gateDate) {
      return NextResponse.json(
        { error: 'Date range outside plan history window', code: 'PLAN_HISTORY_GATE' },
        { status: 402 }
      )
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}T23:59:59Z`

  const [allEvents, memberDetails] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, { startDate, endDate }),
    getActiveMembersWithDetails(workspace.id),
  ])

  const signals_configured = allEvents.some(
    (e) => e.matched_by !== 'none' && e.matched_by !== undefined
  )

  // Group events by userId → day
  const byUserDay = new Map<string, Map<string, MatchedBy[]>>()
  for (const ev of allEvents) {
    const day = ev.checkin_at.slice(0, 10)
    if (!byUserDay.has(ev.user_id)) byUserDay.set(ev.user_id, new Map())
    const userMap = byUserDay.get(ev.user_id)!
    if (!userMap.has(day)) userMap.set(day, [])
    userMap.get(day)!.push(ev.matched_by)
  }

  const todayStr = now.toISOString().slice(0, 10)
  const working_days = countWorkdays(year, month)

  const members: MemberMonthRow[] = memberDetails.map((member) => {
    const userDayMap = byUserDay.get(member.user_id) ?? new Map<string, MatchedBy[]>()
    const days: Record<string, DayStatus> = {}
    let office_days = 0
    let remote_days = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`

      if (dateStr > todayStr) {
        days[dateStr] = 'future'
        continue
      }

      if (!isWorkday(dateStr)) continue

      const dayMatches = userDayMap.get(dateStr)
      if (!dayMatches || dayMatches.length === 0) {
        days[dateStr] = 'absent'
      } else if (signals_configured) {
        const hasOffice = dayMatches.some(isOfficeMatch)
        if (hasOffice) {
          days[dateStr] = 'office'
          office_days++
        } else {
          days[dateStr] = 'remote'
          remote_days++
        }
      } else {
        // No signals — all check-ins count as "office"
        days[dateStr] = 'office'
        office_days++
      }
    }

    const present_days = office_days + remote_days
    const absent_days = Math.max(0, working_days - present_days)

    return {
      user_id: member.user_id,
      name: member.full_name ?? member.email,
      email: member.email,
      days,
      office_days,
      remote_days,
      absent_days,
    }
  })

  members.sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    year,
    month,
    days_in_month: daysInMonth,
    working_days,
    signals_configured,
    members,
  } satisfies MonthlyResponse)
}
