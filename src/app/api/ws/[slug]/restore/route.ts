import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { restoreWorkspace, getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

/**
 * POST /api/ws/[slug]/restore
 *
 * Restores an archived workspace. Admin only.
 * Blocked if admin already has an active workspace (max 1 active limit).
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Ownership, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  if (!ctx.workspace.archived_at) {
    return NextResponse.json({ error: 'Workspace is not archived', code: 'NOT_ARCHIVED' }, { status: 409 })
  }

  // Check active workspace limit before restoring
  const active = await getAdminWorkspacesForUser(ctx.userId)
  if (active.length >= 1) {
    return NextResponse.json(
      { error: 'You already have an active workspace. Archive it before restoring another.', code: 'WORKSPACE_LIMIT' },
      { status: 402 }
    )
  }

  await restoreWorkspace(ctx.workspace.id)
  return NextResponse.json({ ok: true })
}
