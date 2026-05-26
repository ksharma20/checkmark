import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getLeaveTypesWithBalance } from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const leaveTypes = await getLeaveTypesWithBalance(ctx.workspace.id, ctx.userId, ctx.member.added_at)
  return NextResponse.json({ leaveTypes })
}
