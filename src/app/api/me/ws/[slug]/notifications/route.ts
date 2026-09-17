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
 *
 * `includeInvitations` is the one deliberate hole in that scoping, and it is
 * not a hole in the ACCESS check - `user_id = ?` still decides every row. An
 * invitation is addressed to a person, not to a membership, and it is by
 * definition from a workspace they are not in yet; scoping it away would hide
 * the only notification that cannot arrive through any other feed, from exactly
 * the people it is for - anybody who already belongs to one workspace, which is
 * whose bell this endpoint is. The count endpoint beside this one passes the
 * same flag, or the badge would promise a row this list does not contain.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const [notifications, unread_count] = await Promise.all([
    getNotificationsForUser(ctx.userId, ctx.workspace.id, 50, 0, true),
    getUnreadCount(ctx.userId, ctx.workspace.id, true),
  ])
  return NextResponse.json({ notifications, unread_count })
}
