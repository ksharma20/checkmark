import { getResource, gridEntries, isSystemRole, type PermissionGrid } from './catalogue'
import { can, findUnknownGridKeys, normalisePermissions } from './can'

/**
 * The guards protecting the roles grid - the only surface in Venzio where a
 * user writes permissions, and therefore the only place privilege escalation
 * is possible.
 *
 * Every one of these is enforced server-side. The UI mirrors them for a decent
 * experience, but nothing here may rely on the client having done so.
 */

export type GuardFailure =
  | { code: 'INVALID_ACTION'; message: string }
  | { code: 'SYSTEM_ROLE'; message: string }
  | { code: 'ESCALATION'; message: string }

/**
 * System roles are immutable.
 *
 * If an owner could untick `settings:write` on the owner role they would
 * permanently lock every human out of their own workspace, with no recovery
 * short of direct database access.
 */
export function guardSystemRole(roleKey: string): GuardFailure | null {
  if (!isSystemRole(roleKey)) return null
  return {
    code: 'SYSTEM_ROLE',
    message: 'Built-in roles cannot be edited or deleted. Duplicate this role to make your own version.',
  }
}

/**
 * The catalogue is the referee.
 *
 * Rejects a grid naming a resource or action that does not exist, so a
 * hand-crafted request body fails loudly instead of being silently dropped by
 * normalisePermissions.
 */
export function guardCatalogue(rawPermissions: unknown): GuardFailure | null {
  const unknown = findUnknownGridKeys(rawPermissions)
  if (unknown.length === 0) return null
  return {
    code: 'INVALID_ACTION',
    message: `Unknown permission${unknown.length > 1 ? 's' : ''}: ${unknown.slice(0, 5).join(', ')}`,
  }
}

/**
 * You cannot grant a permission you do not hold yourself.
 *
 * Without this, any role holding `roles:write` can grant itself everything and
 * the entire permission model becomes decorative. Compares the SUBMITTED grid
 * against the ACTOR's grid, cell by cell.
 */
export function guardEscalation(
  actorPermissions: PermissionGrid,
  submitted: PermissionGrid,
): GuardFailure | null {
  const overreach: string[] = []

  for (const [resource, actions] of gridEntries(submitted)) {
    for (const action of actions) {
      if (!can(actorPermissions, resource, action)) {
        const label = getResource(resource)?.label ?? resource
        overreach.push(`${label}: ${action}`)
      }
    }
  }

  if (overreach.length === 0) return null
  return {
    code: 'ESCALATION',
    message: `You cannot grant permissions you do not hold yourself — ${overreach.slice(0, 3).join(', ')}`,
  }
}

/**
 * Run every write-path guard in order and return the normalised grid on
 * success. Order matters: validate the shape before comparing it to the
 * actor's, so a malformed body reports the malformation rather than an
 * escalation it never really attempted.
 */
export function validateGridForSave(params: {
  actorPermissions: PermissionGrid
  rawPermissions: unknown
}): { ok: true; permissions: PermissionGrid } | { ok: false; failure: GuardFailure } {
  const catalogueFailure = guardCatalogue(params.rawPermissions)
  if (catalogueFailure) return { ok: false, failure: catalogueFailure }

  // Normalise BEFORE the escalation check: write implies read, and that implied
  // read must itself be something the actor holds.
  const permissions = normalisePermissions(params.rawPermissions)

  const escalation = guardEscalation(params.actorPermissions, permissions)
  if (escalation) return { ok: false, failure: escalation }

  return { ok: true, permissions }
}

/**
 * Derive a role key from its display name.
 *
 * Keys are immutable once created - renaming a role changes `name` only, so
 * `workspace_members.role` never needs rewriting. Collisions (including with
 * the system keys) are caught by the partial unique index, which is the only
 * race-free place to catch them.
 */
export function roleKeyFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}
