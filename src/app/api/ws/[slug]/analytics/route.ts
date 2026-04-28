import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getWorkspaceSignals } from '@/lib/db/queries/signals'
import { haversineMetres } from '@/lib/geo'
import { countWorkdays, dateKeyInTimezone, isOfficeMatched, nextDateKey, summarizeAttendanceDays } from '@/lib/attendance-summary'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'

interface Props { params: Promise<{ slug: string }> }

export interface AnalyticsMember {
  user_id: string
  name: string
  email: string
  joined_at: string          // workspace join date (YYYY-MM-DD)
  office_days: number
  wfh_days: number
  absent_days: number
  working_days: number       // effective working days for this member (from join date)
  total_office_hours: number
  total_wfh_hours: number
  total_hours: number
  avg_daily_hours: number
  multi_location_days: number  // days where checkout GPS > 1km from checkin GPS
  field_force_locations: number  // distinct GPS clusters visited (field-force metric)
}

export interface AnalyticsResponse {
  start_date: string
  end_date: string
  working_days: number
  signals_configured: boolean
  members: AnalyticsMember[]
}

/** Sum duration hours for a list of events (only completed events). */
function sumHours(events: { checkin_at: string; checkout_at: string | null }[]): number {
  let total = 0
  for (const ev of events) {
    if (!ev.checkout_at) continue
    const cin = new Date(ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z').getTime()
    const cout = new Date(ev.checkout_at.includes('T') ? ev.checkout_at : ev.checkout_at.replace(' ', 'T') + 'Z').getTime()
    total += Math.max(0, (cout - cin) / (1000 * 60 * 60))
  }
  return total
}

/** Returns true if checkout GPS differs from checkin GPS by more than 1km. */
function isDifferentLocation(ev: {
  gps_lat: number | null; gps_lng: number | null
  checkout_gps_lat: number | null; checkout_gps_lng: number | null
}): boolean {
  if (ev.gps_lat == null || ev.gps_lng == null) return false
  if (ev.checkout_gps_lat == null || ev.checkout_gps_lng == null) return false
  return haversineMetres(ev.gps_lat, ev.gps_lng, ev.checkout_gps_lat, ev.checkout_gps_lng) > 1000
}

/** Count distinct GPS clusters (for field force - simple 500m clustering). */
function countGpsClusters(latlngs: [number, number][]): number {
  const clusters: [number, number][] = []
  for (const [lat, lng] of latlngs) {
    const near = clusters.some(([clat, clng]) => haversineMetres(lat, lng, clat, clng) < 500)
    if (!near) clusters.push([lat, lng])
  }
  return clusters.length
}

/**
 * GET /api/ws/[slug]/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns monthly attendance analytics for all active workspace members.
 * If start/end omitted, defaults to current calendar month.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const url = new URL(request.url)
  const tz = ctx.workspace.display_timezone
  const todayLocal = todayInTz(tz)
  const [todayYear, todayMonth] = todayLocal.split('-').map(Number)
  const defaultYear = todayYear
  const defaultMonth = String(todayMonth).padStart(2, '0')
  const defaultStart = `${defaultYear}-${defaultMonth}-01`
  const defaultEnd = todayLocal

  const startDate = url.searchParams.get('start') ?? defaultStart
  const endDate = url.searchParams.get('end') ?? defaultEnd
  const effectiveEndDate = endDate > todayLocal ? todayLocal : endDate
  const startUtc = localMidnightToUtc(startDate, tz)
  const endUtc = localMidnightToUtc(nextDateKey(endDate), tz)

  // Fetch all events in range (signal-matched)
  const [allEvents, workspaceSignals] = await Promise.all([
    queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, {
      startDate: startUtc,
      endDate: endUtc,
    }),
    getWorkspaceSignals(ctx.workspace.id),
  ])

  const signals_configured = workspaceSignals.length > 0

  // Group events by userId → by day
  const byUser = new Map<string, typeof allEvents>()
  for (const ev of allEvents) {
    if (!byUser.has(ev.user_id)) byUser.set(ev.user_id, [])
    byUser.get(ev.user_id)!.push(ev)
  }

  // Get member details for names
  const memberDetails = await getActiveMembersWithDetails(ctx.workspace.id)

  const global_working_days = countWorkdays(startDate, effectiveEndDate)

  const members: AnalyticsMember[] = []

  for (const memberInfo of memberDetails) {
    const events = byUser.get(memberInfo.user_id) ?? []
    const joinedLocal = dateKeyInTimezone(memberInfo.added_at, tz)
    const effectiveStart = joinedLocal > startDate ? joinedLocal : startDate
    const countedEvents = events.filter((event) => {
      const day = dateKeyInTimezone(event.checkin_at, tz)
      return day >= effectiveStart && day <= effectiveEndDate
    })

    const byDay = new Map<string, typeof allEvents>()
    for (const ev of countedEvents) {
      const day = dateKeyInTimezone(ev.checkin_at, tz)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(ev)
    }

    let multi_location_days = 0
    let office_hours = 0
    let wfh_hours = 0
    const checkinLocations: [number, number][] = []

    for (const [, dayEvents] of byDay) {
      if (dayEvents.some((e) => isOfficeMatched(e.matched_by))) {
        office_hours += sumHours(dayEvents.filter((e) => e.matched_by !== 'none'))
      } else {
        wfh_hours += sumHours(dayEvents)
      }

      // Multi-location check: any event where checkout GPS differs > 1km from checkin
      if (dayEvents.some(isDifferentLocation)) multi_location_days++

      // Field force: collect all checkin GPS points
      for (const ev of dayEvents) {
        if (ev.gps_lat != null && ev.gps_lng != null) {
          checkinLocations.push([ev.gps_lat, ev.gps_lng])
        }
      }
    }

    const summary = summarizeAttendanceDays({
      events: countedEvents,
      startDate: effectiveStart,
      endDate: effectiveEndDate,
      timezone: tz,
      todayDate: todayLocal,
    })
    const attendance_days = summary.officeDays + summary.remoteDays
    const total_hours = office_hours + wfh_hours
    const avg_daily_hours = attendance_days > 0 ? total_hours / attendance_days : 0
    const field_force_locations = countGpsClusters(checkinLocations)

    members.push({
      user_id: memberInfo.user_id,
      name: memberInfo.full_name ?? memberInfo.email,
      email: memberInfo.email,
      joined_at: joinedLocal,
      office_days: summary.officeDays,
      wfh_days: summary.remoteDays,
      absent_days: summary.absentDays,
      working_days: summary.workingDays,
      total_office_hours: Math.round(office_hours * 10) / 10,
      total_wfh_hours: Math.round(wfh_hours * 10) / 10,
      total_hours: Math.round(total_hours * 10) / 10,
      avg_daily_hours: Math.round(avg_daily_hours * 10) / 10,
      multi_location_days,
      field_force_locations,
    })
  }

  // Sort by name
  members.sort((a, b) => a.name.localeCompare(b.name))

  const response: AnalyticsResponse = {
    start_date: startDate,
    end_date: endDate,
    working_days: global_working_days,
    signals_configured,
    members,
  }

  return NextResponse.json(response)
}
