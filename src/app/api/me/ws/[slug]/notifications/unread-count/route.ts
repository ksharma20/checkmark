import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getUnreadCount } from '@/lib/db/queries/notifications'

interface Props { params: Promise<{ slug: string }> }

/** The bell's 30s poll target on `/me`. */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  const count = await getUnreadCount(ctx.userId, ctx.workspace.id)
  return NextResponse.json({ count })
}
