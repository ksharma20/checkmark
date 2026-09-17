import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getUnreadCount } from '@/lib/db/queries/notifications'

interface Props { params: Promise<{ slug: string }> }

/**
 * The bell's 30s poll target on `/me`.
 *
 * Counts this workspace's rows PLUS the caller's own workspace invitations,
 * matching the list endpoint beside it exactly. Without that the bell of a
 * member who already has a workspace never moves for an invitation to another
 * one - which is precisely the case the in-app invitation exists for.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const count = await getUnreadCount(ctx.userId, ctx.workspace.id, true)
  return NextResponse.json({ count })
}
