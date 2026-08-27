/**
 * The seeded definitions of the three roles Venzio owns.
 *
 * The grids themselves live in ./system-roles.json - plain JSON, because
 * scripts/migrate.js is CommonJS and cannot import TypeScript. Both the
 * migration and the app read that one file, so a workspace seeded at migration
 * time and a workspace created at runtime can never be given different grids.
 *
 * Do NOT reintroduce a second copy of these grids anywhere. A workspace whose
 * `workspace_roles` rows are missing or wrong locks its own owner out: every
 * permission lookup LEFT JOINs to this table, and no row means no permissions.
 */

import seed from './system-roles.json'
import { normalisePermissions } from './can'
import { parseScope, type PermissionGrid, type Scope } from './catalogue'

export interface SystemRoleSeed {
  key: string
  name: string
  description: string
  scope: Scope
  permissions: PermissionGrid
}

interface RawSeed {
  key: string
  name: string
  description: string
  scope: string
  permissions: Record<string, string[]>
}

/**
 * Grids are passed through normalisePermissions on the way in, so a resource
 * renamed in the catalogue without updating the JSON is dropped here rather
 * than persisted as a permission that can never match.
 */
export const SYSTEM_ROLE_SEED: readonly SystemRoleSeed[] = (seed as RawSeed[]).map((role) => ({
  key: role.key,
  name: role.name,
  description: role.description,
  scope: parseScope(role.scope),
  permissions: normalisePermissions(role.permissions),
}))
