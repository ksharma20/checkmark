import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { getWorkspaceMemberByRecordId } from '@/lib/db/queries/workspaces'
import { getUserLeaveRequests } from '@/lib/db/queries/leaves'
import { Action, Resource } from '@/lib/permissions/catalogue'

// ─── GET /api/ws/[slug]/members/[memberId]/leave-requests ─────────────────────
//
// ID SPACE: `memberId` is a **workspace_members.id**, NOT a users.id - the same
// as `.../leave-summary` and `.../leave-balances`, the two routes it shares the
// Leave tab with.
//
// Read-only, and it will stay that way: approve and reject belong to the
// Approvals queue, which actions a request through `actionLeaveRequest()` under
// `Resource.Approvals`. A second write path onto the same rows is how a
// concurrent double-action stops being a clean 409.

interface Props { params: Promise<{ slug: string; memberId: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params

  const ctx = await requireWsAccess(req, slug, Resource.Leaves, Action.Read)
  if (!ctx) return forbidden()

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  if (!member.user_id) {
    return NextResponse.json(
      { error: 'Member has not accepted the invitation', code: 'MEMBER_PENDING' },
      { status: 422 },
    )
  }

  const requests = await getUserLeaveRequests(ctx.workspace.id, member.user_id)
  return NextResponse.json({ requests })
}
