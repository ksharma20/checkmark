/**
 * Parental leave extensions - an employee asking to stay away longer than the
 * statutory entitlement their case was opened with, as UNPAID days.
 *
 * A separate table from `maternity_cases` rather than an editable `end_date`,
 * because the request and the case are different things: the case's dates are
 * what the reminder gate reads and moving them is an administrative act, while
 * this is a member-filed request that can be refused.
 *
 * APPEND-ONLY, in the same sense as `leave_requests`. The case, the dates and
 * the reason are fixed at insert, and the only later write is the approve /
 * reject transition out of `pending` - applied with `WHERE status = 'pending'`
 * so a second concurrent action reports ALREADY_ACTIONED rather than
 * double-processing. A correction is a reject plus a new request, never an edit.
 *
 * `unpaid_days` is the one column the approve transition re-stamps, and it is
 * part of that same single atomic UPDATE rather than a second write. The figure
 * stored at insert is the estimate the member was shown; the holiday calendar
 * can change between filing and approval, so the approved figure is recomputed
 * from the calendar as it stands at the moment of approval and written in the
 * same statement that claims the row.
 *
 * UNPAID is the whole design: approving one writes NO `leave_requests` row and
 * touches no balance. See `approveExtensionSideEffect` in the approvals route -
 * all approval does besides marking the row is move the case's `end_date`,
 * which also extends the reminder gate (`getActiveParentalUserIds` matches on
 * dates).
 */

import { db } from '../index'
import { countWorkdays, nextDateKey } from '@/lib/attendance-summary'
import { getHolidaysInRange } from './holidays'
import type { ParentalCaseType } from './maternity'

export type ParentalExtensionStatus = 'pending' | 'approved' | 'rejected'

export interface ParentalExtension {
  id: string
  workspace_id: string
  case_id: string
  user_id: string
  /** What the case's end_date was when the request was filed. Stored, not derived. */
  previous_end_date: string
  requested_end_date: string
  /** WORKING days between the two, weekends and company holidays excluded. Never client-supplied. */
  unpaid_days: number
  reason: string | null
  status: ParentalExtensionStatus
  rejection_reason: string | null
  actioned_by_user_id: string | null
  created_at: string
}

/** A request joined to the person who filed it and the case it extends. */
export interface ParentalExtensionWithUser extends ParentalExtension {
  user_full_name: string | null
  user_email: string
  case_type: ParentalCaseType
  /** The case's end_date NOW, which may have moved since the request was filed. */
  case_end_date: string | null
}

const WITH_USER_SELECT = `
  x.*,
  u.full_name  AS user_full_name,
  u.email      AS user_email,
  m.case_type  AS case_type,
  m.end_date   AS case_end_date`

const WITH_USER_JOIN = `
  JOIN users u ON u.id = x.user_id
  JOIN maternity_cases m ON m.id = x.case_id`

// ─── Unpaid days ──────────────────────────────────────────────────────────────

/**
 * How many UNPAID working days an extension to `requestedEndDate` costs.
 *
 * The window is the day AFTER the case's current end date through the requested
 * end date inclusive - the current end date is already covered by the case, so
 * counting it would charge the member a day they already have.
 *
 * Weekends come from the workspace's `working_days`, company holidays from
 * `workspace_holidays`, both through the same `countWorkdays()` every other
 * day-count in the product uses (invariant: attendance maths has one home).
 *
 * Returns 0 when the requested date is not actually beyond the current end -
 * callers refuse that case with their own error rather than storing a 0-day
 * extension.
 */
export async function computeUnpaidExtensionDays(params: {
  workspaceId: string
  /** The case's end_date at the moment of the computation. */
  currentEndDate: string
  requestedEndDate: string
  /** The `workspaces.working_days` JSON column, verbatim. */
  workingDaysJson: string | null
}): Promise<number> {
  if (params.requestedEndDate <= params.currentEndDate) return 0

  const workingDays: number[] = (() => {
    try {
      const parsed = JSON.parse(params.workingDaysJson ?? '[1,2,3,4,5]')
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [1, 2, 3, 4, 5]
    } catch {
      return [1, 2, 3, 4, 5]
    }
  })()

  const from = nextDateKey(params.currentEndDate)
  const holidays = await getHolidaysInRange(params.workspaceId, from, params.requestedEndDate)
  return countWorkdays(
    from,
    params.requestedEndDate,
    new Set(holidays.map((h) => h.date)),
    workingDays,
  )
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getParentalExtension(
  id: string,
  workspaceId: string,
): Promise<ParentalExtensionWithUser | null> {
  return db.queryOne<ParentalExtensionWithUser>(
    `SELECT ${WITH_USER_SELECT}
     FROM parental_leave_extensions x ${WITH_USER_JOIN}
     WHERE x.id = ? AND x.workspace_id = ?`,
    [id, workspaceId],
  )
}

/** Everything awaiting a decision, oldest first - the approvals queue's read. */
export async function getPendingParentalExtensions(
  workspaceId: string,
  limit = 100_000,
): Promise<ParentalExtensionWithUser[]> {
  return db.query<ParentalExtensionWithUser>(
    `SELECT ${WITH_USER_SELECT}
     FROM parental_leave_extensions x ${WITH_USER_JOIN}
     WHERE x.workspace_id = ? AND x.status = 'pending'
     ORDER BY x.created_at ASC
     LIMIT ?`,
    [workspaceId, limit],
  )
}

/** One member's own requests, newest first - what `/me/leave` shows them. */
export async function listExtensionsForUser(
  workspaceId: string,
  userId: string,
): Promise<ParentalExtension[]> {
  return db.query<ParentalExtension>(
    `SELECT * FROM parental_leave_extensions
     WHERE workspace_id = ? AND user_id = ?
     ORDER BY created_at DESC`,
    [workspaceId, userId],
  )
}

/**
 * Whether this case already has a request nobody has answered yet.
 *
 * Two pending extensions on one case would be two admins moving the same
 * `end_date` to two different values, and the second approval would silently
 * win. Only `pending` blocks: a rejected request is meant to be refiled, and an
 * approved one has already moved the date, so the next request extends from
 * there.
 */
export async function hasPendingExtensionForCase(
  workspaceId: string,
  caseId: string,
): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    `SELECT id FROM parental_leave_extensions
     WHERE workspace_id = ? AND case_id = ? AND status = 'pending'
     LIMIT 1`,
    [workspaceId, caseId],
  )
  return row !== null
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createParentalExtension(input: {
  workspaceId: string
  caseId: string
  userId: string
  previousEndDate: string
  requestedEndDate: string
  unpaidDays: number
  reason?: string | null
}): Promise<ParentalExtension> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO parental_leave_extensions (
       id, workspace_id, case_id, user_id, previous_end_date,
       requested_end_date, unpaid_days, reason, status
     ) VALUES (?,?,?,?,?,?,?,?,'pending')`,
    [
      id,
      input.workspaceId,
      input.caseId,
      input.userId,
      input.previousEndDate,
      input.requestedEndDate,
      input.unpaidDays,
      input.reason ?? null,
    ],
  )
  const created = await db.queryOne<ParentalExtension>(
    'SELECT * FROM parental_leave_extensions WHERE id = ?',
    [id],
  )
  if (!created) throw new Error(`createParentalExtension: failed to re-fetch ${id}`)
  return created
}

// ─── Action (the only mutation) ───────────────────────────────────────────────

export enum ParentalExtensionAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export type ActionParentalExtensionResult =
  | { updated: ParentalExtension }
  | { error: 'NOT_FOUND' | 'ALREADY_ACTIONED' }

/**
 * The approve / reject transition, copied in shape from `actionLeaveRequest()`
 * in ./leaves.ts because it is the same problem: two admins clearing the queue
 * at once must not both act on one row.
 *
 * `WHERE status = 'pending'` is what makes it atomic. `changes === 0` means
 * either the row does not exist or somebody else got there first, and the
 * follow-up read tells the two apart so the caller can answer 404 or 409.
 *
 * `unpaidDays` is applied only on approve, and only in this one statement - see
 * the file header for why the recomputation lands here rather than in a second
 * write.
 */
export async function actionParentalExtension(params: {
  id: string
  workspaceId: string
  action: ParentalExtensionAction
  actionedByUserId: string
  rejectionReason?: string | null
  /** The figure recomputed at approval time. Ignored on reject. */
  unpaidDays?: number
}): Promise<ActionParentalExtensionResult> {
  const approving = params.action === ParentalExtensionAction.APPROVE
  const newStatus: ParentalExtensionStatus = approving ? 'approved' : 'rejected'

  const sets = ['status = ?', 'actioned_by_user_id = ?', 'rejection_reason = ?']
  const values: unknown[] = [
    newStatus,
    params.actionedByUserId,
    approving ? null : (params.rejectionReason ?? null),
  ]
  if (approving && params.unpaidDays !== undefined) {
    sets.push('unpaid_days = ?')
    values.push(params.unpaidDays)
  }

  const { changes } = await db.execute(
    `UPDATE parental_leave_extensions
     SET ${sets.join(', ')}
     WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
    [...values, params.id, params.workspaceId],
  )

  if (changes === 0) {
    const existing = await db.queryOne<ParentalExtension>(
      'SELECT * FROM parental_leave_extensions WHERE id = ? AND workspace_id = ?',
      [params.id, params.workspaceId],
    )
    return existing ? { error: 'ALREADY_ACTIONED' } : { error: 'NOT_FOUND' }
  }

  const updated = await db.queryOne<ParentalExtension>(
    'SELECT * FROM parental_leave_extensions WHERE id = ?',
    [params.id],
  )
  return { updated: updated! }
}
