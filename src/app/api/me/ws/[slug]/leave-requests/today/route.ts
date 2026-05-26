import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getMembersOnLeaveToday } from '@/lib/db/queries/leaves'
import { todayInTz } from '@/lib/timezone'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const today = todayInTz(ctx.workspace.display_timezone)
  const members = await getMembersOnLeaveToday(ctx.workspace.id, today)
  return NextResponse.json({ members })
}
