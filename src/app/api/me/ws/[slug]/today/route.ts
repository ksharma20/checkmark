import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug, getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { db } from '@/lib/db'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { queryWorkspaceEvents } from '@/lib/signals'
import type { MatchedBy } from '@/lib/signals'

export interface MemberTodaySummary {
  user_id: string
  full_name: string | null
  email: string
  presence_status: 'present' | 'visited' | 'notIn'
  matched_by: MatchedBy | null
  event_type: string | null
  checkin_at: string | null
  checkout_at: string | null
  duration_hours: number | null
}

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const ws = await getWorkspaceBySlug(slug)
  if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Auth: active member only (not necessarily admin)
  const membership = await db.queryOne<{ id: string }>(
    `SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
    [ws.id, userId]
  )
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const todayStr = todayInTz(ws.display_timezone)
  const startUtc = localMidnightToUtc(todayStr, ws.display_timezone)
  const endUtc = localMidnightToUtc(nextDay(todayStr), ws.display_timezone)

  const [events, members] = await Promise.all([
    queryWorkspaceEvents(ws.id, ws.plan, { startDate: startUtc, endDate: endUtc }),
    getActiveMembersWithDetails(ws.id),
  ])

  // Group events by user_id
  const eventsByUser = new Map<string, typeof events>()
  for (const ev of events) {
    const arr = eventsByUser.get(ev.user_id) ?? []
    arr.push(ev)
    eventsByUser.set(ev.user_id, arr)
  }

  function parseUtcMs(s: string | null): number | null {
    if (!s) return null
    const iso = s.includes('T') ? (s.endsWith('Z') ? s : s + 'Z') : s.replace(' ', 'T') + 'Z'
    return new Date(iso).getTime()
  }

  const result: MemberTodaySummary[] = members.map((m) => {
    const userEvents = eventsByUser.get(m.user_id) ?? []
    const openEvent = userEvents.find((e) => !e.checkout_at)
    const latest = openEvent ?? userEvents[0] ?? null

    let presence_status: 'present' | 'visited' | 'notIn' = 'notIn'
    if (latest && openEvent) presence_status = 'present'
    else if (latest) presence_status = 'visited'

    const inMs = parseUtcMs(latest?.checkin_at ?? null)
    const outMs = parseUtcMs(latest?.checkout_at ?? null)
    const duration_hours = inMs && outMs && outMs > inMs ? (outMs - inMs) / 3_600_000 : null

    return {
      user_id: m.user_id,
      full_name: m.full_name,
      email: m.email,
      presence_status,
      matched_by: latest?.matched_by ?? null,
      event_type: latest?.event_type ?? null,
      checkin_at: latest?.checkin_at ?? null,
      checkout_at: latest?.checkout_at ?? null,
      duration_hours,
    }
  })

  return NextResponse.json({ workspace: { name: ws.name, slug: ws.slug }, members: result })
}
