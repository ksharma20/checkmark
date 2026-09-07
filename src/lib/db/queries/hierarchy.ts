import { db } from '../index'
import { SystemRole } from '@/lib/permissions/catalogue'
import {
  buildReportingTree,
  wouldCreateCycle,
  type ReportingPair,
  type ReportingTree,
} from '@/lib/hierarchy'

/**
 * Reporting-hierarchy reads and writes.
 *
 * The tree itself is one nullable column on workspace_members. Everything
 * structural - roll-up, cycle detection, subtree walks - lives in
 * src/lib/hierarchy.ts, which is pure. This file only moves rows.
 */

export interface HierarchyMember {
  user_id: string
  member_id: string
  email: string
  full_name: string | null
  role: string
  manager_user_id: string | null
}

/**
 * Every active member of the workspace with their manager, in one flat query.
 *
 * Deliberately not recursive: the tree is assembled in memory afterwards, so
 * this behaves the same on SQLite and libSQL.
 */
export async function getHierarchyMembers(workspaceId: string): Promise<HierarchyMember[]> {
  return db.query<HierarchyMember>(
    `SELECT wm.user_id, wm.id as member_id, wm.email, wm.role, wm.manager_user_id,
            COALESCE(NULLIF(TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')), ''), u.full_name) as full_name
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
     LEFT JOIN employees e
       ON e.workspace_id = wm.workspace_id AND e.user_id = wm.user_id AND e.deleted_at IS NULL
     WHERE wm.workspace_id = ? AND wm.status = 'active' AND wm.user_id IS NOT NULL
     ORDER BY full_name ASC, wm.email ASC`,
    [workspaceId],
  )
}

/** The workspace owner's user id - the root the unassigned roll up to. */
export async function getOwnerUserId(workspaceId: string): Promise<string | null> {
  const row = await db.queryOne<{ user_id: string }>(
    `SELECT user_id FROM workspace_members
     WHERE workspace_id = ? AND role = ? AND status = 'active' AND user_id IS NOT NULL
     LIMIT 1`,
    [workspaceId, SystemRole.Owner],
  )
  return row?.user_id ?? null
}

/**
 * Load and build the tree in one call - what every scope resolution needs.
 *
 * Two queries, not one: the owner is needed to apply the roll-up, and joining
 * it into the member query would repeat it on every row.
 */
export async function loadReportingTree(workspaceId: string): Promise<{
  tree: ReportingTree
  members: HierarchyMember[]
}> {
  const [members, ownerUserId] = await Promise.all([
    getHierarchyMembers(workspaceId),
    getOwnerUserId(workspaceId),
  ])

  const pairs: ReportingPair[] = members.map((m) => ({
    userId: m.user_id,
    managerUserId: m.manager_user_id,
  }))

  return { tree: buildReportingTree(pairs, ownerUserId), members }
}

export type SetManagerResult =
  | { ok: true }
  | { ok: false; code: 'CYCLE_DETECTED' | 'NOT_A_MEMBER' | 'SELF_MANAGER' }

/**
 * Point a member at a manager, or clear it with null.
 *
 * The cycle check runs against the CURRENT tree before writing, because SQLite
 * cannot express "no cycles" as a constraint. Read-then-write is not atomic, so
 * two simultaneous re-parents could in principle still close a loop - the depth
 * cap and visited-set in the walkers mean that degrades to a truncated tree
 * rather than a hung request.
 */
export async function setManager(params: {
  workspaceId: string
  userId: string
  managerUserId: string | null
}): Promise<SetManagerResult> {
  const { workspaceId, userId, managerUserId } = params

  if (managerUserId !== null && managerUserId === userId) {
    return { ok: false, code: 'SELF_MANAGER' }
  }

  const { tree, members } = await loadReportingTree(workspaceId)
  const ids = new Set(members.map((m) => m.user_id))

  if (!ids.has(userId)) return { ok: false, code: 'NOT_A_MEMBER' }
  if (managerUserId !== null && !ids.has(managerUserId)) {
    return { ok: false, code: 'NOT_A_MEMBER' }
  }
  if (wouldCreateCycle(tree, userId, managerUserId)) {
    return { ok: false, code: 'CYCLE_DETECTED' }
  }

  await db.execute(
    `UPDATE workspace_members SET manager_user_id = ?
     WHERE workspace_id = ? AND user_id = ?`,
    [managerUserId, workspaceId, userId],
  )
  return { ok: true }
}

/**
 * Re-parent a departing member's reports onto their own manager.
 *
 * Called when someone is removed or leaves. Without it their reports would keep
 * pointing at a member row that no longer exists; the tree builder treats an
 * unknown manager as absent, so they would silently roll up to the owner
 * instead of to the person who actually inherits them.
 *
 * Returns how many were moved.
 */
export async function reparentReportsOf(params: {
  workspaceId: string
  departingUserId: string
}): Promise<number> {
  const { workspaceId, departingUserId } = params

  const departing = await db.queryOne<{ manager_user_id: string | null }>(
    `SELECT manager_user_id FROM workspace_members
     WHERE workspace_id = ? AND user_id = ?`,
    [workspaceId, departingUserId],
  )
  // Null grandparent is correct, not a failure: the reports become unassigned
  // and roll up to the owner, which is what "my manager had no manager" means.
  const grandparent = departing?.manager_user_id ?? null

  const result = await db.execute(
    `UPDATE workspace_members SET manager_user_id = ?
     WHERE workspace_id = ? AND manager_user_id = ?`,
    [grandparent, workspaceId, departingUserId],
  )
  return result.changes
}

/** Bulk assignment by email pair - backs the CSV/XLSX import. */
export async function setManagerByEmail(params: {
  workspaceId: string
  email: string
  managerEmail: string | null
}): Promise<SetManagerResult> {
  const rows = await db.query<{ user_id: string; email: string }>(
    `SELECT user_id, lower(email) as email FROM workspace_members
     WHERE workspace_id = ? AND status = 'active' AND user_id IS NOT NULL`,
    [params.workspaceId],
  )
  const byEmail = new Map(rows.map((r) => [r.email, r.user_id]))

  const userId = byEmail.get(params.email.trim().toLowerCase())
  if (!userId) return { ok: false, code: 'NOT_A_MEMBER' }

  let managerUserId: string | null = null
  if (params.managerEmail) {
    managerUserId = byEmail.get(params.managerEmail.trim().toLowerCase()) ?? null
    if (managerUserId === null) return { ok: false, code: 'NOT_A_MEMBER' }
  }

  return setManager({ workspaceId: params.workspaceId, userId, managerUserId })
}
