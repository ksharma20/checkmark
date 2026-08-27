import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { getWorkspaceMembers, removeWorkspaceMember } from '@/lib/db/queries/workspaces'
import { canManage } from '@/lib/permissions/ranks'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; memberId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Members, Action.Delete)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const members = await getWorkspaceMembers(ctx.workspace.id)
  const target = members.find((m) => m.id === memberId)
  if (!target) return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })

  // The rank rule replaces the old blanket "cannot remove admins" block: an
  // owner CAN remove an admin, but an admin can never remove another admin or
  // the owner, because equal rank does not manage equal rank.
  if (!canManage(ctx.role.key, target.role)) {
    return NextResponse.json(
      { error: 'You cannot remove this member', code: 'RANK_TOO_LOW' },
      { status: 403 },
    )
  }
  if (target.user_id && target.user_id === ctx.userId) {
    return NextResponse.json(
      { error: 'You cannot remove yourself', code: 'SELF_REMOVE' },
      { status: 400 },
    )
  }

  await removeWorkspaceMember(memberId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
