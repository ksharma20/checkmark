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

  const workingDayNums: number[] = (() => {
    try { return JSON.parse(ctx.workspace.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()

  const leaveTypes = await getLeaveTypesWithBalance(
    ctx.workspace.id,
    ctx.userId,
    ctx.member.added_at,
    workingDayNums,
    ctx.workspace.leave_cutover_date,
  )
  return NextResponse.json({ leaveTypes })
}
