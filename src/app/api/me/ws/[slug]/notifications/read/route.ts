import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { markNotificationsRead } from '@/lib/db/queries/notifications'
import { parseStringIds } from '@/lib/parse'

interface Props { params: Promise<{ slug: string }> }

/** Marks read within one workspace only - "mark all" here must not silently
 *  clear another workspace's unread badge.
 *
 *  With ONE exception, and it is the same one the list and count endpoints
 *  make: the caller's own `invitation` rows are in scope here because they are
 *  in scope there. A row this screen displayed and the reader dismissed must be
 *  markable from it, or "mark all read" leaves the badge stuck on a row that is
 *  already on screen. */
export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  let body: { ids?: unknown } = {}
  try { body = await req.json() } catch { /* optional */ }
  const ids = parseStringIds(body.ids)
  await markNotificationsRead(ctx.userId, ctx.workspace.id, ids, true)
  return NextResponse.json({ ok: true })
}
