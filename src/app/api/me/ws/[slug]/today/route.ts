import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { db } from '@/lib/db'
import { todayInTz } from '@/lib/timezone'

export interface MemberTodaySummary {
  user_id: string
  full_name: string | null
  email: string
  presence_status: 'present' | 'visited' | 'notIn'
  checkin_at: string | null
  checkout_at: string | null
  duration_hours: number | null
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

  const today = todayInTz(ws.display_timezone)

  const rows = await db.query<{
    user_id: string
    full_name: string | null
    email: string
    checkin_at: string | null
    checkout_at: string | null
  }>(
    `SELECT
       wm.user_id,
       u.full_name,
       wm.email,
       (SELECT pe.checkin_at FROM presence_events pe
        WHERE pe.user_id = wm.user_id AND date(pe.checkin_at) = ? AND pe.deleted_at IS NULL
        ORDER BY pe.checkin_at DESC LIMIT 1) as checkin_at,
       (SELECT pe.checkout_at FROM presence_events pe
        WHERE pe.user_id = wm.user_id AND date(pe.checkin_at) = ? AND pe.deleted_at IS NULL
        ORDER BY pe.checkin_at DESC LIMIT 1) as checkout_at
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? AND wm.status = 'active'
     ORDER BY u.full_name ASC`,
    [today, today, ws.id]
  )

  function parseUtcMs(s: string | null): number | null {
    if (!s) return null
    const iso = s.includes('T') ? (s.endsWith('Z') ? s : s + 'Z') : s.replace(' ', 'T') + 'Z'
    return new Date(iso).getTime()
  }

  const members: MemberTodaySummary[] = rows.map((row) => {
    let presence_status: 'present' | 'visited' | 'notIn' = 'notIn'
    if (row.checkin_at && !row.checkout_at) presence_status = 'present'
    else if (row.checkin_at && row.checkout_at) presence_status = 'visited'

    const inMs = parseUtcMs(row.checkin_at)
    const outMs = parseUtcMs(row.checkout_at)
    const duration_hours = inMs && outMs && outMs > inMs ? (outMs - inMs) / 3_600_000 : null

    return { user_id: row.user_id, full_name: row.full_name, email: row.email, presence_status, checkin_at: row.checkin_at, checkout_at: row.checkout_at, duration_hours }
  })

  return NextResponse.json({ workspace: { name: ws.name, slug: ws.slug }, members })
}
