import { NextRequest } from 'next/server'
import { getWorkspaceBySlug, getWorkspaceMember } from './db/queries/workspaces'
import type { Workspace } from './db/queries/workspaces'

export interface AdminContext {
  workspace: Workspace
  userId: string
}

export async function requireWsAdmin(
  request: NextRequest,
  slug: string
): Promise<AdminContext | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) return null
  const member = await getWorkspaceMember(workspace.id, userId)
  if (!member || member.role !== 'admin' || member.status !== 'active') return null
  return { workspace, userId }
}
