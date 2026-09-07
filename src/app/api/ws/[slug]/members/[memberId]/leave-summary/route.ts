import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { getWorkspaceMemberByRecordId } from '@/lib/db/queries/workspaces'
import { getLeaveTypesWithBalance } from '@/lib/db/queries/leaves'
import { Action, Resource } from '@/lib/permissions/catalogue'

// ─── GET /api/ws/[slug]/members/[memberId]/leave-summary ──────────────────────
//
// ID SPACE: `memberId` is a **workspace_members.id**, NOT a users.id.
//
// It matches `.../leave-balances`, the route it sits beside in the Leave tab.
// The membership row is also what carries `added_at`, which IS the accrual
// start - so resolving the record id is not an extra hop, it is the hop that
// fetches half the inputs.
//
// This replaces the Profile tab's old workaround of pulling the WHOLE
// workspace's opening balances from `/api/ws/[slug]/leave-balances` and
// filtering client-side by user. That shipped every colleague's balances to
// anyone who could open one person's page, and it could only ever show the
// stored opening figure - never the accrued or available days, which are
// computed and never stored.

interface Props { params: Promise<{ slug: string; memberId: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params

  const ctx = await requireWsAccess(req, slug, Resource.Leaves, Action.Read)
  if (!ctx) return forbidden()

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  // An invited person has no user id yet and leave is keyed on one. Same answer
  // the sibling `.../leave-balances` gives, deliberately - two routes on one tab
  // disagreeing about what an open invitation means is worse than either answer.
  if (!member.user_id) {
    return NextResponse.json(
      { error: 'Member has not accepted the invitation', code: 'MEMBER_PENDING' },
      { status: 422 },
    )
  }

  const workingDays: number[] = (() => {
    try { return JSON.parse(ctx.workspace.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()

  const leaveTypes = await getLeaveTypesWithBalance(
    ctx.workspace.id,
    member.user_id,
    member.added_at,
    workingDays,
    ctx.workspace.leave_cutover_date,
  )

  return NextResponse.json({ leaveTypes })
}
