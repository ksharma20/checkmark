import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getNotificationsForUser, getUnreadCount } from '@/lib/db/queries/notifications'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const [notifications, unread_count] = await Promise.all([
    getNotificationsForUser(ctx.userId, ctx.workspace.id, 20),
    getUnreadCount(ctx.userId, ctx.workspace.id),
  ])
  return NextResponse.json({ notifications, unread_count })
}
