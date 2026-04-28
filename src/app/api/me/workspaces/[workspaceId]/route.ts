import { NextRequest, NextResponse } from 'next/server'
import { leaveWorkspace } from '@/lib/db/queries/workspaces'

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

  return NextResponse.json({ success: true })
}
