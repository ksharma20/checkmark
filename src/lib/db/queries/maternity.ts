/**
 * Maternity cases - statutory maternity leave, tracked as a case that moves
 * through stages rather than as a leave request.
 *
 * Deliberately NOT modelled on `leave_requests`, which are immutable rows
 * booked against an accrued balance. A maternity case spans months, its dates
 * shift as the due date moves, and it has a lifecycle an admin walks it
 * through: requested → approved → onleave → returned. Forcing that into an
 * immutable table would mean deleting and re-creating rows, which is exactly
 * what those tables forbid.
 *
 * Scoped by `workspace_id` on every statement, soft-deleted via `deleted_at`.
 */

import { db } from '../index'

export type MaternityStatus = 'requested' | 'approved' | 'onleave' | 'returned'

export const MATERNITY_STATUSES: readonly MaternityStatus[] = [
  'requested',
  'approved',
  'onleave',
  'returned',
]

export function isMaternityStatus(value: unknown): value is MaternityStatus {
  return typeof value === 'string' && (MATERNITY_STATUSES as readonly string[]).includes(value)
}

/**
 * The statuses that make a case "running". Everything except 'returned', which
 * is history.
 *
 * MUST stay in step with the partial unique index
 * `idx_maternity_cases_one_open` in scripts/migrate.js - the index is what
 * actually enforces one open case per employee, and this list is what the
 * reads use to agree with it.
 */
export const OPEN_MATERNITY_STATUSES: readonly MaternityStatus[] = MATERNITY_STATUSES.filter(
  (s) => s !== 'returned',
)

/** The index name, so the collision below is recognised rather than guessed at. */
const ONE_OPEN_CASE_INDEX = 'idx_maternity_cases_one_open'

/**
 * Thrown by createMaternityCase when the database rejects a second open case.
 *
 * A dedicated type rather than a leaked driver error: the route turns it into
 * the same 409 CASE_OPEN its own pre-check returns, so a caller cannot tell
 * whether it lost the race or simply arrived second.
 */
export class MaternityCaseOpenError extends Error {
  constructor() {
    // Internal wording - the user-facing copy is maternity.errors.caseOpen in
    // the locale module, chosen by the route.
    super('maternity_cases: an open case already exists for this employee')
    this.name = 'MaternityCaseOpenError'
  }
}

function isOpenCaseCollision(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes('UNIQUE constraint failed')) return false
  // SQLite names the COLUMNS the violated index covers
  // ("...failed: maternity_cases.workspace_id, maternity_cases.employee_id"),
  // not the index; some builds name the index instead. Accept either spelling,
  // and require both columns so a collision on the primary key - a different
  // bug entirely - is not silently reported as an open case.
  if (msg.includes(ONE_OPEN_CASE_INDEX)) return true
  return (
    msg.includes('maternity_cases.workspace_id') && msg.includes('maternity_cases.employee_id')
  )
}

/**
 * Stages a case may move to from each stage.
 *
 * Forward-only, one step at a time, so a case cannot jump from `requested`
 * straight to `returned` and leave no record of the leave ever starting. The
 * one backward edge, approved → requested, exists because an approval given in
 * error must be revocable before the leave begins.
 */
const ALLOWED_TRANSITIONS: Record<MaternityStatus, readonly MaternityStatus[]> = {
  requested: ['approved'],
  approved: ['onleave', 'requested'],
  onleave: ['returned'],
  returned: [],
}

export function canTransition(from: MaternityStatus, to: MaternityStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export interface MaternityCase {
  id: string
  workspace_id: string
  employee_id: string
  due_date: string | null
  start_date: string | null
  end_date: string | null
  weeks: number
  status: MaternityStatus
  returned_on: string | null
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** A case joined to the employee it belongs to - what the admin list renders. */
export interface MaternityCaseWithEmployee extends MaternityCase {
  employee_first_name: string
  employee_last_name: string
  employee_work_email: string
  employee_employee_id: string | null
  employee_department: string | null
}

const CASE_SELECT = `
  m.*,
  e.first_name  AS employee_first_name,
  e.last_name   AS employee_last_name,
  e.work_email  AS employee_work_email,
  e.employee_id AS employee_employee_id,
  ed.department AS employee_department`

const CASE_JOIN = `
  JOIN employees e ON e.id = m.employee_id
  LEFT JOIN employment_details ed ON ed.employee_id = e.id`

// ─── Reads ────────────────────────────────────────────────────────────────────

export interface ListMaternityFilters {
  status?: MaternityStatus
  employeeId?: string
}

export async function listMaternityCases(
  workspaceId: string,
  filters: ListMaternityFilters = {},
): Promise<MaternityCaseWithEmployee[]> {
  const where: string[] = ['m.workspace_id = ?', 'm.deleted_at IS NULL']
  const params: unknown[] = [workspaceId]

  if (filters.status) {
    where.push('m.status = ?')
    params.push(filters.status)
  }
  if (filters.employeeId) {
    where.push('m.employee_id = ?')
    params.push(filters.employeeId)
  }

  return db.query<MaternityCaseWithEmployee>(
    `SELECT ${CASE_SELECT}
     FROM maternity_cases m ${CASE_JOIN}
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(m.start_date, m.due_date, m.created_at) DESC`,
    params,
  )
}

export async function getMaternityCase(
  id: string,
  workspaceId: string,
): Promise<MaternityCaseWithEmployee | null> {
  return db.queryOne<MaternityCaseWithEmployee>(
    `SELECT ${CASE_SELECT}
     FROM maternity_cases m ${CASE_JOIN}
     WHERE m.id = ? AND m.workspace_id = ? AND m.deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * The employee's case that has not yet completed, if any.
 *
 * Used to reject a second concurrent case: an employee can have a history of
 * closed cases, but only one running at a time.
 */
export async function findOpenCaseForEmployee(
  workspaceId: string,
  employeeId: string,
): Promise<MaternityCase | null> {
  const placeholders = OPEN_MATERNITY_STATUSES.map(() => '?').join(',')
  return db.queryOne<MaternityCase>(
    `SELECT * FROM maternity_cases
     WHERE workspace_id = ? AND employee_id = ? AND deleted_at IS NULL
       AND status IN (${placeholders})
     LIMIT 1`,
    [workspaceId, employeeId, ...OPEN_MATERNITY_STATUSES],
  )
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateMaternityCaseInput {
  workspaceId: string
  employeeId: string
  due_date?: string | null
  start_date?: string | null
  end_date?: string | null
  weeks?: number
  notes?: string | null
  status?: MaternityStatus
}

export async function createMaternityCase(
  input: CreateMaternityCaseInput,
): Promise<MaternityCaseWithEmployee> {
  const id = crypto.randomUUID().replace(/-/g, '')

  try {
    await db.execute(
      `INSERT INTO maternity_cases (
         id, workspace_id, employee_id, due_date, start_date, end_date,
         weeks, status, notes
       ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.workspaceId,
        input.employeeId,
        input.due_date ?? null,
        input.start_date ?? null,
        input.end_date ?? null,
        input.weeks ?? 26,
        input.status ?? 'requested',
        input.notes ?? null,
      ],
    )
  } catch (err) {
    // The route pre-checks with findOpenCaseForEmployee, but that read and
    // this write are not one atomic step: under two concurrent POSTs the
    // partial unique index is the only thing that stops both landing.
    if (isOpenCaseCollision(err)) throw new MaternityCaseOpenError()
    throw err
  }

  const created = await getMaternityCase(id, input.workspaceId)
  if (!created) throw new Error(`createMaternityCase: failed to re-fetch case ${id}`)
  return created
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface UpdateMaternityCaseInput {
  due_date?: string | null
  start_date?: string | null
  end_date?: string | null
  weeks?: number
  status?: MaternityStatus
  returned_on?: string | null
  notes?: string | null
}

export async function updateMaternityCase(
  id: string,
  workspaceId: string,
  input: UpdateMaternityCaseInput,
): Promise<MaternityCaseWithEmployee | null> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const params: unknown[] = []

  const push = (col: string, value: unknown) => {
    sets.push(`${col} = ?`)
    params.push(value)
  }

  if ('due_date' in input) push('due_date', input.due_date ?? null)
  if ('start_date' in input) push('start_date', input.start_date ?? null)
  if ('end_date' in input) push('end_date', input.end_date ?? null)
  if (input.weeks !== undefined) push('weeks', input.weeks)
  if (input.status !== undefined) push('status', input.status)
  if ('returned_on' in input) push('returned_on', input.returned_on ?? null)
  if ('notes' in input) push('notes', input.notes ?? null)

  if (sets.length > 1) {
    params.push(id, workspaceId)
    await db.execute(
      `UPDATE maternity_cases SET ${sets.join(', ')}
       WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      params,
    )
  }

  return getMaternityCase(id, workspaceId)
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function deleteMaternityCase(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE maternity_cases
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}

/**
 * User IDs whose maternity leave covers `date` (YYYY-MM-DD, workspace-local).
 *
 * Used by the reminder pass to avoid nagging someone on maternity leave to
 * check in. Maternity lives in its own table keyed by `employee_id`, so the
 * `leave_requests` gate does not see it - hence this second lookup.
 *
 * Deliberately matches BOTH 'approved' and 'onleave'. The lifecycle expects an
 * admin to flip 'approved' to 'onleave' when the leave actually starts, but if
 * they forget, someone on day one of their leave would still be reminded.
 * Dates are the source of truth here; the status flag is not.
 *
 * Employees with no linked user account are skipped - there is nobody to push to.
 */
export async function getActiveMaternityUserIds(
  workspaceId: string,
  date: string,
): Promise<Set<string>> {
  const rows = await db.query<{ user_id: string }>(
    `SELECT e.user_id AS user_id
       FROM maternity_cases m
       JOIN employees e ON e.id = m.employee_id
      WHERE m.workspace_id = ?
        AND e.workspace_id = ?
        AND m.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND e.user_id IS NOT NULL
        AND m.status IN ('approved', 'onleave')
        AND m.start_date <= ?
        AND m.end_date   >= ?`,
    [workspaceId, workspaceId, date, date],
  )
  return new Set(rows.map((r) => r.user_id))
}
