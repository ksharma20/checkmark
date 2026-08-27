import { SystemRole, isSystemRole } from './catalogue'

/**
 * Role ranking - the SUBJECT axis of permissions.
 *
 * `can()` answers "may this role touch this kind of thing?". Ranking answers
 * "may this person act on THAT person?". Both are needed on the same action:
 * an admin holds `members:delete`, but must still not be able to remove the
 * owner or another admin.
 */

export const ROLE_RANK: Record<SystemRole, number> = {
  [SystemRole.Owner]: 100,
  [SystemRole.Admin]: 50,
  [SystemRole.Member]: 10,
}

/**
 * Custom roles (phase 2) sit above member and below admin. They can therefore
 * never manage an admin or an owner regardless of which permission boxes are
 * ticked, which keeps the escalation ceiling fixed in code rather than in data.
 */
export const CUSTOM_ROLE_RANK = 20

export function rankOf(roleKey: string | null | undefined): number {
  if (!roleKey) return 0
  if (isSystemRole(roleKey)) return ROLE_RANK[roleKey]
  return CUSTOM_ROLE_RANK
}

/**
 * May the actor remove, demote or re-role the target?
 *
 * Equal rank IS allowed, so one admin can manage another - but the OWNER is
 * never manageable by anyone. Ownership changes hands only through the
 * OTP-gated transfer flow, never through the roles dropdown or member removal.
 *
 * Acting on yourself is blocked separately by each route (SELF_ROLE_CHANGE,
 * SELF_REMOVE), because "can I manage this rank" and "is this me" are different
 * questions and conflating them hides one of them.
 */
export function canManage(
  actorRoleKey: string | null | undefined,
  targetRoleKey: string | null | undefined
): boolean {
  if (isWorkspaceOwner(targetRoleKey)) return false
  return rankOf(actorRoleKey) >= rankOf(targetRoleKey)
}

/**
 * May the actor GRANT this role to someone?
 *
 * Checked in addition to canManage(actor, target): the target may be below you
 * while the role you are handing out is not. Owner can never be granted here -
 * that is what the transfer flow is for - so no permission tick on any grid can
 * turn someone into the owner.
 */
export function canGrant(
  actorRoleKey: string | null | undefined,
  grantedRoleKey: string | null | undefined
): boolean {
  if (isWorkspaceOwner(grantedRoleKey)) return false
  return rankOf(actorRoleKey) >= rankOf(grantedRoleKey)
}

/**
 * "Admin or better" - owner and admin both run the workspace.
 *
 * Every place that used to compare `role === 'admin'` must use this instead.
 * Once the owner backfill renames a creator's role to 'owner', a bare
 * equality check against 'admin' silently stops matching them and locks the
 * owner out of their own org surface.
 */
export function isWorkspaceAdmin(roleKey: string | null | undefined): boolean {
  return roleKey === SystemRole.Owner || roleKey === SystemRole.Admin
}

/** Exactly the owner - for destructive and ownership-level actions only. */
export function isWorkspaceOwner(roleKey: string | null | undefined): boolean {
  return roleKey === SystemRole.Owner
}

/**
 * Where a user lands after signing in or registering.
 *
 * Keyed on which workspaces grant ORG-SURFACE ACCESS, not on holding the admin
 * role. A custom role with an entirely empty grid is legal, and that person
 * must land on /me rather than a stripped /ws shell with no navigation.
 *
 * Previously duplicated verbatim in the login and register routes.
 */
export function getRedirectAfterLogin(orgWorkspaces: { slug: string }[]): string {
  if (orgWorkspaces.length === 0) return '/me'
  if (orgWorkspaces.length === 1) return `/ws/${orgWorkspaces[0].slug}`
  return '/ws'
}
