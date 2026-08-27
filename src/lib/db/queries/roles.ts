import { db, type DB } from '../index'
import { parsePermissions } from '@/lib/permissions/can'
import { SYSTEM_ROLE_SEED } from '@/lib/permissions/system-roles'
import { parseScope, type PermissionGrid, type Scope } from '@/lib/permissions/catalogue'

export interface WorkspaceRole {
  id: string
  workspace_id: string
  key: string
  name: string
  description: string | null
  permissions: string // raw JSON
  scope: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** A role row with its grid already parsed - what callers actually want. */
export interface ResolvedRole {
  id: string
  key: string
  name: string
  description: string | null
  permissions: PermissionGrid
  scope: Scope
}

function toResolvedRole(row: WorkspaceRole): ResolvedRole {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    permissions: parsePermissions(row.permissions),
    scope: parseScope(row.scope),
  }
}

export interface MembershipWithRole {
  member_id: string
  workspace_id: string
  user_id: string | null
  email: string
  status: string
  role_key: string
  role_id: string | null
  role_name: string | null
  role_description: string | null
  role_permissions: string | null
  role_scope: string | null
}

/**
 * The hot path: one query returning the caller's membership AND their role
 * definition. requireWsAccess() runs this on every request, so it must stay a
 * single round trip - today's requireWsAdmin already fetches the membership
 * row, and this adds a join to it rather than a second query.
 *
 * LEFT JOIN, not INNER: a membership whose role key has no matching row (a
 * deleted custom role, or a database seeded before this migration) must still
 * resolve, with no permissions, rather than vanishing and reading as
 * "not a member".
 */
export async function getMembershipWithRole(
  workspaceId: string,
  userId: string,
): Promise<MembershipWithRole | null> {
  return db.queryOne<MembershipWithRole>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.status,
            wm.role as role_key,
            wr.id as role_id, wr.name as role_name, wr.description as role_description,
            wr.permissions as role_permissions, wr.scope as role_scope
     FROM workspace_members wm
     LEFT JOIN workspace_roles wr
       ON wr.workspace_id = wm.workspace_id
      AND wr.key = wm.role
      AND wr.deleted_at IS NULL
     WHERE wm.workspace_id = ? AND wm.user_id = ?`,
    [workspaceId, userId],
  )
}

/** Turn the joined row into a role, falling back to no access when unmatched. */
export function roleFromMembership(row: MembershipWithRole): ResolvedRole {
  return {
    id: row.role_id ?? '',
    key: row.role_key,
    name: row.role_name ?? row.role_key,
    description: row.role_description,
    permissions: parsePermissions(row.role_permissions),
    scope: parseScope(row.role_scope),
  }
}

export async function listWorkspaceRoles(workspaceId: string): Promise<ResolvedRole[]> {
  const rows = await db.query<WorkspaceRole>(
    `SELECT * FROM workspace_roles
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId],
  )
  return rows.map(toResolvedRole)
}

export async function getRoleByKey(
  workspaceId: string,
  key: string,
): Promise<ResolvedRole | null> {
  const row = await db.queryOne<WorkspaceRole>(
    `SELECT * FROM workspace_roles
     WHERE workspace_id = ? AND key = ? AND deleted_at IS NULL`,
    [workspaceId, key],
  )
  return row ? toResolvedRole(row) : null
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Give a workspace the three system roles.
 *
 * Every permission lookup LEFT JOINs workspace_members.role to this table, so a
 * workspace with no rows here resolves ALL of its members - its creator
 * included - to an empty grid, which denies everything and hides the workspace
 * from the picker. Seeding is therefore part of creating a workspace, not an
 * optional extra: call this from inside the same transaction that inserts the
 * workspace row.
 *
 * INSERT OR IGNORE against the partial unique index on (workspace_id, key)
 * WHERE deleted_at IS NULL makes it idempotent, so it is also safe to run over
 * an existing workspace to repair it.
 *
 * Pass `tx` when running inside db.transaction(); defaults to the pooled db.
 */
export async function seedSystemRoles(workspaceId: string, tx: DB = db): Promise<void> {
  for (const role of SYSTEM_ROLE_SEED) {
    await tx.execute(
      `INSERT OR IGNORE INTO workspace_roles
         (id, workspace_id, key, name, description, permissions, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID().replace(/-/g, ''),
        workspaceId,
        role.key,
        role.name,
        role.description,
        JSON.stringify(role.permissions),
        role.scope,
      ],
    )
  }
}

/**
 * Create a custom role. Returns null when the key is already taken, which the
 * partial unique index on (workspace_id, key) WHERE deleted_at IS NULL decides
 * - the only race-free place to decide it.
 */
export async function createWorkspaceRole(params: {
  workspaceId: string
  key: string
  name: string
  description?: string | null
  permissions: PermissionGrid
  scope: Scope
}): Promise<ResolvedRole | null> {
  const id = crypto.randomUUID().replace(/-/g, '')
  try {
    await db.execute(
      `INSERT INTO workspace_roles (id, workspace_id, key, name, description, permissions, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.workspaceId,
        params.key,
        params.name,
        params.description ?? null,
        JSON.stringify(params.permissions),
        params.scope,
      ],
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE') || msg.includes('constraint')) return null
    throw err
  }
  const row = await db.queryOne<WorkspaceRole>('SELECT * FROM workspace_roles WHERE id = ?', [id])
  return row ? toResolvedRole(row) : null
}

export async function updateWorkspaceRole(params: {
  roleId: string
  workspaceId: string
  name: string
  description?: string | null
  permissions: PermissionGrid
  scope: Scope
}): Promise<void> {
  await db.execute(
    `UPDATE workspace_roles
        SET name = ?, description = ?, permissions = ?, scope = ?, updated_at = datetime('now')
      WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [
      params.name,
      params.description ?? null,
      JSON.stringify(params.permissions),
      params.scope,
      params.roleId,
      params.workspaceId,
    ],
  )
}

export async function getRoleById(
  roleId: string,
  workspaceId: string,
): Promise<ResolvedRole | null> {
  const row = await db.queryOne<WorkspaceRole>(
    'SELECT * FROM workspace_roles WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [roleId, workspaceId],
  )
  return row ? toResolvedRole(row) : null
}

/**
 * Soft-delete a role and move everyone holding it back to `member`.
 *
 * Both statements run in one transaction: a deleted role with members still
 * pointing at it resolves to no permissions, which is safe, but it would show
 * them a role name that no longer exists.
 */
export async function deleteWorkspaceRole(params: {
  roleId: string
  workspaceId: string
  roleKey: string
}): Promise<number> {
  const holders = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = ? AND role = ?`,
    [params.workspaceId, params.roleKey],
  )

  await db.transaction(async (tx) => {
    await tx.execute(
      `UPDATE workspace_roles SET deleted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND workspace_id = ?`,
      [params.roleId, params.workspaceId],
    )
    await tx.execute(
      `UPDATE workspace_members SET role = 'member' WHERE workspace_id = ? AND role = ?`,
      [params.workspaceId, params.roleKey],
    )
  })

  return holders?.count ?? 0
}

/**
 * The DISPLAY NAME of the user's role in each of their workspaces, keyed by
 * workspace id. Used by /me/orgs, which would otherwise print the raw key -
 * capitalising `hr-manager` gives "Hr-manager".
 *
 * Falls back to the key when no role row matches, which keeps a membership
 * pointing at a deleted role rendering something rather than nothing.
 */
export async function getRoleNamesForUser(userId: string): Promise<Record<string, string>> {
  const rows = await db.query<{ workspace_id: string; role_key: string; role_name: string | null }>(
    `SELECT wm.workspace_id, wm.role as role_key, wr.name as role_name
     FROM workspace_members wm
     LEFT JOIN workspace_roles wr
       ON wr.workspace_id = wm.workspace_id
      AND wr.key = wm.role
      AND wr.deleted_at IS NULL
     WHERE wm.user_id = ? AND wm.status = 'active'`,
    [userId],
  )
  return Object.fromEntries(rows.map((r) => [r.workspace_id, r.role_name ?? r.role_key]))
}

/** How many active members hold each role key - drives the roles list UI. */
export async function getRoleMemberCounts(
  workspaceId: string,
): Promise<Record<string, number>> {
  const rows = await db.query<{ role: string; count: number }>(
    `SELECT role, COUNT(*) as count FROM workspace_members
     WHERE workspace_id = ? AND status = 'active'
     GROUP BY role`,
    [workspaceId],
  )
  return Object.fromEntries(rows.map((r) => [r.role, r.count]))
}

/**
 * The user's resolved role in each of their active workspaces, keyed by
 * workspace id.
 *
 * Returns the parsed grid as well as the name, so callers can ask what the role
 * may do rather than only what it is called - /me uses it to decide whether to
 * offer a link into the org dashboard.
 */
export async function getRolesForUserWorkspaces(
  userId: string,
): Promise<Record<string, { key: string; name: string; permissions: PermissionGrid }>> {
  const rows = await db.query<{
    workspace_id: string
    role_key: string
    role_name: string | null
    role_permissions: string | null
  }>(
    `SELECT wm.workspace_id, wm.role as role_key,
            wr.name as role_name, wr.permissions as role_permissions
     FROM workspace_members wm
     LEFT JOIN workspace_roles wr
       ON wr.workspace_id = wm.workspace_id
      AND wr.key = wm.role
      AND wr.deleted_at IS NULL
     WHERE wm.user_id = ? AND wm.status = 'active'`,
    [userId],
  )

  return Object.fromEntries(
    rows.map((r) => [
      r.workspace_id,
      {
        key: r.role_key,
        name: r.role_name ?? r.role_key,
        permissions: parsePermissions(r.role_permissions),
      },
    ]),
  )
}
