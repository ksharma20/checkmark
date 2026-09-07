import { db } from '../index'
import { can, hasAnyOrgAccess, parsePermissions } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { listWorkspaceRoles, seedSystemRoles } from './roles'

export interface Workspace {
  id: string
  slug: string
  name: string
  plan: string
  display_timezone: string
  domain_verified: number
  verification_token: string | null
  verification_token_expires_at: string | null
  archived_at: string | null
  allow_remote: number
  leaves_enabled: number
  working_days: string   // JSON array e.g. '[1,2,3,4,5]'
  leave_cutover_date: string | null
  /** 'HH:MM' in display_timezone, or null when the reminder is off. */
  checkin_reminder_at: string | null
  checkout_reminder_at: string | null
  /**
   * JSON array of notification category keys this workspace has switched OFF,
   * e.g. '["reminders"]'. Stores the disabled set rather than the enabled one so
   * '[]' - the default - means everything is on, and a category added to the
   * catalogue later needs no backfill. Parse with `parseCategoriesOff()`.
   */
  notification_categories_off: string
  /**
   * When this workspace's logo last changed, or null when it has none.
   *
   * Joined in rather than stored on the row: the bytes live in
   * `workspace_logos` and must not be dragged into every workspace read. The
   * timestamp answers "is there a logo" and doubles as the cache-buster on the
   * image URL, so a replaced logo changes its src and no stale copy survives.
   */
  logo_updated_at?: string | null
  created_at: string
  updated_at: string
}

export interface WorkspaceDomain {
  id: string
  workspace_id: string
  domain: string
  verified_at: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string | null
  email: string
  role: string
  status: string
  consent_token: string | null
  consent_token_expires_at: string | null
  added_at: string
}

export interface AdminOverride {
  id: string
  workspace_id: string
  presence_event_id: string
  admin_user_id: string
  note: string | null
  effective_checkout_at: string | null
  created_at: string
}

// ─── Workspace CRUD ───────────────────────────────────────────────────────────

/**
 * Create a workspace and everything required to make it usable.
 *
 * The roles are seeded here, in the SAME transaction as the workspace row,
 * because they are not decoration: permissions are resolved by joining
 * workspace_members.role to workspace_roles, so a workspace without those rows
 * grants its own creator nothing - they cannot open it, manage it, or even see
 * it in the picker. A half-created workspace like that is unrecoverable through
 * the UI, so it must never be able to exist.
 *
 * The creator is the OWNER, not an admin. Only the owner may transfer
 * ownership, archive the workspace, or manage billing; a workspace whose
 * creator is merely an admin has nobody who can do any of those things.
 */
export async function createWorkspace(params: {
  slug: string
  name: string
  creatorUserId: string
  creatorEmail: string
  domains?: string[]
}): Promise<Workspace> {
  const id = crypto.randomUUID().replace(/-/g, '')

  return db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)`,
      [id, params.slug, params.name]
    )

    // Must precede the member insert: the role below has to resolve to a row.
    await seedSystemRoles(id, tx)

    // Add creator as owner
    const memberId = crypto.randomUUID().replace(/-/g, '')
    await tx.execute(
      `INSERT INTO workspace_members (id, workspace_id, user_id, email, role, status)
       VALUES (?, ?, ?, ?, 'owner', 'active')`,
      [memberId, id, params.creatorUserId, params.creatorEmail]
    )

    // Add domains if provided
    if (params.domains) {
      for (const domain of params.domains) {
        const domainId = crypto.randomUUID().replace(/-/g, '')
        await tx.execute(
          `INSERT INTO workspace_domains (id, workspace_id, domain) VALUES (?, ?, ?)`,
          [domainId, id, domain.toLowerCase()]
        )
      }
    }

    return tx.queryOne<Workspace>('SELECT * FROM workspaces WHERE id = ?', [id]) as Promise<Workspace>
  })
}

/**
 * `w.*` plus the logo timestamp. Every workspace read goes through one of these
 * three, so joining here is what makes the mark available on every surface that
 * names a workspace without each of them having to remember to ask.
 */
const WORKSPACE_SELECT = `SELECT w.*, wl.updated_at AS logo_updated_at
   FROM workspaces w
   LEFT JOIN workspace_logos wl ON wl.workspace_id = w.id`

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return db.queryOne<Workspace>(`${WORKSPACE_SELECT} WHERE w.slug = ?`, [slug])
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  return db.queryOne<Workspace>(`${WORKSPACE_SELECT} WHERE w.id = ?`, [id])
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'display_timezone' | 'allow_remote' | 'leaves_enabled' | 'working_days' | 'leave_cutover_date' | 'checkin_reminder_at' | 'checkout_reminder_at' | 'notification_categories_off'>>
): Promise<void> {
  const fields = Object.keys(updates).map((k) => `${k} = ?`)
  const values = Object.values(updates)
  if (fields.length === 0) return
  await db.execute(
    `UPDATE workspaces SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    [...values, workspaceId]
  )
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export async function getWorkspaceDomains(workspaceId: string): Promise<WorkspaceDomain[]> {
  return db.query<WorkspaceDomain>(
    'SELECT * FROM workspace_domains WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId]
  )
}

export async function addWorkspaceDomain(workspaceId: string, domain: string): Promise<WorkspaceDomain> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    'INSERT INTO workspace_domains (id, workspace_id, domain) VALUES (?, ?, ?)',
    [id, workspaceId, domain.toLowerCase()]
  )
  return db.queryOne<WorkspaceDomain>('SELECT * FROM workspace_domains WHERE id = ?', [id]) as Promise<WorkspaceDomain>
}

export async function markDomainVerified(domainId: string, workspaceId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_domains SET verified_at = datetime('now') WHERE id = ? AND workspace_id = ?`,
    [domainId, workspaceId]
  )
}

/**
 * Find active users whose email matches a domain and are NOT already
 * active members of the given workspace. Used for auto-enrolment on domain verify.
 */
export async function getUsersMatchingDomainNotInWorkspace(
  workspaceId: string,
  domain: string
): Promise<{ id: string; email: string }[]> {
  return db.query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM users u
     WHERE u.email LIKE ? AND u.email_verified = 1 AND u.deleted_at IS NULL
     AND u.id NOT IN (
       SELECT user_id FROM workspace_members
       WHERE workspace_id = ? AND user_id IS NOT NULL AND status = 'active'
     )`,
    [`%@${domain}`, workspaceId]
  )
}

export async function getVerifiedDomainsForEmail(email: string): Promise<string[]> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return []

  const rows = await db.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_domains
     WHERE domain = ? AND verified_at IS NOT NULL`,
    [domain]
  )
  return rows.map((r) => r.workspace_id)
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY added_at ASC',
    [workspaceId]
  )
}

/**
 * Members whose ROLE GRANTS a permission - the people who can actually act.
 *
 * This replaces a role-name check (`wm.role IN ('owner','admin')`) that was
 * structurally out of step with the rest of the system: the routes that action
 * an approval gate on `requireWsAccess(..., Resource.Approvals, Action.Write)`,
 * a CAPABILITY check. So a custom role holding `approvals:write` could action a
 * request it was never told existed - the notification went to owners and
 * admins by name, and to nobody else, however the grid actually read.
 *
 * Resolved in JS rather than SQL because the grid is a JSON column; the role
 * list per workspace is a handful of rows, so this is two small queries and a
 * filter, not a join over JSON.
 */
export async function getMembersWhoCan(
  workspaceId: string,
  resource: Resource,
  action: Action,
  excludeUserId?: string,
): Promise<{ user_id: string }[]> {
  const [members, roles] = await Promise.all([
    db.query<{ user_id: string; role: string }>(
      `SELECT wm.user_id, wm.role FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ? AND wm.status = 'active'
         AND wm.user_id IS NOT NULL
         AND u.deleted_at IS NULL AND u.deactivated_at IS NULL
       ${excludeUserId ? 'AND wm.user_id != ?' : ''}`,
      excludeUserId ? [workspaceId, excludeUserId] : [workspaceId],
    ),
    listWorkspaceRoles(workspaceId),
  ])

  const grantedRoleKeys = new Set(
    roles.filter((r) => can(r.permissions, resource, action)).map((r) => r.key),
  )
  return members
    .filter((m) => grantedRoleKeys.has(m.role))
    .map((m) => ({ user_id: m.user_id }))
}

/**
 * Who to tell about a new pending approval.
 *
 * Kept as a named wrapper because that is what the call sites mean, but it is
 * no longer "holders of a built-in role" - it is holders of `approvals:write`.
 */
export async function getActiveWorkspaceAdmins(workspaceId: string, excludeUserId?: string): Promise<{ user_id: string }[]> {
  return getMembersWhoCan(workspaceId, Resource.Approvals, Action.Write, excludeUserId)
}

export async function getActiveMemberIds(workspaceId: string): Promise<string[]> {
  const rows = await db.query<{ user_id: string }>(
    `SELECT user_id FROM workspace_members
     WHERE workspace_id = ? AND status = 'active' AND user_id IS NOT NULL`,
    [workspaceId]
  )
  return rows.map((r) => r.user_id)
}

export async function getWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [workspaceId, userId]
  )
}

export async function getWorkspaceMemberByRecordId(
  memberId: string,
  workspaceId: string
): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE id = ? AND workspace_id = ?',
    [memberId, workspaceId]
  )
}

/**
 * One membership row by its primary key, unscoped.
 *
 * Unscoped because the id IS the scope: it names exactly one workspace. Callers
 * that hold a session rather than a workspace - the consent endpoints - use it
 * to find out WHICH workspace they are being asked to act on, and must still
 * check the row belongs to the caller before acting.
 */
export async function getWorkspaceMemberById(memberId: string): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE id = ?`,
    [memberId]
  )
}

export async function getWorkspaceMemberByEmail(
  workspaceId: string,
  email: string
): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? AND email = ?',
    [workspaceId, email]
  )
}

export async function addWorkspaceMember(params: {
  workspaceId: string
  userId?: string | null
  email: string
  role?: string
  status?: string
  consentToken?: string | null
  consentTokenExpiresAt?: string | null
}): Promise<WorkspaceMember> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_members
       (id, workspace_id, user_id, email, role, status, consent_token, consent_token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.workspaceId,
      params.userId ?? null,
      params.email,
      params.role ?? 'member',
      params.status ?? 'active',
      params.consentToken ?? null,
      params.consentTokenExpiresAt ?? null,
    ]
  )
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE id = ?',
    [id]
  ) as Promise<WorkspaceMember>
}

export async function updateWorkspaceMember(
  memberId: string,
  workspaceId: string,
  updates: Partial<Pick<WorkspaceMember, 'role' | 'status' | 'user_id'>>
): Promise<void> {
  const fields = Object.keys(updates).map((k) => `${k} = ?`)
  const values = Object.values(updates)
  if (fields.length === 0) return
  await db.execute(
    `UPDATE workspace_members SET ${fields.join(', ')} WHERE id = ? AND workspace_id = ?`,
    [...values, memberId, workspaceId]
  )
}

export async function removeWorkspaceMember(memberId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?',
    [memberId, workspaceId]
  )
}

export async function linkMemberToUser(email: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET user_id = ?, status = 'active'
     WHERE email = ? AND status = 'pending_consent'`,
    [userId, email]
  )
}

/**
 * Workspaces where this user can reach the ORG SURFACE at /ws/:slug.
 *
 * Membership alone is not enough and holding a built-in role is not the test:
 * a custom role qualifies as soon as its grid grants read on anything. Filtering
 * on `role IN ('owner','admin')` here silently excluded every custom role from
 * the post-login redirect AND the /ws picker, leaving those users with no route
 * into the dashboard at all.
 *
 * The grid lives in a JSON column, so the qualifying test runs in JS rather
 * than SQL - hasAnyOrgAccess is the same function the workspace layout uses, so
 * the picker and the layout can never disagree about who belongs there.
 */
async function workspacesWithOrgAccess(
  userId: string,
  archived: boolean,
): Promise<Workspace[]> {
  const rows = await db.query<Workspace & { role_permissions: string | null }>(
    `SELECT w.*, wl.updated_at AS logo_updated_at, wr.permissions as role_permissions
     FROM workspaces w
     LEFT JOIN workspace_logos wl ON wl.workspace_id = w.id
     JOIN workspace_members wm ON wm.workspace_id = w.id
     LEFT JOIN workspace_roles wr
       ON wr.workspace_id = w.id AND wr.key = wm.role AND wr.deleted_at IS NULL
     WHERE wm.user_id = ? AND wm.status = 'active'
       AND w.archived_at IS ${archived ? 'NOT NULL' : 'NULL'}
     ORDER BY ${archived ? 'w.archived_at DESC' : 'w.created_at ASC'}`,
    [userId]
  )

  return rows
    .filter((r) => hasAnyOrgAccess(parsePermissions(r.role_permissions)))
    .map((row) => {
      // Drop the joined column so callers get a clean Workspace.
      const workspace = { ...row } as Partial<typeof row>
      delete workspace.role_permissions
      return workspace as Workspace
    })
}

export async function getAdminWorkspacesForUser(userId: string): Promise<Workspace[]> {
  return workspacesWithOrgAccess(userId, false)
}

/**
 * Returns active (non-archived) workspaces the user OWNS. Used to block
 * account deactivation - deactivating would leave those workspaces with nobody
 * who can transfer, archive, or manage billing. Having other admins does not
 * help: admins deliberately cannot do any of those things.
 *
 * Archived workspaces are excluded - a deactivated account is fine as the
 * owner of an archived workspace since it can't affect any running team.
 */
export async function getSoleAdminWorkspaces(userId: string): Promise<Workspace[]> {
  return db.query<Workspace>(
    `SELECT w.* FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = ? AND wm.role = 'owner' AND wm.status = 'active'
       AND w.archived_at IS NULL`,
    [userId]
  )
}

export async function getArchivedAdminWorkspacesForUser(userId: string): Promise<Workspace[]> {
  return workspacesWithOrgAccess(userId, true)
}

export async function archiveWorkspace(workspaceId: string): Promise<void> {
  await db.execute(
    `UPDATE workspaces SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    [workspaceId]
  )
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  await db.execute(
    `UPDATE workspaces SET archived_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [workspaceId]
  )
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE user_id = ? AND status = 'active' ORDER BY added_at ASC`,
    [userId]
  )
}

export async function getWorkspacesByIds(ids: string[]): Promise<Workspace[]> {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  return db.query<Workspace>(`${WORKSPACE_SELECT} WHERE w.id IN (${placeholders})`, ids)
}

export async function getMembershipsByEmail(email: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE email = ? ORDER BY added_at DESC',
    [email.toLowerCase()]
  )
}

export async function leaveWorkspace(workspaceId: string, userId: string): Promise<boolean> {
  // The owner can NEVER leave - a workspace without an owner has no one who can
  // transfer it, archive it, or manage billing. They must transfer ownership
  // first. Admins may leave freely; the owner is always still there.
  const self = await db.queryOne<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
    [workspaceId, userId]
  )
  if (self?.role === 'owner') return false
  await db.execute(
    `UPDATE workspace_members SET status = 'revoked' WHERE workspace_id = ? AND user_id = ?`,
    [workspaceId, userId]
  )
  return true
}

export async function acceptConsent(memberId: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET status = 'active', user_id = ? WHERE id = ?`,
    [userId, memberId]
  )
}

export async function declineConsent(memberId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET status = 'declined' WHERE id = ?`,
    [memberId]
  )
}

// ─── Overrides ────────────────────────────────────────────────────────────────

export async function createAdminOverride(params: {
  workspaceId: string
  presenceEventId: string
  adminUserId: string
  note?: string | null
}): Promise<AdminOverride> {
  const id = crypto.randomUUID().replace(/-/g, '')
  // INSERT OR IGNORE, and then read back BY EVENT rather than by the id we
  // minted. An office day may already hold an override on this event, and
  // `idx_admin_overrides_event` is UNIQUE on (workspace_id, presence_event_id) -
  // a plain INSERT would throw. That throw would land AFTER
  // actionRegularizationRequest() has already flipped the request to
  // `approved`, leaving it approved with no override and the admin looking at a
  // 500. An existing override already grants exactly what this call wanted, so
  // losing the race is success, not failure.
  //
  // `source` is written explicitly: the column tells an office day apart from a
  // regularization, and undoing an office day filters on it. Leaving it NULL
  // here would make the column trustworthy in one direction only.
  await db.execute(
    `INSERT OR IGNORE INTO admin_overrides (id, workspace_id, presence_event_id, admin_user_id, note, source)
     VALUES (?, ?, ?, ?, ?, 'regularization')`,
    [id, params.workspaceId, params.presenceEventId, params.adminUserId, params.note ?? null]
  )
  return db.queryOne<AdminOverride>(
    'SELECT * FROM admin_overrides WHERE workspace_id = ? AND presence_event_id = ?',
    [params.workspaceId, params.presenceEventId]
  ) as Promise<AdminOverride>
}

export async function getWorkspaceOverrides(workspaceId: string): Promise<AdminOverride[]> {
  return db.query<AdminOverride>(
    'SELECT * FROM admin_overrides WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspaceId]
  )
}

export async function deleteAdminOverride(
  workspaceId: string,
  presenceEventId: string
): Promise<boolean> {
  const existing = await db.queryOne<AdminOverride>(
    'SELECT * FROM admin_overrides WHERE workspace_id = ? AND presence_event_id = ?',
    [workspaceId, presenceEventId]
  )
  if (!existing) return false
  await db.execute(
    'DELETE FROM admin_overrides WHERE workspace_id = ? AND presence_event_id = ?',
    [workspaceId, presenceEventId]
  )
  return true
}

export interface MemberWithUser {
  member_id: string
  workspace_id: string
  user_id: string
  email: string
  role: string
  full_name: string | null
  added_at: string
  employee_record_id: string | null
  designation: string | null
  department: string | null
}

export async function getActiveMembersWithDetails(workspaceId: string): Promise<MemberWithUser[]> {
  return db.query<MemberWithUser>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, u.full_name, wm.added_at,
            e.id as employee_record_id, ed.designation, ed.department
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     LEFT JOIN employees e ON e.workspace_id = wm.workspace_id AND e.user_id = wm.user_id AND e.deleted_at IS NULL
     LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE wm.workspace_id = ? AND wm.status = 'active' AND wm.user_id IS NOT NULL
     ORDER BY u.full_name ASC, wm.email ASC`,
    [workspaceId]
  )
}

export async function getActiveMemberWithDetails(
  workspaceId: string,
  userId: string,
): Promise<MemberWithUser | null> {
  return db.queryOne<MemberWithUser>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, u.full_name, wm.added_at,
            e.id as employee_record_id, ed.designation, ed.department
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     LEFT JOIN employees e ON e.workspace_id = wm.workspace_id AND e.user_id = wm.user_id AND e.deleted_at IS NULL
     LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE wm.workspace_id = ? AND wm.status = 'active' AND wm.user_id = ?
     LIMIT 1`,
    [workspaceId, userId],
  );
}

export async function getOverrideEventIds(workspaceId: string): Promise<Set<string>> {
  const rows = await db.query<{ presence_event_id: string }>(
    'SELECT presence_event_id FROM admin_overrides WHERE workspace_id = ?',
    [workspaceId]
  )
  return new Set(rows.map((r) => r.presence_event_id))
}

// ─── New query functions (Part C) ─────────────────────────────────────────────

export async function getMemberByConsentToken(token: string): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE consent_token = ?`,
    [token]
  )
}

export async function upsertInvitedMember(params: {
  workspaceId: string
  email: string
  consentToken: string
  consentTokenExpiresAt: string
}): Promise<WorkspaceMember> {
  const existing = await db.queryOne<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE workspace_id = ? AND email = ?`,
    [params.workspaceId, params.email.toLowerCase()]
  )

  if (existing && existing.status !== 'active') {
    await db.execute(
      `UPDATE workspace_members
       SET consent_token = ?, consent_token_expires_at = ?
       WHERE id = ?`,
      [params.consentToken, params.consentTokenExpiresAt, existing.id]
    )
    return db.queryOne<WorkspaceMember>(
      'SELECT * FROM workspace_members WHERE id = ?',
      [existing.id]
    ) as Promise<WorkspaceMember>
  }

  if (!existing) {
    const id = crypto.randomUUID().replace(/-/g, '')
    await db.execute(
      `INSERT INTO workspace_members
         (id, workspace_id, user_id, email, role, status, consent_token, consent_token_expires_at)
       VALUES (?, ?, NULL, ?, 'member', 'pending_consent', ?, ?)`,
      [id, params.workspaceId, params.email.toLowerCase(), params.consentToken, params.consentTokenExpiresAt]
    )
    return db.queryOne<WorkspaceMember>(
      'SELECT * FROM workspace_members WHERE id = ?',
      [id]
    ) as Promise<WorkspaceMember>
  }

  return existing
}

export interface MemberWithUserFull {
  member_id: string
  workspace_id: string
  user_id: string | null
  email: string
  role: string
  status: string
  full_name: string | null
  added_at: string
  employee_record_id: string | null
  employee_id: string | null
  designation: string | null
  department: string | null
  work_mode: string | null
  date_of_joining: string | null
  probation_end_date: string | null
  employee_status: string | null
  manager_user_id: string | null
}

/**
 * Membership joined to its HR record.
 *
 * The email fallback is load-bearing, not defensive. An INVITED person has
 * `wm.user_id IS NULL`, and the employee record created for them by the add
 * flow has `e.user_id IS NULL` too - and `NULL = NULL` is not true in SQL, so
 * the id join alone silently drops their HR data until they accept. Matching on
 * work email covers exactly that window. `idx_employees_ws_work_email` is
 * UNIQUE per workspace where `deleted_at IS NULL`, so the fallback can never
 * fan one member out into two rows.
 */
const MEMBER_EMPLOYEE_JOIN = `
  LEFT JOIN employees e
    ON e.workspace_id = wm.workspace_id
   AND e.deleted_at IS NULL
   AND (e.user_id = wm.user_id
        OR (wm.user_id IS NULL AND lower(e.work_email) = lower(wm.email)))
  LEFT JOIN employment_details ed ON ed.employee_id = e.id`

const MEMBER_EMPLOYEE_COLS = `, e.id as employee_record_id, e.employee_id, e.employee_status, wm.manager_user_id, ed.designation, ed.department, ed.work_mode, ed.date_of_joining, ed.probation_end_date`

const FULL_NAME_EXPR = `COALESCE(NULLIF(TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')), ''), u.full_name)`

/**
 * One membership row by its own id, with the display name resolved.
 *
 * Keyed on `workspace_members.id` rather than a user id so it can address an
 * INVITED person, who has no user row yet. That is the whole reason the person
 * details page moved off a userId route.
 */
export async function getMemberWithUserByRecordId(
  memberId: string,
  workspaceId: string,
): Promise<MemberWithUserFull | null> {
  return db.queryOne<MemberWithUserFull>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, wm.status, wm.added_at, ${FULL_NAME_EXPR} as full_name${MEMBER_EMPLOYEE_COLS}
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     ${MEMBER_EMPLOYEE_JOIN}
     WHERE wm.id = ? AND wm.workspace_id = ?`,
    [memberId, workspaceId],
  )
}

/**
 * A membership row by email, with the display name resolved.
 *
 * The way back from an employee record to a membership when the record has no
 * `user_id` yet. Work email is the join key that survives that window - the
 * same one the directory falls back to.
 */
export async function getMemberByEmailWithUser(
  workspaceId: string,
  email: string,
): Promise<MemberWithUserFull | null> {
  return db.queryOne<MemberWithUserFull>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, wm.status, wm.added_at, ${FULL_NAME_EXPR} as full_name${MEMBER_EMPLOYEE_COLS}
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     ${MEMBER_EMPLOYEE_JOIN}
     WHERE wm.workspace_id = ? AND lower(wm.email) = lower(?)`,
    [workspaceId, email],
  )
}

export async function getAllMembersWithDetails(workspaceId: string): Promise<MemberWithUserFull[]> {
  return db.query<MemberWithUserFull>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, wm.status, wm.added_at, ${FULL_NAME_EXPR} as full_name${MEMBER_EMPLOYEE_COLS}
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     ${MEMBER_EMPLOYEE_JOIN}
     WHERE wm.workspace_id = ?
     ORDER BY wm.added_at DESC`,
    [workspaceId]
  )
}

/**
 * The one status control on the People screen, over two columns.
 *
 * Membership status and employment status are different facts - somebody can be
 * an active member with no HR record at all - but a reader filtering a directory
 * does not care which table the answer lives in. `invited` and `declined` read
 * `workspace_members.status`; everything else reads `employees.employee_status`
 * and additionally requires an active membership, so a terminated employee who
 * was also removed does not surface under "Terminated".
 */
/**
 * A person who has an HR record but has never been invited and cannot sign in.
 *
 * Written by `POST /api/ws/[slug]/employees`, which creates a membership row
 * alongside every employee record. Without one the record is invisible in the
 * directory (which reads `FROM workspace_members`) and unreachable on the person
 * page (which is keyed on `workspace_members.id`).
 *
 * Deliberately NOT `pending_consent`: that claims an invitation was sent, and
 * the consent token columns would be null to prove otherwise. A status that lies
 * is what the People/Employees merge existed to stop.
 */
export const MEMBER_STATUS_NO_ACCESS = 'no_access'

export type DirectoryStatusFilter =
  | 'invited'
  | 'declined'
  | 'no_access'
  | 'active'
  | 'terminated'
  | 'suspended'
  | 'on_leave'
  | 'notice_period'

const MEMBERSHIP_STATUS_FILTERS: Record<string, string> = {
  invited: 'pending_consent',
  declined: 'declined',
  // Reads `workspace_members.status` like the two above, not an employment
  // state - "never invited" is a fact about access, not about the job.
  no_access: MEMBER_STATUS_NO_ACCESS,
}

const DIRECTORY_STATUS_VALUES: readonly string[] = [
  'invited', 'declined', 'no_access', 'active', 'terminated', 'suspended', 'on_leave', 'notice_period',
]

/**
 * Coerce a query-string value. An unrecognised filter is DROPPED rather than
 * 400'd - a stale bookmark should show the unfiltered directory, not an error
 * page. Same call the assets route makes for its status param.
 */
export function parseDirectoryStatus(raw: string | null): DirectoryStatusFilter | undefined {
  return raw && DIRECTORY_STATUS_VALUES.includes(raw)
    ? (raw as DirectoryStatusFilter)
    : undefined
}

/** Neutralise the wildcards so a search for `100%` cannot match everything. */
function likeTerm(value: string): string {
  return `%${value.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

export async function getAllMembersWithDetailsPaged(params: {
  workspaceId: string;
  limit: number;
  offset: number;
  search?: string;
  department?: string;
  status?: DirectoryStatusFilter;
}): Promise<{ members: MemberWithUserFull[]; total: number }> {
  const conditions: string[] = ['wm.workspace_id = ?']
  const args: unknown[] = [params.workspaceId]

  const q = (params.search ?? '').trim()
  if (q) {
    const term = likeTerm(q)
    conditions.push(
      `(lower(wm.email) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(${FULL_NAME_EXPR},'')) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(ed.designation,'')) LIKE ? ESCAPE '\\')`,
    )
    args.push(term, term, term)
  }

  // Reads a column only an HR record carries, so switching it on necessarily
  // hides everyone without one. That is the honest behaviour - the alternative
  // is claiming somebody is in "Engineering" on the strength of no data at all.
  if (params.department) {
    conditions.push('ed.department = ?')
    args.push(params.department)
  }

  if (params.status) {
    const membershipStatus = MEMBERSHIP_STATUS_FILTERS[params.status]
    if (membershipStatus) {
      conditions.push('wm.status = ?')
      args.push(membershipStatus)
    } else if (params.status === 'active') {
      // `active` has to match exactly the rows the table LABELS Active, and the
      // table's fallback for a member with no HR record is Active - a member
      // nobody has filled in is not "unknown", they are just a member. Treating
      // a missing record as non-active here would return an empty list on a
      // workspace that has not started using HR at all, while every row on
      // screen said Active. A filter that disagrees with its own column is
      // worse than no filter.
      conditions.push(`wm.status = 'active' AND (e.employee_status IS NULL OR e.employee_status = 'active')`)
    } else {
      // The other employment states are stored, never derived, so they can only
      // exist where there is a record to store them on.
      conditions.push(`wm.status = 'active' AND e.employee_status = ?`)
      args.push(params.status)
    }
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const totalRow = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     ${MEMBER_EMPLOYEE_JOIN}
     ${where}`,
    args,
  );
  const total = totalRow?.total ?? 0;
  const members = await db.query<MemberWithUserFull>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, wm.status, wm.added_at, ${FULL_NAME_EXPR} as full_name${MEMBER_EMPLOYEE_COLS}
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     ${MEMBER_EMPLOYEE_JOIN}
     ${where}
     ORDER BY wm.added_at DESC
     LIMIT ? OFFSET ?`,
    [...args, params.limit, params.offset],
  );
  return { members, total };
}

/**
 * Every department in the workspace, for the directory filter.
 *
 * A separate query on purpose: deriving the list from the loaded page means a
 * department that only exists on page two never appears in the dropdown, which
 * is the bug the Employees screen shipped with.
 */
export async function getWorkspaceDepartments(workspaceId: string): Promise<string[]> {
  const rows = await db.query<{ department: string }>(
    `SELECT DISTINCT ed.department
     FROM employment_details ed
     JOIN employees e ON e.id = ed.employee_id AND e.deleted_at IS NULL
     WHERE ed.workspace_id = ?
       AND ed.department IS NOT NULL AND TRIM(ed.department) != ''
     ORDER BY lower(ed.department) ASC`,
    [workspaceId],
  )
  return rows.map((r) => r.department)
}

/**
 * Returns true if the domain has been verified by any workspace other than excludeWorkspaceId.
 * Prevents the same domain being claimed by two organisations.
 */
export async function isDomainVerifiedElsewhere(domain: string, excludeWorkspaceId: string): Promise<boolean> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_domains
     WHERE domain = ? AND verified_at IS NOT NULL AND workspace_id != ?`,
    [domain.toLowerCase(), excludeWorkspaceId]
  )
  return (row?.count ?? 0) > 0
}

export async function removeWorkspaceDomain(domainId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_domains WHERE id = ? AND workspace_id = ?',
    [domainId, workspaceId]
  )
}

export async function linkUserToMemberRecord(email: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET user_id = ?
     WHERE email = ? AND status = 'pending_consent' AND user_id IS NULL`,
    [userId, email.toLowerCase()]
  )
}

// ─── Signal config ─────────────────────────────────────────────────────────────

export interface WorkspaceSignalConfig {
  id: string
  workspace_id: string
  signal_type: string
  location_name: string | null
  wifi_ssid_hash: string | null
  wifi_ssid_display: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number | null
  ip_geo_lat: number | null
  ip_geo_lng: number | null
  ip_proximity_m: number | null
  is_active: number
  created_at: string
}

export async function getSignalConfigs(workspaceId: string): Promise<WorkspaceSignalConfig[]> {
  return db.query<WorkspaceSignalConfig>(
    'SELECT * FROM workspace_signal_config WHERE workspace_id = ? AND is_active = 1 ORDER BY created_at ASC',
    [workspaceId]
  )
}

export async function addSignalConfig(params: {
  workspaceId: string
  signalType: string
  locationName?: string
  wifiSsidHash?: string
  wifiSsidDisplay?: string
  gpsLat?: number
  gpsLng?: number
  gpsRadiusM?: number
  ipGeoLat?: number
  ipGeoLng?: number
  ipProximityM?: number
}): Promise<WorkspaceSignalConfig> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_signal_config
       (id, workspace_id, signal_type, location_name, wifi_ssid_hash, wifi_ssid_display,
        gps_lat, gps_lng, gps_radius_m, ip_geo_lat, ip_geo_lng, ip_proximity_m)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.workspaceId,
      params.signalType,
      params.locationName ?? null,
      params.wifiSsidHash ?? null,
      params.wifiSsidDisplay ?? null,
      params.gpsLat ?? null,
      params.gpsLng ?? null,
      params.gpsRadiusM ?? 300,
      params.ipGeoLat ?? null,
      params.ipGeoLng ?? null,
      params.ipProximityM ?? 500,
    ]
  )
  return db.queryOne<WorkspaceSignalConfig>(
    'SELECT * FROM workspace_signal_config WHERE id = ?',
    [id]
  ) as Promise<WorkspaceSignalConfig>
}

export async function deleteSignalConfig(signalId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_signal_config WHERE id = ? AND workspace_id = ?',
    [signalId, workspaceId]
  )
}

export interface GpsSignalForUser {
  gps_lat: number
  gps_lng: number
  gps_radius_m: number
}

export async function getGpsSignalsForUser(userId: string): Promise<GpsSignalForUser[]> {
  return db.query<GpsSignalForUser>(
    `SELECT wsc.gps_lat, wsc.gps_lng, COALESCE(wsc.gps_radius_m, 300) as gps_radius_m
     FROM workspace_signal_config wsc
     INNER JOIN workspace_members wm ON wm.workspace_id = wsc.workspace_id
     WHERE wm.user_id = ?
       AND wm.status = 'active'
       AND wsc.signal_type = 'gps'
       AND wsc.is_active = 1
       AND wsc.gps_lat IS NOT NULL`,
    [userId]
  )
}

export async function setEffectiveCheckout(
  overrideId: string,
  workspaceId: string,
  effectiveCheckoutAt: string
): Promise<void> {
  await db.execute(
    `UPDATE admin_overrides SET effective_checkout_at = ? WHERE id = ? AND workspace_id = ?`,
    [effectiveCheckoutAt, overrideId, workspaceId]
  )
}
