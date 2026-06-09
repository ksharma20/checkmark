import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { markNotificationsRead } from '@/lib/db/queries/notifications'
import { parseStringIds } from '@/lib/parse'

interface Props { params: Promise<{ slug: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  let body: { ids?: unknown } = {}
  try { body = await req.json() } catch { /* optional */ }
  const ids = parseStringIds(body.ids)
  await markNotificationsRead(ctx.userId, ctx.workspace.id, ids)
  return NextResponse.json({ ok: true })
}
