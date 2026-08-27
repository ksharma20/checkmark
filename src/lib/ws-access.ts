import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug, getActiveMemberIds } from './db/queries/workspaces'
import { getMembershipWithRole, roleFromMembership, type ResolvedRole } from './db/queries/roles'
import { can } from './permissions/can'
import type { Action, Resource } from './permissions/catalogue'
// Resource / Action are enums, not loose strings: every call site names a
// catalogue entry the compiler has checked. See lib/permissions/catalogue.ts.
import type { Workspace } from './db/queries/workspaces'

export interface AccessContext {
  workspace: Workspace
  userId: string
  memberId: string
  role: ResolvedRole
  /**
   * Which members this viewer may see. Today this is every active member for
   * every role - scope is not enforced until phase 3 adds the reporting tree.
   * It is threaded through now so that routes written from here on already
   * pass it, and phase 3 becomes a change to the resolver rather than a change
   * to every route.
   */
  visibleMemberIds: string[]
}

/**
 * The single door to every workspace-admin route.
 *
 * Replaces requireWsAdmin's binary "is this person an admin?" with
 * "may this role perform this action on this resource?".
 *
 * Returns null on any failure - the caller turns that into a 403, exactly as
 * it did before. The returned object is a SUPERSET of the old AdminContext,
 * so existing `ctx.workspace` / `ctx.userId` destructuring keeps working.
 */
export async function requireWsAccess(
  request: NextRequest,
  slug: string,
  resource: Resource,
  action: Action,
): Promise<AccessContext | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) return null

  const membership = await getMembershipWithRole(workspace.id, userId)
  if (!membership || membership.status !== 'active') return null

  const role = roleFromMembership(membership)
  if (!can(role.permissions, resource, action)) return null

  return {
    workspace,
    userId,
    memberId: membership.member_id,
    role,
    visibleMemberIds: await getActiveMemberIds(workspace.id),
  }
}

/**
 * Resolve the caller's role without asserting a permission.
 *
 * For pages and routes that need to know WHO is asking in order to decide what
 * to render - the workspace layout, the People page - rather than to gate a
 * single action. Membership must still be active.
 */
export async function getWsRole(
  workspaceId: string,
  userId: string,
): Promise<ResolvedRole | null> {
  const membership = await getMembershipWithRole(workspaceId, userId)
  if (!membership || membership.status !== 'active') return null
  return roleFromMembership(membership)
}

/** The standard refusal, so every route returns an identical shape. */
export function forbidden() {
  return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
}
