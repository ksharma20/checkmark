import { NextRequest, NextResponse } from 'next/server'
import { markNotificationsRead } from '@/lib/db/queries/notifications'
import { parseStringIds } from '@/lib/parse'

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  let body: { ids?: unknown } = {}
  try { body = await request.json() } catch { /* optional */ }
  const ids = parseStringIds(body.ids)
  await markNotificationsRead(userId, undefined, ids)
  return NextResponse.json({ ok: true })
}
