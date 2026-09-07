/**
 * Workspace asset register - company hardware and equipment, optionally
 * assigned to an employee.
 *
 * Every query here is scoped by `workspace_id` and filters `deleted_at IS
 * NULL`: assets are soft-deleted so a retired laptop's assignment history
 * survives, exactly as holidays and employees do.
 */

import { db } from '../index'

/** The four states an asset can be in. Mirrors the CHECK on the column. */
export type AssetStatus = 'assigned' | 'available' | 'repair' | 'retired'

export const ASSET_STATUSES: readonly AssetStatus[] = [
  'assigned',
  'available',
  'repair',
  'retired',
]

export function isAssetStatus(value: unknown): value is AssetStatus {
  return typeof value === 'string' && (ASSET_STATUSES as readonly string[]).includes(value)
}

export interface Asset {
  id: string
  workspace_id: string
  category: string | null
  name: string
  serial_number: string | null
  condition: string | null
  status: AssetStatus
  assigned_employee_id: string | null
  assigned_at: string | null
  purchase_value: number | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** An asset joined to the name of whoever holds it - what every list renders. */
export interface AssetWithAssignee extends Asset {
  assignee_first_name: string | null
  assignee_last_name: string | null
  assignee_employee_id: string | null
}

export interface ListAssetsFilters {
  category?: string
  status?: AssetStatus
}

const ASSET_SELECT = `
  a.*,
  e.first_name  AS assignee_first_name,
  e.last_name   AS assignee_last_name,
  e.employee_id AS assignee_employee_id`

// LEFT JOIN, not INNER: an unassigned asset must still appear in the list.
const ASSET_JOIN = `LEFT JOIN employees e ON e.id = a.assigned_employee_id`

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function listAssets(
  workspaceId: string,
  filters: ListAssetsFilters = {},
): Promise<AssetWithAssignee[]> {
  const where: string[] = ['a.workspace_id = ?', 'a.deleted_at IS NULL']
  const params: unknown[] = [workspaceId]

  if (filters.category) {
    where.push('a.category = ?')
    params.push(filters.category)
  }
  if (filters.status) {
    where.push('a.status = ?')
    params.push(filters.status)
  }

  return db.query<AssetWithAssignee>(
    `SELECT ${ASSET_SELECT}
     FROM workspace_assets a ${ASSET_JOIN}
     WHERE ${where.join(' AND ')}
     ORDER BY a.created_at DESC`,
    params,
  )
}

export async function getAsset(id: string, workspaceId: string): Promise<AssetWithAssignee | null> {
  return db.queryOne<AssetWithAssignee>(
    `SELECT ${ASSET_SELECT}
     FROM workspace_assets a ${ASSET_JOIN}
     WHERE a.id = ? AND a.workspace_id = ? AND a.deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * Every asset currently held by one employee - for their profile page.
 *
 * `status = 'assigned'` is part of the filter, not just the holder column.
 * Holder-set-and-status-assigned move together on every write path (see
 * assignAsset / unassignAsset, and the PATCH guard in the [id] route), but a
 * row written before those guards existed can still carry a holder while
 * reading retired - and this list is where that would show up as "your
 * offboarded colleague still has the laptop".
 */
export async function listAssetsForEmployee(
  workspaceId: string,
  employeeId: string,
): Promise<Asset[]> {
  return db.query<Asset>(
    `SELECT * FROM workspace_assets
     WHERE workspace_id = ? AND assigned_employee_id = ? AND deleted_at IS NULL
       AND status = 'assigned'
     ORDER BY assigned_at DESC`,
    [workspaceId, employeeId],
  )
}

/** Distinct categories in use - drives the filter dropdown without a second table. */
export async function listAssetCategories(workspaceId: string): Promise<string[]> {
  const rows = await db.query<{ category: string }>(
    `SELECT DISTINCT category FROM workspace_assets
     WHERE workspace_id = ? AND deleted_at IS NULL AND category IS NOT NULL AND category != ''
     ORDER BY category ASC`,
    [workspaceId],
  )
  return rows.map((r) => r.category)
}

export interface AssetStatusCount {
  status: AssetStatus
  count: number
}

export async function getAssetStatusCounts(workspaceId: string): Promise<AssetStatusCount[]> {
  return db.query<AssetStatusCount>(
    `SELECT status, COUNT(*) AS count FROM workspace_assets
     WHERE workspace_id = ? AND deleted_at IS NULL
     GROUP BY status`,
    [workspaceId],
  )
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateAssetInput {
  workspaceId: string
  name: string
  category?: string | null
  serial_number?: string | null
  condition?: string | null
  status?: AssetStatus
  purchase_value?: number | null
  notes?: string | null
}

export async function createAsset(input: CreateAssetInput): Promise<AssetWithAssignee> {
  const id = crypto.randomUUID().replace(/-/g, '')

  await db.execute(
    `INSERT INTO workspace_assets (
       id, workspace_id, category, name, serial_number, condition,
       status, purchase_value, notes
     ) VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.workspaceId,
      input.category ?? null,
      input.name,
      input.serial_number ?? null,
      input.condition ?? null,
      input.status ?? 'available',
      input.purchase_value ?? null,
      input.notes ?? null,
    ],
  )

  const created = await getAsset(id, input.workspaceId)
  if (!created) throw new Error(`createAsset: failed to re-fetch asset ${id}`)
  return created
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateAssetInput {
  name?: string
  category?: string | null
  serial_number?: string | null
  condition?: string | null
  status?: AssetStatus
  purchase_value?: number | null
  notes?: string | null
}

export async function updateAsset(
  id: string,
  workspaceId: string,
  input: UpdateAssetInput,
): Promise<AssetWithAssignee | null> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const params: unknown[] = []

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = ?`)
    params.push(value)
  }

  if (input.name !== undefined) push('name', input.name)
  if ('category' in input) push('category', input.category ?? null)
  if ('serial_number' in input) push('serial_number', input.serial_number ?? null)
  if ('condition' in input) push('condition', input.condition ?? null)
  if (input.status !== undefined) push('status', input.status)
  if ('purchase_value' in input) push('purchase_value', input.purchase_value ?? null)
  if ('notes' in input) push('notes', input.notes ?? null)

  if (sets.length > 1) {
    params.push(id, workspaceId)
    await db.execute(
      `UPDATE workspace_assets SET ${sets.join(', ')}
       WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      params,
    )
  }

  return getAsset(id, workspaceId)
}

// ─── Assignment ───────────────────────────────────────────────────────────────

/**
 * Hand an asset to an employee.
 *
 * The employee lookup happens inside the same statement's WHERE via a
 * pre-check in the caller; here the assignment and the status change move
 * together so an asset can never read `assigned` with a null holder.
 */
export async function assignAsset(
  id: string,
  workspaceId: string,
  employeeId: string,
): Promise<AssetWithAssignee | null> {
  await db.execute(
    `UPDATE workspace_assets
     SET assigned_employee_id = ?, assigned_at = datetime('now'),
         status = 'assigned', updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [employeeId, id, workspaceId],
  )
  return getAsset(id, workspaceId)
}

/**
 * Take an asset back.
 *
 * Returns it to `available` rather than clearing status alone - "unassigned
 * but still marked assigned" is the state that makes an asset register lie.
 * A caller that wants `repair` or `retired` follows with an update.
 */
export async function unassignAsset(
  id: string,
  workspaceId: string,
): Promise<AssetWithAssignee | null> {
  await db.execute(
    `UPDATE workspace_assets
     SET assigned_employee_id = NULL, assigned_at = NULL,
         status = 'available', updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return getAsset(id, workspaceId)
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteAsset(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE workspace_assets
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}
