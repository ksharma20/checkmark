import { NextRequest, NextResponse } from 'next/server'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import type { PresenceEventWithMatch, MatchedBy } from '@/lib/signals'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'

export interface DashboardMember {
  member_id: string
  user_id: string
  email: string
  role: string
  full_name: string | null
  presence_status: 'present' | 'visited' | 'notIn'
  latest_event: {
    checkin_at: string
    checkout_at: string | null
    matched_by: MatchedBy
  } | null
  event_count: number
}

export interface DashboardResponse {
  members: DashboardMember[]
  total: number
  page: number
  limit: number
  counts: { present: number; visited: number; notIn: number; total: number }
}

function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const { workspace } = ctx

  // Parse query params
  const sp = request.nextUrl.searchParams
  const statusFilter = (sp.get('status') ?? 'all') as 'all' | 'present' | 'visited' | 'notIn'
  const signalFilter = (sp.get('signal') ?? 'all') as 'all' | MatchedBy
  const search = (sp.get('search') ?? '').toLowerCase().trim()
  const sortBy = (sp.get('sortBy') ?? 'time') as 'name' | 'time' | 'duration'
  const sortDir = (sp.get('sortDir') ?? 'asc') as 'asc' | 'desc'
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '25', 10)))

  // Today's UTC bounds
  const tz = workspace.display_timezone
  const todayStr = todayInTz(tz)
  const startUtc = localMidnightToUtc(todayStr, tz)
  const endUtc = localMidnightToUtc(nextDayStr(todayStr), tz)

  // Fetch events + members in parallel
  const [events, members] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, { startDate: startUtc, endDate: endUtc }),
    getActiveMembersWithDetails(workspace.id),
  ])

  // Group events by user_id
  const eventsByUser = new Map<string, PresenceEventWithMatch[]>()
  for (const event of events) {
    const arr = eventsByUser.get(event.user_id) ?? []
    arr.push(event)
    eventsByUser.set(event.user_id, arr)
  }

  // Build DashboardMember list with presence status
  const allMembers: DashboardMember[] = members.map((member: MemberWithUser) => {
    const userEvents = eventsByUser.get(member.user_id) ?? []
    const openEvent = userEvents.find((e) => !e.checkout_at)
    const latest = openEvent ?? userEvents[0] ?? null

    let presence_status: 'present' | 'visited' | 'notIn'
    if (!latest) {
      presence_status = 'notIn'
    } else if (openEvent) {
      presence_status = 'present'
    } else {
      presence_status = 'visited'
    }

    return {
      member_id: member.member_id,
      user_id: member.user_id,
      email: member.email,
      role: member.role,
      full_name: member.full_name,
      presence_status,
      latest_event: latest
        ? { checkin_at: latest.checkin_at, checkout_at: latest.checkout_at, matched_by: latest.matched_by }
        : null,
      event_count: userEvents.length,
    }
  })

  // Counts (always unfiltered)
  const counts = {
    present: allMembers.filter((m) => m.presence_status === 'present').length,
    visited: allMembers.filter((m) => m.presence_status === 'visited').length,
    notIn: allMembers.filter((m) => m.presence_status === 'notIn').length,
    total: allMembers.length,
  }

  // Apply filters
  let filtered = allMembers

  if (statusFilter !== 'all') {
    filtered = filtered.filter((m) => m.presence_status === statusFilter)
  }

  if (signalFilter !== 'all') {
    filtered = filtered.filter((m) => m.latest_event?.matched_by === signalFilter)
  }

  if (search) {
    filtered = filtered.filter((m) => {
      const name = (m.full_name ?? '').toLowerCase()
      return name.includes(search) || m.email.toLowerCase().includes(search)
    })
  }

  // Sort
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') {
      cmp = (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email)
    } else if (sortBy === 'time') {
      const tA = a.latest_event?.checkin_at ?? ''
      const tB = b.latest_event?.checkin_at ?? ''
      cmp = tA.localeCompare(tB)
    } else {
      // duration: present members with no checkout first (they're ongoing)
      const dA = a.latest_event
        ? a.latest_event.checkout_at
          ? new Date(a.latest_event.checkout_at.includes('T') ? a.latest_event.checkout_at : a.latest_event.checkout_at.replace(' ', 'T') + 'Z').getTime() -
            new Date(a.latest_event.checkin_at.includes('T') ? a.latest_event.checkin_at : a.latest_event.checkin_at.replace(' ', 'T') + 'Z').getTime()
          : Date.now() - new Date(a.latest_event.checkin_at.includes('T') ? a.latest_event.checkin_at : a.latest_event.checkin_at.replace(' ', 'T') + 'Z').getTime()
        : 0
      const dB = b.latest_event
        ? b.latest_event.checkout_at
          ? new Date(b.latest_event.checkout_at.includes('T') ? b.latest_event.checkout_at : b.latest_event.checkout_at.replace(' ', 'T') + 'Z').getTime() -
            new Date(b.latest_event.checkin_at.includes('T') ? b.latest_event.checkin_at : b.latest_event.checkin_at.replace(' ', 'T') + 'Z').getTime()
          : Date.now() - new Date(b.latest_event.checkin_at.includes('T') ? b.latest_event.checkin_at : b.latest_event.checkin_at.replace(' ', 'T') + 'Z').getTime()
        : 0
      cmp = dA - dB
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // Paginate
  const total = filtered.length
  const offset = (page - 1) * limit
  const paged = filtered.slice(offset, offset + limit)

  return NextResponse.json({ members: paged, total, page, limit, counts } satisfies DashboardResponse)
}
