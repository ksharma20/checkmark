import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import { haversineMetres } from '@/lib/geo'

interface Props { params: Promise<{ slug: string }> }

export interface AnalyticsMember {
  user_id: string
  name: string
  email: string
  office_days: number
  wfh_days: number
  absent_days: number
  working_days: number
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

/** Count Mon–Fri days in [startDate, endDate] up to today inclusive. */
function countWorkingDays(startDate: string, endDate: string): number {
  const today = new Date().toISOString().slice(0, 10)
  const effectiveEnd = endDate > today ? today : endDate
  const start = new Date(startDate + 'T00:00:00Z')
  const end = new Date(effectiveEnd + 'T00:00:00Z')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
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

/** Count distinct GPS clusters (for field force — simple 500m clustering). */
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
  const now = new Date()
  const defaultYear = now.getUTCFullYear()
  const defaultMonth = String(now.getUTCMonth() + 1).padStart(2, '0')
  const defaultStart = `${defaultYear}-${defaultMonth}-01`
  const defaultEnd = new Date(defaultYear, now.getUTCMonth() + 1, 0)
    .toISOString().slice(0, 10)

  const startDate = url.searchParams.get('start') ?? defaultStart
  const endDate = url.searchParams.get('end') ?? defaultEnd

  // Fetch all events in range (signal-matched)
  const allEvents = await queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, {
    startDate,
    endDate: endDate + 'T23:59:59Z',
  })

  const signals_configured = allEvents.some((e) => e.matched_by !== 'none' && e.matched_by !== undefined)

  // Group events by userId → by day
  const byUser = new Map<string, typeof allEvents>()
  for (const ev of allEvents) {
    if (!byUser.has(ev.user_id)) byUser.set(ev.user_id, [])
    byUser.get(ev.user_id)!.push(ev)
  }

  // Get member details for names
  const memberDetails = await getActiveMembersWithDetails(ctx.workspace.id)
  const memberMap = new Map(memberDetails.map((m) => [m.user_id, m]))

  const working_days = countWorkingDays(startDate, endDate)

  const members: AnalyticsMember[] = []

  for (const [userId, events] of byUser) {
    const memberInfo = memberMap.get(userId)
    if (!memberInfo) continue

    // Group by day (YYYY-MM-DD from checkin_at)
    const byDay = new Map<string, typeof allEvents>()
    for (const ev of events) {
      const day = ev.checkin_at.slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(ev)
    }

    let office_days = 0
    let wfh_days = 0
    let multi_location_days = 0
    let office_hours = 0
    let wfh_hours = 0
    const checkinLocations: [number, number][] = []

    for (const [, dayEvents] of byDay) {
      const hasOffice = dayEvents.some((e) => e.matched_by === 'wifi' || e.matched_by === 'gps' || e.matched_by === 'ip' || e.matched_by === 'override')
      const hasAny = dayEvents.length > 0

      if (hasOffice) {
        office_days++
        office_hours += sumHours(dayEvents.filter((e) => e.matched_by !== 'none'))
      } else if (hasAny) {
        wfh_days++
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

    const attendance_days = office_days + wfh_days
    const absent_days = Math.max(0, working_days - attendance_days)
    const total_hours = office_hours + wfh_hours
    const avg_daily_hours = attendance_days > 0 ? total_hours / attendance_days : 0
    const field_force_locations = countGpsClusters(checkinLocations)

    members.push({
      user_id: userId,
      name: memberInfo.full_name ?? memberInfo.email,
      email: memberInfo.email,
      office_days,
      wfh_days,
      absent_days,
      working_days,
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
    working_days,
    signals_configured,
    members,
  }

  return NextResponse.json(response)
}
