import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getNotificationsForUser, getUnreadCount } from '@/lib/db/queries/notifications'

interface Props { params: Promise<{ slug: string }> }

/**
 * The `/me` bell polls one workspace, not the account. The unscoped
 * `/api/me/notifications` trio still backs the unified view; this one exists so
 * the bell's count matches the workspace the pill is pointing at.
 *
 * The slug is never trusted: `requireWsMember` resolves it to a real workspace
 * and checks the session user's active membership before any query runs.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const [notifications, unread_count] = await Promise.all([
    getNotificationsForUser(ctx.userId, ctx.workspace.id, 50),
    getUnreadCount(ctx.userId, ctx.workspace.id),
  ])
  return NextResponse.json({ notifications, unread_count })
}
