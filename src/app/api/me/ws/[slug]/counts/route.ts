import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { db } from '@/lib/db'
import { todayInTz } from '@/lib/timezone'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ctx = await requireWsMember(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { workspace: ws } = ctx

  const today = todayInTz(ws.display_timezone)

  const rows = await db.query<{ has_checkin: number; has_checkout: number }>(
    `SELECT
       MAX(CASE WHEN pe.id IS NOT NULL THEN 1 ELSE 0 END) as has_checkin,
       MAX(CASE WHEN pe.checkout_at IS NOT NULL THEN 1 ELSE 0 END) as has_checkout
     FROM workspace_members wm
     LEFT JOIN presence_events pe
       ON pe.user_id = wm.user_id
       AND date(pe.checkin_at) = ?
       AND pe.deleted_at IS NULL
     WHERE wm.workspace_id = ? AND wm.status = 'active'
     GROUP BY wm.user_id`,
    [today, ws.id]
  )

  let present = 0, visited = 0, notIn = 0
  for (const row of rows) {
    if (row.has_checkin && !row.has_checkout) present++
    else if (row.has_checkin && row.has_checkout) visited++
    else notIn++
  }

  return NextResponse.json({ present, visited, notIn, total: rows.length })
}
