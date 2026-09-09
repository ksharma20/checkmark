import { db } from '../index'
import { countWorkdays, nextDateKey } from '@/lib/attendance-summary'

export type AccrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
export type CreditTiming = 'start' | 'end'

export interface LeaveType {
  id: string
  workspace_id: string
  name: string
  accrual_frequency: AccrualFrequency
  accrual_credits: number
  credit_timing: CreditTiming
  created_at: string
  deleted_at: string | null
}

export interface LeaveRequest {
  id: string
  workspace_id: string
  user_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
  actioned_by_user_id: string | null
  created_at: string
}

export interface LeaveTypeWithBalance extends LeaveType {
  available_days: number
  total_accrued: number
  used_days: number
  opening_balance: number
}

export interface LeaveOpeningBalance {
  id: string
  workspace_id: string
  user_id: string
  leave_type_id: string
  balance_days: number
  note: string | null
  created_at: string
  updated_at: string
}

export async function getWorkspaceLeaveTypes(workspaceId: string): Promise<LeaveType[]> {
  return db.query<LeaveType>(
    `SELECT * FROM workspace_leave_types
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId],
  )
}

export async function getLeaveTypeById(id: string, workspaceId: string): Promise<LeaveType | null> {
  return db.queryOne<LeaveType>(
    'SELECT * FROM workspace_leave_types WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
}

export async function createLeaveType(params: {
  workspaceId: string
  name: string
  accrualFrequency: AccrualFrequency
  creditTiming: CreditTiming
  accrualCredits: number
}): Promise<LeaveType> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_leave_types (id, workspace_id, name, accrual_frequency, accrual_credits, credit_timing)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.name, params.accrualFrequency, params.accrualCredits, params.creditTiming],
  )
  const row = await db.queryOne<LeaveType>('SELECT * FROM workspace_leave_types WHERE id = ?', [id])
  if (!row) throw new Error('Leave type insert succeeded but row not found')
  return row
}

/**
 * Partial update of a leave type.
 *
 * The `'key' in input` idiom (as `updateAsset` / `updateMaternityCase` use)
 * distinguishes "set this column" from "leave it alone", so a caller sending
 * only `name` cannot silently reset the accrual settings to defaults.
 *
 * NOTE FOR CALLERS: no balance is materialised anywhere. `getLeaveTypesWithBalance`
 * recomputes `opening_balance + total_accrued - used_days` on every read from
 * `accrual_frequency`, `accrual_credits` and `credit_timing`, so editing any of
 * those three retroactively changes the available balance of EVERY member in
 * the workspace. Renaming is inert; the other three are not.
 */
export async function updateLeaveType(
  id: string,
  workspaceId: string,
  input: {
    name?: string
    accrual_frequency?: AccrualFrequency
    accrual_credits?: number
    credit_timing?: CreditTiming
  },
): Promise<LeaveType | null> {
  const sets: string[] = []
  const values: unknown[] = []

  if ('name' in input) { sets.push('name = ?'); values.push(input.name) }
  if ('accrual_frequency' in input) { sets.push('accrual_frequency = ?'); values.push(input.accrual_frequency) }
  if ('accrual_credits' in input) { sets.push('accrual_credits = ?'); values.push(input.accrual_credits) }
  if ('credit_timing' in input) { sets.push('credit_timing = ?'); values.push(input.credit_timing) }

  if (sets.length === 0) return getLeaveTypeById(id, workspaceId)

  values.push(id, workspaceId)
  const result = await db.execute(
    `UPDATE workspace_leave_types SET ${sets.join(', ')}
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    values,
  )
  if (result.changes === 0) return null
  return getLeaveTypeById(id, workspaceId)
}

export async function softDeleteLeaveType(id: string, workspaceId: string): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    'SELECT id FROM workspace_leave_types WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL',
    [id, workspaceId],
  )
  if (!row) return false
  await db.execute(
    `UPDATE workspace_leave_types SET deleted_at = datetime('now') WHERE id = ? AND workspace_id = ?`,
    [id, workspaceId],
  )
  return true
}

export async function getUsedLeaveDays(
  workspaceId: string,
  userId: string,
  leaveTypeId: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
): Promise<number> {
  const rows = await db.query<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM leave_requests
     WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ? AND status = 'approved'`,
    [workspaceId, userId, leaveTypeId],
  )
  return rows.reduce((sum, r) => {
    return sum + countWorkdays(r.start_date, r.end_date, undefined, workingDays)
  }, 0)
}

const PERIOD_MONTHS: Record<AccrualFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
}

// Pro-rata accrual based on DOJ:
//   • First period: credits × (days_remaining_in_period / total_days_in_period)
//   • 'start' timing: first-period credits available immediately; each subsequent
//     period's credits available at its start (front-loaded).
//   • 'end' timing: credits available only after completing each period (back-loaded).
function computeTotalAccrued(
  joinedAt: string,
  frequency: AccrualFrequency,
  accrualCredits: number,
  creditTiming: CreditTiming,
): number {
  const normalized = joinedAt.includes('T') ? joinedAt : joinedAt.replace(' ', 'T') + 'Z'
  const joined = new Date(normalized)
  const now = new Date()
  if (now < joined) return 0

  const periodMonths = PERIOD_MONTHS[frequency]
  const joinYear = joined.getFullYear()
  const joinMonth = joined.getMonth() // 0-indexed

  // Align first period to calendar boundaries:
  // quarterly  → Jan/Apr/Jul/Oct  (floor(m/3)*3)
  // half-yearly → Jan/Jul          (floor(m/6)*6)
  // yearly      → Jan              (floor(m/12)*12 = 0)
  // monthly     → unchanged        (floor(m/1)*1 = m)
  const periodIndex = Math.floor(joinMonth / periodMonths)
  const firstPeriodStart = new Date(joinYear, periodIndex * periodMonths, 1)
  const secondPeriodStart = new Date(joinYear, periodIndex * periodMonths + periodMonths, 1)

  // Pro-rata fraction for first period
  const totalMsInFirstPeriod = secondPeriodStart.getTime() - firstPeriodStart.getTime()
  const workedMsInFirstPeriod = secondPeriodStart.getTime() - joined.getTime()
  const proRataFraction = Math.min(1, Math.max(0, workedMsInFirstPeriod / totalMsInFirstPeriod))
  const firstPeriodCredits = accrualCredits * proRataFraction

  const round1 = (n: number) => Math.round(n * 10) / 10

  if (creditTiming === 'start') {
    // First period: available immediately on DOJ
    if (now < secondPeriodStart) return round1(firstPeriodCredits)

    // Full periods started since secondPeriodStart (current in-progress counts too → +1)
    const monthsSinceSecondPeriod = (now.getFullYear() - secondPeriodStart.getFullYear()) * 12 +
      (now.getMonth() - secondPeriodStart.getMonth())
    const periodsStarted = Math.floor(monthsSinceSecondPeriod / periodMonths) + 1
    return round1(firstPeriodCredits + periodsStarted * accrualCredits)
  } else {
    // 'end': credits available after completing each period
    if (now < secondPeriodStart) return 0 // first period not yet done

    const monthsSinceSecondPeriod = (now.getFullYear() - secondPeriodStart.getFullYear()) * 12 +
      (now.getMonth() - secondPeriodStart.getMonth())
    const periodsCompleted = Math.floor(monthsSinceSecondPeriod / periodMonths)
    return round1(firstPeriodCredits + periodsCompleted * accrualCredits)
  }
}

export async function getLeaveTypesWithBalance(
  workspaceId: string,
  userId: string,
  memberJoinedAt: string,
  workingDays: number[] = [1, 2, 3, 4, 5],
  cutoverDate?: string | null,
): Promise<LeaveTypeWithBalance[]> {
  const types = await getWorkspaceLeaveTypes(workspaceId)
  return Promise.all(
    types.map(async (t) => {
      const obRecord = await getOpeningBalance(workspaceId, userId, t.id)
      const openingDays = obRecord?.balance_days ?? 0
      // If workspace has a cutover date that is later than the member's join date,
      // use it as the accrual start for ALL leave types (Venzio takes over from that date).
      // Opening balance is independent — it applies regardless of cutover logic.
      const memberDateOnly = memberJoinedAt.slice(0, 10)
      const accrualStart = cutoverDate && cutoverDate > memberDateOnly ? cutoverDate : memberJoinedAt
      const totalAccrued = computeTotalAccrued(accrualStart, t.accrual_frequency, t.accrual_credits, t.credit_timing)
      const usedDays = await getUsedLeaveDays(workspaceId, userId, t.id, workingDays)
      return {
        ...t,
        opening_balance: openingDays,
        total_accrued: totalAccrued,
        used_days: usedDays,
        available_days: Math.max(0, openingDays + totalAccrued - usedDays),
      }
    }),
  )
}

export async function getOpeningBalance(
  workspaceId: string,
  userId: string,
  leaveTypeId: string,
): Promise<LeaveOpeningBalance | null> {
  return db.queryOne<LeaveOpeningBalance>(
    `SELECT * FROM leave_opening_balances
     WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ?`,
    [workspaceId, userId, leaveTypeId],
  )
}

export async function getMemberOpeningBalances(
  workspaceId: string,
  userId: string,
): Promise<LeaveOpeningBalance[]> {
  return db.query<LeaveOpeningBalance>(
    `SELECT * FROM leave_opening_balances
     WHERE workspace_id = ? AND user_id = ?
     ORDER BY created_at ASC`,
    [workspaceId, userId],
  )
}

export async function getAllOpeningBalances(workspaceId: string): Promise<
  (LeaveOpeningBalance & { user_email: string; user_full_name: string | null; leave_type_name: string; member_record_id: string })[]
> {
  return db.query(
    `SELECT lob.*,
            u.email AS user_email,
            u.full_name AS user_full_name,
            wlt.name AS leave_type_name,
            wm.id AS member_record_id
     FROM leave_opening_balances lob
     JOIN users u ON u.id = lob.user_id
     JOIN workspace_leave_types wlt ON wlt.id = lob.leave_type_id
     JOIN workspace_members wm ON wm.workspace_id = lob.workspace_id AND wm.user_id = lob.user_id
     WHERE lob.workspace_id = ?
       AND u.deleted_at IS NULL
       AND wlt.deleted_at IS NULL
     ORDER BY u.email ASC, wlt.name ASC`,
    [workspaceId],
  )
}

export async function upsertOpeningBalance(params: {
  workspaceId: string
  userId: string
  leaveTypeId: string
  balanceDays: number
  note?: string | null
}): Promise<LeaveOpeningBalance> {
  const existing = await getOpeningBalance(params.workspaceId, params.userId, params.leaveTypeId)
  if (existing) {
    await db.execute(
      `UPDATE leave_opening_balances
       SET balance_days = ?, note = ?, updated_at = datetime('now')
       WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ?`,
      [params.balanceDays, params.note ?? null, params.workspaceId, params.userId, params.leaveTypeId],
    )
  } else {
    const id = crypto.randomUUID().replace(/-/g, '')
    await db.execute(
      `INSERT INTO leave_opening_balances (id, workspace_id, user_id, leave_type_id, balance_days, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, params.workspaceId, params.userId, params.leaveTypeId, params.balanceDays, params.note ?? null],
    )
  }
  const row = await getOpeningBalance(params.workspaceId, params.userId, params.leaveTypeId)
  if (!row) throw new Error('Opening balance upsert succeeded but row not found')
  return row
}

export async function bulkUpsertOpeningBalances(
  items: { workspaceId: string; userId: string; leaveTypeId: string; balanceDays: number; note?: string | null }[],
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0
  const errors: string[] = []
  for (const item of items) {
    try {
      await upsertOpeningBalance(item)
      imported++
    } catch (err) {
      errors.push(`Failed for user ${item.userId} / type ${item.leaveTypeId}: ${(err as Error).message}`)
    }
  }
  return { imported, errors }
}

export interface LeaveRequestWithType extends LeaveRequest {
  leave_type_name: string
}

export interface AdminLeaveRequest extends LeaveRequest {
  leave_type_name: string
  user_full_name: string | null
  user_email: string
}

export async function getWorkspaceLeaveRequests(
  workspaceId: string,
): Promise<AdminLeaveRequest[]> {
  return db.query<AdminLeaveRequest>(
    `SELECT lr.*,
            wlt.name  AS leave_type_name,
            u.full_name AS user_full_name,
            u.email   AS user_email
     FROM leave_requests lr
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     JOIN users u ON u.id = lr.user_id
     WHERE lr.workspace_id = ?
     ORDER BY lr.start_date DESC`,
    [workspaceId],
  )
}

export async function getUserLeaveRequests(
  workspaceId: string,
  userId: string,
): Promise<LeaveRequestWithType[]> {
  return db.query<LeaveRequestWithType>(
    `SELECT lr.*, wlt.name AS leave_type_name
     FROM leave_requests lr
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     WHERE lr.workspace_id = ? AND lr.user_id = ?
     ORDER BY lr.start_date DESC`,
    [workspaceId, userId],
  )
}

export async function hasOverlappingLeaveRequest(
  workspaceId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM leave_requests
     WHERE workspace_id = ? AND user_id = ? AND status IN ('approved', 'pending')
       AND start_date <= ? AND end_date >= ?`,
    [workspaceId, userId, endDate, startDate],
  )
  return (row?.cnt ?? 0) > 0
}

export async function getPendingLeaveCount(workspaceId: string): Promise<number> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM leave_requests
     WHERE workspace_id = ? AND status = 'pending'`,
    [workspaceId],
  )
  return row?.cnt ?? 0
}

export async function getLeaveRequestsInRange(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<{ user_id: string; start_date: string; end_date: string }[]> {
  return db.query(
    `SELECT user_id, start_date, end_date FROM leave_requests
     WHERE workspace_id = ?
       AND status = 'approved'
       AND start_date <= ?
       AND end_date >= ?`,
    [workspaceId, endDate, startDate],
  )
}

/**
 * The dates in `[startDate, endDate]` on which this member's leave blocks a
 * correction request.
 *
 * The status set is `('approved', 'pending')` and it MUST stay identical to
 * `hasOverlappingLeaveRequest()` above, which is what the POST
 * `/api/me/ws/[slug]/regularizations` guard actually refuses on. This exists
 * precisely so the correction form can leave those days out of its picker:
 * reusing `getLeaveRequestsInRange()` - approved-only - would offer a day whose
 * leave is still pending and then have the server answer `ON_LEAVE`.
 */
export async function getUserLeaveDatesInRange(
  workspaceId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const rows = await db.query<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM leave_requests
     WHERE workspace_id = ? AND user_id = ?
       AND status IN ('approved', 'pending')
       AND start_date <= ? AND end_date >= ?`,
    [workspaceId, userId, endDate, startDate],
  )

  const dates = new Set<string>()
  for (const row of rows) {
    // Clamp to the requested window - a request may run well past either end.
    const from = row.start_date > startDate ? row.start_date : startDate
    const to = row.end_date < endDate ? row.end_date : endDate
    for (let date = from; date <= to; date = nextDateKey(date)) dates.add(date)
  }
  return dates
}

export interface MemberOnLeaveToday {
  user_id: string
  full_name: string | null
  email: string
  leave_type_name: string
}

export async function getMembersOnLeaveToday(workspaceId: string, date: string): Promise<MemberOnLeaveToday[]> {
  return db.query<MemberOnLeaveToday>(
    `SELECT lr.user_id, u.full_name, u.email, wlt.name AS leave_type_name
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     WHERE lr.workspace_id = ?
       AND lr.status = 'approved'
       AND lr.start_date <= ?
       AND lr.end_date >= ?
       AND u.deleted_at IS NULL
     ORDER BY u.full_name ASC`,
    [workspaceId, date, date],
  )
}

export interface PendingLeaveSummary {
  id: string
  user_full_name: string | null
  user_email: string
  leave_type_name: string
  start_date: string
  end_date: string
  days: number
}

export async function getPendingLeaveRequests(
  workspaceId: string,
  limit = 5,
): Promise<PendingLeaveSummary[]> {
  return db.query<PendingLeaveSummary>(
    `SELECT lr.id, u.full_name AS user_full_name, u.email AS user_email,
            wlt.name AS leave_type_name, lr.start_date, lr.end_date,
            CAST(julianday(lr.end_date) - julianday(lr.start_date) + 1 AS INTEGER) AS days
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     JOIN workspace_leave_types wlt ON wlt.id = lr.leave_type_id
     WHERE lr.workspace_id = ? AND lr.status = 'pending'
     ORDER BY lr.created_at ASC
     LIMIT ?`,
    [workspaceId, limit],
  )
}

export async function createLeaveRequest(params: {
  workspaceId: string
  userId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string | null
}): Promise<LeaveRequest> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO leave_requests
       (id, workspace_id, user_id, leave_type_id, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      params.workspaceId,
      params.userId,
      params.leaveTypeId,
      params.startDate,
      params.endDate,
      params.reason ?? null,
    ],
  )
  const row = await db.queryOne<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [id])
  if (!row) throw new Error('Leave request insert succeeded but row not found')
  return row
}

export async function getLeaveRequestById(
  id: string,
  workspaceId: string,
): Promise<LeaveRequest | null> {
  return db.queryOne<LeaveRequest>(
    'SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?',
    [id, workspaceId],
  )
}

export enum LeaveAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export type ActionLeaveError = 'NOT_FOUND' | 'ALREADY_ACTIONED'
export type ActionLeaveResult =
  | { updated: LeaveRequest }
  | { error: ActionLeaveError }

export async function actionLeaveRequest(params: {
  id: string
  workspaceId: string
  action: LeaveAction
  actionedByUserId: string
  rejectionReason?: string | null
}): Promise<ActionLeaveResult> {
  const newStatus = params.action === LeaveAction.APPROVE ? 'approved' : 'rejected'
  // Atomic: WHERE status='pending' prevents concurrent double-actions.
  // changes === 0 means either the row doesn't exist or was already actioned.
  const { changes } = await db.execute(
    `UPDATE leave_requests
     SET status = ?, actioned_by_user_id = ?, rejection_reason = ?
     WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
    [newStatus, params.actionedByUserId, params.rejectionReason ?? null, params.id, params.workspaceId],
  )
  if (changes === 0) {
    const existing = await db.queryOne<LeaveRequest>(
      'SELECT * FROM leave_requests WHERE id = ? AND workspace_id = ?',
      [params.id, params.workspaceId],
    )
    return existing ? { error: 'ALREADY_ACTIONED' } : { error: 'NOT_FOUND' }
  }
  const updated = await db.queryOne<LeaveRequest>(
    'SELECT * FROM leave_requests WHERE id = ?',
    [params.id],
  )
  return { updated: updated! }
}
