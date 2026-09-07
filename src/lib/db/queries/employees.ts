import { randomBytes } from 'crypto'
import { db } from '../index'
import { getActiveMemberWithDetails } from './workspaces'
import { encryptFieldOrNull, decryptFieldOrNull } from '@/lib/encryption'
import type {
  Employee,
  EmploymentInfo,
  EmployeePublic,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '@/lib/types/employees'

export type {
  Employee,
  EmploymentInfo,
  EmployeeSensitiveInfo,
  EmployeePublic,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '@/lib/types/employees'

// ─── Internal raw DB types ────────────────────────────────────────────────────

interface EmploymentDetailsRow {
  designation: string | null
  department: string | null
  work_location: string | null
  work_mode: string | null
  reporting_manager_id: string | null
  employment_type: string | null
  source_of_hire: string | null
  total_work_experience: number | null
  date_of_joining: string | null
  confirmation_date: string | null
  probation_end_date: string | null
  exit_date: string | null
  exit_reason: string | null
}

interface EmployeeSensitiveRow {
  pan_encrypted: string | null
  aadhaar_encrypted: string | null
  uan: string | null
  passport_number: string | null
  bank_account_encrypted: string | null
  bank_ifsc: string | null
  bank_name: string | null
}

export type EmployeeRow = Employee & EmploymentDetailsRow & EmployeeSensitiveRow

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return randomBytes(16).toString('hex')
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Decrypt one stored field, degrading to `null` when it cannot be read.
 *
 * A corrupt, truncated or pre-encryption-era value must not take down the whole
 * request: every employee finder runs `toPublic(row, true)`, so a single bad
 * ciphertext would otherwise 500 routes that only wanted to check the employee
 * exists. The log names the field and the employee so the row can be found and
 * repaired — never the ciphertext, and never a decrypted value.
 */
function safeDecrypt(value: string | null, field: string, employeeId: string): string | null {
  if (value == null) return null
  try {
    return decryptFieldOrNull(value)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    console.error(`[employees] could not decrypt ${field} for employee ${employeeId}: ${reason}`)
    return null
  }
}

export function toPublic(row: EmployeeRow, includeSensitive = false): EmployeePublic {
  return {
    id: row.id, workspace_id: row.workspace_id, user_id: row.user_id,
    employee_id: row.employee_id, first_name: row.first_name, last_name: row.last_name,
    gender: row.gender, date_of_birth: row.date_of_birth, marital_status: row.marital_status,
    number_of_children: row.number_of_children, blood_group: row.blood_group,
    photo_url: row.photo_url, personal_email: row.personal_email, work_email: row.work_email,
    phone: row.phone, alternate_phone: row.alternate_phone, current_address: row.current_address,
    permanent_address: row.permanent_address, employee_status: row.employee_status,
    emergency_contact_name: row.emergency_contact_name ?? null,
    emergency_contact_relationship: row.emergency_contact_relationship ?? null,
    emergency_contact_phone: row.emergency_contact_phone ?? null,
    deleted_at: row.deleted_at, created_at: row.created_at, updated_at: row.updated_at,
    employment: {
      designation: row.designation ?? null,
      department: row.department ?? null,
      work_location: row.work_location ?? null,
      work_mode: row.work_mode as EmploymentInfo['work_mode'],
      reporting_manager_id: row.reporting_manager_id ?? null,
      employment_type: row.employment_type as EmploymentInfo['employment_type'],
      source_of_hire: row.source_of_hire as EmploymentInfo['source_of_hire'],
      total_work_experience: row.total_work_experience ?? null,
      date_of_joining: row.date_of_joining ?? null,
      confirmation_date: row.confirmation_date ?? null,
      probation_end_date: row.probation_end_date ?? null,
      exit_date: row.exit_date ?? null,
      exit_reason: row.exit_reason ?? null,
    },
    sensitive: includeSensitive ? {
      pan: safeDecrypt(row.pan_encrypted ?? null, 'pan', row.id),
      aadhaar: safeDecrypt(row.aadhaar_encrypted ?? null, 'aadhaar', row.id),
      uan: row.uan ?? null,
      passport_number: row.passport_number ?? null,
      bank_account: safeDecrypt(row.bank_account_encrypted ?? null, 'bank_account', row.id),
      bank_ifsc: row.bank_ifsc ?? null,
      bank_name: row.bank_name ?? null,
    } : null,
    age: computeAge(row.date_of_birth),
  }
}

type FieldMap = Array<[key: string, col?: string, transform?: (v: unknown) => unknown]>

function buildSets(input: Record<string, unknown>, fields: FieldMap): { sets: string[]; params: unknown[] } {
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, col, transform] of fields) {
    if (input[key] === undefined) continue
    sets.push(`${col ?? key} = ?`)
    params.push(transform ? transform(input[key]) : input[key])
  }
  return { sets, params }
}

const EMPLOYEE_FIELDS: FieldMap = [
  ['user_id'], ['employee_id'],
  ['first_name'], ['last_name'],
  ['gender'], ['date_of_birth'],
  ['marital_status'], ['number_of_children'],
  ['blood_group'], ['photo_url'],
  ['personal_email'], ['work_email'],
  ['phone'], ['alternate_phone'],
  ['current_address'], ['permanent_address'],
  ['employee_status'],
  ['emergency_contact_name'],
  ['emergency_contact_relationship'],
  ['emergency_contact_phone'],
]

const EMPLOYMENT_FIELDS: FieldMap = [
  ['designation'], ['department'],
  ['work_location'], ['work_mode'],
  ['reporting_manager_id'], ['employment_type'],
  ['source_of_hire'], ['total_work_experience'],
  ['date_of_joining'], ['confirmation_date'],
  ['probation_end_date'], ['exit_date'],
  ['exit_reason'],
]

const SENSITIVE_FIELDS: FieldMap = [
  ['pan', 'pan_encrypted', v => encryptFieldOrNull(v as string | null)],
  ['aadhaar', 'aadhaar_encrypted', v => encryptFieldOrNull(v as string | null)],
  ['bank_account', 'bank_account_encrypted', v => encryptFieldOrNull(v as string | null)],
  ['uan'], ['passport_number'],
  ['bank_ifsc'], ['bank_name'],
]

export const EMPLOYMENT_JOIN = `
  LEFT JOIN employment_details ed ON ed.employee_id = e.id
  LEFT JOIN employee_sensitive es ON es.employee_id = e.id`

export const EMPLOYMENT_COLS = `
  ed.designation, ed.department, ed.work_location, ed.work_mode,
  ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
  ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
  ed.probation_end_date, ed.exit_date, ed.exit_reason,
  es.pan_encrypted, es.aadhaar_encrypted, es.uan, es.passport_number,
  es.bank_account_encrypted, es.bank_ifsc, es.bank_name`

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getEmployee(id: string, workspaceId: string): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.id = ? AND e.workspace_id = ? AND e.deleted_at IS NULL`,
    [id, workspaceId],
  )
  return row ? toPublic(row, true) : null
}

export async function findEmployeeByEmployeeId(
  workspaceId: string,
  employeeId: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.workspace_id = ? AND e.employee_id = ? AND e.deleted_at IS NULL`,
    [workspaceId, employeeId],
  )
  return row ? toPublic(row, true) : null
}

export async function findEmployeeByWorkEmail(
  workspaceId: string,
  workEmail: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.workspace_id = ? AND e.work_email = ? AND e.deleted_at IS NULL`,
    [workspaceId, workEmail],
  )
  return row ? toPublic(row, true) : null
}

export async function findEmployeeByUserId(
  workspaceId: string,
  userId: string,
): Promise<EmployeePublic | null> {
  const row = await db.queryOne<EmployeeRow>(
    `SELECT e.*, ${EMPLOYMENT_COLS}
     FROM employees e ${EMPLOYMENT_JOIN}
     WHERE e.workspace_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
     LIMIT 1`,
    [workspaceId, userId],
  )
  return row ? toPublic(row, true) : null
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeePublic> {
  const id = generateId()

  await db.transaction(async (txDb) => {
    await txDb.execute(
      `INSERT INTO employees (
        id, workspace_id, user_id, employee_id,
        first_name, last_name, gender, date_of_birth, marital_status,
        number_of_children, blood_group, photo_url,
        personal_email, work_email, phone, alternate_phone,
        current_address, permanent_address, employee_status,
        emergency_contact_name, emergency_contact_relationship, emergency_contact_phone
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, input.workspace_id, input.user_id ?? null, input.employee_id ?? null,
        input.first_name, input.last_name, input.gender ?? null, input.date_of_birth ?? null,
        input.marital_status ?? null, input.number_of_children ?? null,
        input.blood_group ?? null, input.photo_url ?? null,
        input.personal_email ?? null, input.work_email,
        input.phone ?? null, input.alternate_phone ?? null,
        input.current_address ?? null, input.permanent_address ?? null,
        input.employee_status ?? 'active',
        input.emergency_contact_name ?? null,
        input.emergency_contact_relationship ?? null,
        input.emergency_contact_phone ?? null,
      ],
    )

    await txDb.execute(
      `INSERT INTO employment_details (
        id, employee_id, workspace_id,
        designation, department, work_location, work_mode,
        reporting_manager_id, employment_type, source_of_hire,
        total_work_experience, date_of_joining, confirmation_date,
        probation_end_date, exit_date, exit_reason
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(), id, input.workspace_id,
        input.designation ?? null, input.department ?? null,
        input.work_location ?? null, input.work_mode ?? null,
        input.reporting_manager_id ?? null, input.employment_type ?? null,
        input.source_of_hire ?? null, input.total_work_experience ?? null,
        input.date_of_joining ?? null, input.confirmation_date ?? null,
        input.probation_end_date ?? null, input.exit_date ?? null, input.exit_reason ?? null,
      ],
    )

    await txDb.execute(
      `INSERT INTO employee_sensitive (
        id, employee_id, workspace_id,
        pan_encrypted, aadhaar_encrypted, uan, passport_number,
        bank_account_encrypted, bank_ifsc, bank_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(), id, input.workspace_id,
        encryptFieldOrNull(input.pan), encryptFieldOrNull(input.aadhaar),
        input.uan ?? null, input.passport_number ?? null,
        encryptFieldOrNull(input.bank_account), input.bank_ifsc ?? null, input.bank_name ?? null,
      ],
    )

  })

  const created = await getEmployee(id, input.workspace_id)
  if (!created) throw new Error(`createEmployee: failed to re-fetch employee ${id}`)
  return created
}

// ─── Ensure (lazy provisioning) ───────────────────────────────────────────────

/**
 * Outcome of {@link ensureEmployeeForMember}.
 *
 * A tagged result rather than `EmployeePublic | null`: the two failure modes
 * need different HTTP answers, and a bare `null` cannot tell "not a member of
 * this workspace" (404) from "another record already holds this work email"
 * (409). Routes map the reason; they never guess from a null.
 */
export type EnsureEmployeeResult =
  | { ok: true; employee: EmployeePublic; created: boolean }
  | { ok: false; reason: 'NOT_A_MEMBER' | 'WORK_EMAIL_TAKEN' }

/** The partial unique index that adjudicates two racing INSERTs. */
const WORK_EMAIL_INDEX = 'idx_employees_ws_work_email'

/**
 * First name / last name from a single free-text `users.full_name`.
 *
 * `last_name` is NOT NULL but may be the empty string, and that is the point:
 * a third of a real workspace signs up with one word, and a surname must never
 * be invented to satisfy a column. Empty is not null - it stores, it renders as
 * nothing, and an admin can correct it in the Employees directory.
 *
 * With no name at all the email's local part stands in for the first name,
 * because a row whose only human-readable field is blank is worse than a rough
 * one.
 */
function splitFullName(fullName: string | null, workEmail: string): { first: string; last: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: workEmail.split('@')[0] || workEmail, last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function isWorkEmailCollision(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (!msg.includes('UNIQUE constraint failed')) return false
  // SQLite names the COLUMNS an index covers ("...failed: employees.workspace_id,
  // employees.work_email"); some builds name the index. Accept either, and
  // require both columns so a primary-key collision is not misread as this.
  if (msg.includes(WORK_EMAIL_INDEX)) return true
  return msg.includes('employees.workspace_id') && msg.includes('employees.work_email')
}

/**
 * Attach `userId` to a record that already holds this member's work email.
 *
 * Reachable when an admin typed the address into the Employees directory
 * without linking the account. Linking is what makes the *next* lookup by
 * user_id find it, so the same person never ends up with two records.
 *
 * The UPDATE is guarded on `user_id IS NULL` and the decision is taken from a
 * re-read, not from the row we started with: a concurrent claim must lose
 * cleanly rather than overwrite.
 */
async function claimByWorkEmail(
  existing: EmployeePublic,
  workspaceId: string,
  userId: string,
): Promise<EnsureEmployeeResult> {
  if (existing.user_id === null) {
    await db.execute(
      `UPDATE employees SET user_id = ?, updated_at = datetime('now')
       WHERE id = ? AND workspace_id = ? AND user_id IS NULL AND deleted_at IS NULL`,
      [userId, existing.id, workspaceId],
    )
  }
  const fresh = (await getEmployee(existing.id, workspaceId)) ?? existing
  return fresh.user_id === userId
    ? { ok: true, employee: fresh, created: false }
    : { ok: false, reason: 'WORK_EMAIL_TAKEN' }
}

/**
 * Attach an HR record to the account that just claimed it, by work email.
 *
 * The gap this closes: the add-employee flow can create a record for somebody
 * who has no account yet - that is the whole point of being able to invite them
 * afterwards - so `employees.user_id` is NULL and the directory finds the row
 * only by matching work email against the membership email. The moment they
 * accept and a user row exists, the record must stop relying on that fallback
 * and hold the real id.
 *
 * `user_id IS NULL` is what makes this safe to call more than once, and safe to
 * call on somebody who already has a record: it claims an orphan or does
 * nothing, and can never repoint a record that is already spoken for.
 *
 * Deliberately NOT wrapped in a transaction with the membership update that
 * precedes it. `db.transaction()` on local SQLite wraps an awaited callback in
 * raw BEGIN/COMMIT on one shared connection, so overlapping calls interleave
 * and one can commit another's writes. Two sequential statements are correct
 * here because the failure mode is benign: an active member whose record is
 * still unlinked is still found by the directory's work-email join, and the
 * next call to this function repairs it.
 */
export async function claimEmployeeForUser(
  workspaceId: string,
  email: string,
  userId: string,
): Promise<void> {
  await db.execute(
    `UPDATE employees SET user_id = ?, updated_at = datetime('now')
     WHERE workspace_id = ? AND lower(work_email) = lower(?)
       AND user_id IS NULL AND deleted_at IS NULL`,
    [userId, workspaceId, email],
  )
}

/**
 * One in-flight provision per (workspace, member).
 *
 * Coalescing, not locking: it only covers this process, which is why the unique
 * index is still the guarantee. What it buys is that the ordinary case - a
 * double-clicked Assign button - resolves to one record and one INSERT instead
 * of relying on a failed write to sort itself out.
 */
const inFlightEnsures = new Map<string, Promise<EnsureEmployeeResult>>()

/**
 * The HR record for a workspace member, created if this is the first time one
 * was actually needed.
 *
 * WHY THIS EXISTS. `workspace_members` and `employees` are separate tables with
 * no link enforced between them, and `createEmployee` is only ever reached by
 * an admin filling in the directory form. A real workspace therefore runs with
 * 34 active members and one HR record - and `workspace_assets.assigned_employee_id`
 * and `maternity_cases.employee_id` are FKs to `employees.id`, so the asset and
 * maternity pickers had exactly one person to offer. The record has to come
 * into being because a real event required it: assigning a laptop, opening a
 * maternity case.
 *
 * WHY NOT A ROW PER MEMBER ON JOIN. Auto-provisioning on join was rejected:
 * `employees.last_name` is NOT NULL and a third of that workspace signed up
 * with a single-word name, so it would mean inventing surnames for people who
 * may never need an HR record at all. Nothing is guessed here either - only
 * the member's own email and their `users.full_name`, split (see
 * {@link splitFullName}). `date_of_joining` is deliberately left NULL rather
 * than defaulted from `added_at`: joining a workspace is not joining the
 * company, and the celebrations feed would announce fictional work
 * anniversaries.
 *
 * CONCURRENCY. Two simultaneous assignments to the same member must not mint
 * two records, and `idx_employees_user` is NOT unique, so the check-then-act
 * below can genuinely double-insert. Two things stop it:
 *   1. in-process single-flight, so the second caller waits on the first's
 *      promise instead of racing it;
 *   2. the partial unique index on (workspace_id, work_email) - the only
 *      guarantee that survives two processes - after which the loser re-reads
 *      and returns the winner's record.
 *
 * Returns NOT_A_MEMBER when there is no ACTIVE membership for this workspace:
 * this must never mint a record for someone who is not a member.
 */
export async function ensureEmployeeForMember(
  workspaceId: string,
  userId: string,
): Promise<EnsureEmployeeResult> {
  const key = `${workspaceId}:${userId}` // scoped: two workspaces never share one
  const running = inFlightEnsures.get(key)
  if (running) return running

  const pending = provisionEmployeeForMember(workspaceId, userId)
    .finally(() => { inFlightEnsures.delete(key) })
  inFlightEnsures.set(key, pending)
  return pending
}

async function provisionEmployeeForMember(
  workspaceId: string,
  userId: string,
): Promise<EnsureEmployeeResult> {
  // The membership - never the request - decides whether this person exists
  // here. Scoped to the workspace and to status = 'active' by the query.
  const member = await getActiveMemberWithDetails(workspaceId, userId)
  if (!member) return { ok: false, reason: 'NOT_A_MEMBER' }

  const existing = await findEmployeeByUserId(workspaceId, userId)
  if (existing) return { ok: true, employee: existing, created: false }

  const workEmail = member.email
  // An unlinked record for this address is far commoner than a race, so it is
  // checked for rather than discovered through a failed INSERT.
  const byEmail = await findEmployeeByWorkEmail(workspaceId, workEmail)
  if (byEmail) return claimByWorkEmail(byEmail, workspaceId, userId)

  const { first, last } = splitFullName(member.full_name, workEmail)

  try {
    const employee = await createEmployee({
      workspace_id: workspaceId,
      user_id: userId,
      first_name: first,
      last_name: last,
      work_email: workEmail,
    })
    return { ok: true, employee, created: true }
  } catch (err) {
    // Lost the race to another process. The winner's row is the answer, so the
    // re-read decides - not the error text, which only says a UNIQUE index
    // fired. If nothing is there, the INSERT failed for some other reason and
    // that error is the caller's to see.
    const winner = await findEmployeeByWorkEmail(workspaceId, workEmail)
    if (!winner) {
      if (isWorkEmailCollision(err)) {
        // A UNIQUE fired but the row it collided with is already gone - it was
        // archived between the failed INSERT and this read. Report the
        // collision rather than a 500; a retry will now succeed.
        return { ok: false, reason: 'WORK_EMAIL_TAKEN' }
      }
      throw err
    }
    return claimByWorkEmail(winner, workspaceId, userId)
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateEmployee(
  id: string,
  workspaceId: string,
  input: UpdateEmployeeInput,
): Promise<EmployeePublic | null> {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const raw = input as Record<string, unknown>

  const e = buildSets(raw, EMPLOYEE_FIELDS)
  const d = buildSets(raw, EMPLOYMENT_FIELDS)
  const s = buildSets(raw, SENSITIVE_FIELDS)

  if (e.sets.length === 0 && d.sets.length === 0 && s.sets.length === 0) {
    return getEmployee(id, workspaceId)
  }

  await db.transaction(async (txDb) => {
    const exists = await txDb.queryOne<{ id: string }>(
      `SELECT id FROM employees WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [id, workspaceId],
    )
    if (!exists) return

    if (e.sets.length > 0) {
      await txDb.execute(
        `UPDATE employees SET ${[...e.sets, 'updated_at = ?'].join(', ')}
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [...e.params, now, id, workspaceId],
      )
    }
    if (d.sets.length > 0) {
      await txDb.execute(
        `UPDATE employment_details SET ${[...d.sets, 'updated_at = ?'].join(', ')}
         WHERE employee_id = ? AND workspace_id = ?`,
        [...d.params, now, id, workspaceId],
      )
    }
    if (s.sets.length > 0) {
      await txDb.execute(
        `UPDATE employee_sensitive SET ${[...s.sets, 'updated_at = ?'].join(', ')}
         WHERE employee_id = ? AND workspace_id = ?`,
        [...s.params, now, id, workspaceId],
      )
    }
  })

  return getEmployee(id, workspaceId)
}

// ─── Delete (soft) ────────────────────────────────────────────────────────────

export async function softDeleteEmployee(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE employees
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}

// ─── Archive / Restore ────────────────────────────────────────────────────────

export async function archiveEmployee(
  id: string,
  workspaceId: string,
  exitDate: string,
  exitReason: string,
): Promise<boolean> {
  let archived = false

  await db.transaction(async (txDb) => {
    const emp = await txDb.queryOne<Pick<Employee, 'user_id' | 'deleted_at'>>(
      `SELECT user_id, deleted_at FROM employees WHERE id = ? AND workspace_id = ?`,
      [id, workspaceId],
    )
    if (!emp || emp.deleted_at !== null) return

    const result = await txDb.execute(
      `UPDATE employees
       SET deleted_at = datetime('now'), employee_status = 'terminated', updated_at = datetime('now')
       WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [id, workspaceId],
    )
    if (result.changes === 0) return
    archived = true

    await txDb.execute(
      `UPDATE employment_details
       SET exit_date = ?, exit_reason = ?, updated_at = datetime('now')
       WHERE employee_id = ? AND workspace_id = ?`,
      [exitDate, exitReason, id, workspaceId],
    )

    if (emp.user_id) {
      await txDb.execute(
        `UPDATE workspace_members SET status = 'inactive'
         WHERE workspace_id = ? AND user_id = ?`,
        [workspaceId, emp.user_id],
      )
    }
  })

  return archived
}

export async function restoreEmployee(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  let restored = false

  await db.transaction(async (txDb) => {
    const emp = await txDb.queryOne<Pick<Employee, 'user_id' | 'deleted_at'>>(
      `SELECT user_id, deleted_at FROM employees WHERE id = ? AND workspace_id = ?`,
      [id, workspaceId],
    )
    if (!emp || emp.deleted_at === null) return

    const result = await txDb.execute(
      `UPDATE employees
       SET deleted_at = NULL, employee_status = 'active', updated_at = datetime('now')
       WHERE id = ? AND workspace_id = ? AND deleted_at IS NOT NULL`,
      [id, workspaceId],
    )
    if (result.changes === 0) return
    restored = true

    await txDb.execute(
      `UPDATE employment_details
       SET exit_date = NULL, exit_reason = NULL, updated_at = datetime('now')
       WHERE employee_id = ? AND workspace_id = ?`,
      [id, workspaceId],
    )

    if (emp.user_id) {
      await txDb.execute(
        `UPDATE workspace_members SET status = 'active'
         WHERE workspace_id = ? AND user_id = ?`,
        [workspaceId, emp.user_id],
      )
    }
  })

  return restored
}

// ─── Overview aggregates ────────────────────────────────────────────────────

export interface DepartmentBreakdown {
  department: string
  count: number
}

/**
 * Headcount by department, with the denominator attached.
 *
 * `departments` never covers everybody: an HR record is optional and created
 * lazily, so `employees` is a subset of the people in the workspace. The two
 * counters exist so the caller can say how much of the workspace the bars
 * actually describe.
 */
export interface DepartmentHeadcount {
  /** One row per named department, largest first. */
  departments: DepartmentBreakdown[]
  /** Active members whose HR record names a department. */
  withDepartment: number
  /** Active members with no HR record, or one with no department set. */
  withoutDepartment: number
}

/**
 * Anchored on `workspace_members`, not on `employees`.
 *
 * The employee-anchored version counted HR records, so a real 34-member
 * workspace with a single HR record rendered exactly one bar - which reads as
 * "this workspace has one department". Counting members and returning how many
 * of them have no department on file lets the dashboard show the denominator
 * instead of quietly shrinking it.
 *
 * COUNT(DISTINCT wm.id) rather than COUNT(*): nothing at the DB level stops two
 * live `employees` rows from pointing at the same user, and a member must not
 * be able to inflate a bar past the headcount.
 */
export async function getDepartmentBreakdown(workspaceId: string): Promise<DepartmentHeadcount> {
  const rows = await db.query<{ department: string | null; count: number }>(
    `SELECT NULLIF(TRIM(ed.department), '') AS department, COUNT(DISTINCT wm.id) AS count
     FROM workspace_members wm
     LEFT JOIN employees e
       ON e.workspace_id = wm.workspace_id AND e.user_id = wm.user_id AND e.deleted_at IS NULL
     LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE wm.workspace_id = ? AND wm.status = 'active' AND wm.user_id IS NOT NULL
     GROUP BY NULLIF(TRIM(ed.department), '')
     ORDER BY count DESC`,
    [workspaceId],
  )

  const departments: DepartmentBreakdown[] = []
  let withDepartment = 0
  let withoutDepartment = 0

  for (const row of rows) {
    if (row.department === null) {
      withoutDepartment += row.count
      continue
    }
    departments.push({ department: row.department, count: row.count })
    withDepartment += row.count
  }

  return { departments, withDepartment, withoutDepartment }
}

export interface UpcomingCelebration {
  employeeId: string
  name: string
  kind: 'birthday' | 'anniversary'
  occursOn: string // YYYY-MM-DD of the next occurrence
  yearsCount?: number // anniversary only: years since date_of_joining
}

function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function nextOccurrence(originalIso: string, today: Date): { iso: string; daysUntil: number } {
  const month = Number(originalIso.slice(5, 7))
  const day = Number(originalIso.slice(8, 10))
  const todayMidnight = stripTime(today)
  let candidate = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day))
  if (candidate < todayMidnight) candidate = new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day))
  const daysUntil = Math.round((candidate.getTime() - todayMidnight.getTime()) / 86400000)
  return { iso: candidate.toISOString().slice(0, 10), daysUntil }
}

/**
 * How far ahead the next occurrence is computed before selection happens.
 *
 * This is NOT the widget's window - the window is a calendar month plus a
 * minimum count (see below). It is only wide enough that every person on file
 * has exactly one occurrence in it, so the "keep taking the next ones" step
 * never runs out of candidates it should have had. A birthday is at most 366
 * days away once `nextOccurrence` has rolled it into the future, so ~400 days
 * covers everyone with room to spare.
 */
const CELEBRATION_HORIZON_DAYS = 400

/**
 * The celebrations the overview widget shows.
 *
 * The rule is "the rest of this month, but never a nearly-empty card":
 * every occurrence falling in the same calendar month as `todayIso`, and if
 * that is fewer than `minCount`, keep taking the next ones in date order until
 * there are `minCount` (or the workspace runs out of people).
 *
 * Who is eligible:
 * - not soft-deleted, not `terminated`, and not past their `exit_date` - a
 *   departed colleague's birthday must not be announced to the workspace;
 * - an ACTIVE `workspace_members` row, so an ex-member whose membership was
 *   revoked, or an HR record for somebody who never joined, drops out.
 *
 * An employee record with a NULL `user_id` is DELIBERATELY excluded. That is
 * the open-invitation window (invariant 19): the record exists, the person does
 * not have an account and has not accepted, so they are not yet a colleague to
 * congratulate. Requiring `e.user_id` to match a member's is what encodes that
 * - unlike the directory join in `workspaces.ts`, this one has no work-email
 * fallback, and that omission is the decision, not an oversight.
 *
 * EXISTS rather than a plain JOIN: nothing at the DB level stops two membership
 * rows (different emails) pointing at one user, and a JOIN would then emit the
 * same birthday twice - which the widget keys as one row.
 */
export async function getUpcomingCelebrations(
  workspaceId: string,
  todayIso: string,
  minCount = 5,
): Promise<UpcomingCelebration[]> {
  const rows = await db.query<{
    id: string
    first_name: string
    last_name: string
    date_of_birth: string | null
    date_of_joining: string | null
  }>(
    `SELECT e.id, e.first_name, e.last_name, e.date_of_birth, ed.date_of_joining
     FROM employees e
     LEFT JOIN employment_details ed ON ed.employee_id = e.id
     WHERE e.workspace_id = ? AND e.deleted_at IS NULL
       AND e.employee_status != 'terminated'
       AND (ed.exit_date IS NULL OR ed.exit_date >= ?)
       AND e.user_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM workspace_members wm
         WHERE wm.workspace_id = e.workspace_id
           AND wm.user_id = e.user_id
           AND wm.status = 'active'
       )
       AND (e.date_of_birth IS NOT NULL OR ed.date_of_joining IS NOT NULL)`,
    [workspaceId, todayIso],
  )

  const today = new Date(`${todayIso}T00:00:00Z`)
  const out: UpcomingCelebration[] = []

  for (const r of rows) {
    const name = `${r.first_name} ${r.last_name}`.trim()

    if (r.date_of_birth) {
      const occurs = nextOccurrence(r.date_of_birth, today)
      if (occurs.daysUntil >= 0 && occurs.daysUntil <= CELEBRATION_HORIZON_DAYS) {
        out.push({ employeeId: r.id, name, kind: 'birthday', occursOn: occurs.iso })
      }
    }

    if (r.date_of_joining) {
      const occurs = nextOccurrence(r.date_of_joining, today)
      if (occurs.daysUntil >= 0 && occurs.daysUntil <= CELEBRATION_HORIZON_DAYS) {
        const joinYear = Number(r.date_of_joining.slice(0, 4))
        const occurYear = Number(occurs.iso.slice(0, 4))
        if (occurYear > joinYear) {
          out.push({ employeeId: r.id, name, kind: 'anniversary', occursOn: occurs.iso, yearsCount: occurYear - joinYear })
        }
      }
    }
  }

  const sorted = out.sort((a, b) => a.occursOn.localeCompare(b.occursOn))

  // Every occurrence is on or after today, so the ones inside today's calendar
  // month are a PREFIX of the sorted list. "Extend forward until minCount" is
  // therefore just a longer prefix - no second pass, no risk of the two
  // branches disagreeing about order.
  const thisMonth = todayIso.slice(0, 7)
  const inMonth = sorted.filter((c) => c.occursOn.slice(0, 7) === thisMonth)
  return inMonth.length >= minCount ? inMonth : sorted.slice(0, minCount)
}
