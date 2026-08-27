import { NextRequest } from 'next/server'
import { getWorkspaceBySlug, getWorkspaceMember } from './db/queries/workspaces'
import type { Workspace, WorkspaceMember } from './db/queries/workspaces'

/**
 * requireWsAdmin has been removed. Workspace-admin routes are now gated by
 * `requireWsAccess(request, slug, resource, action)` in lib/ws-access.ts, which
 * asks "may this role perform this action?" rather than "is this person an
 * admin?". Adding a binary admin gate back here would bypass the permission
 * model entirely.
 *
 * requireWsMember stays: it authenticates an ordinary workspace member for the
 * /me surface and carries no permission meaning.
 */

export interface MemberContext {
  workspace: Workspace
  member: WorkspaceMember
  userId: string
}

export async function requireWsMember(
  request: NextRequest,
  slug: string
): Promise<MemberContext | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) return null
  const member = await getWorkspaceMember(workspace.id, userId)
  if (!member || member.status !== 'active') return null
  return { workspace, member, userId }
}
