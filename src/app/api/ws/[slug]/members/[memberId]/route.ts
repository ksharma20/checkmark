import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceMembers, removeWorkspaceMember } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string; memberId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const members = await getWorkspaceMembers(ctx.workspace.id)
  const target = members.find((m) => m.id === memberId)
  if (!target) return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Cannot remove admins', code: 'CANNOT_REMOVE_ADMIN' }, { status: 403 })
  }

  await removeWorkspaceMember(memberId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
