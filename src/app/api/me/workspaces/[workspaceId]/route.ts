import { NextRequest, NextResponse } from 'next/server'
import { leaveWorkspace } from '@/lib/db/queries/workspaces'
import { reparentReportsOf } from '@/lib/db/queries/hierarchy'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { workspaceId } = await params
  const left = await leaveWorkspace(workspaceId, userId)

  if (!left) {
    return NextResponse.json(
      { error: 'Cannot leave workspace - you are the sole admin. Transfer admin role first.', code: 'SOLE_ADMIN' },
      { status: 403 }
    )
  }

  // AFTER the leave, not before: leaveWorkspace can refuse (sole admin), and
  // re-parenting first would restructure the org on a leave that never
  // happened. Safe to run late because leaveWorkspace only sets status to
  // 'revoked' - the row it reads is still there. The admin-side removal is the
  // mirror image: that one hard-deletes, so it must re-parent first.
  await reparentReportsOf({ workspaceId, departingUserId: userId })

  return NextResponse.json({ success: true })
}
