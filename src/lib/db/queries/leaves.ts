import { db } from '../index'
import { MS_PER_DAY } from '@/lib/constants'

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
  created_at: string
}

export interface LeaveTypeWithBalance extends LeaveType {
  available_days: number
  total_accrued: number
  used_days: number
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
): Promise<number> {
  const rows = await db.query<{ start_date: string; end_date: string }>(
    `SELECT start_date, end_date FROM leave_requests
     WHERE workspace_id = ? AND user_id = ? AND leave_type_id = ? AND status = 'approved'`,
    [workspaceId, userId, leaveTypeId],
  )
  return rows.reduce((sum, r) => {
    const start = new Date(r.start_date + 'T00:00:00Z')
    const end = new Date(r.end_date + 'T00:00:00Z')
    return sum + Math.max(1, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1)
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

  // First period: 1st of join-month → 1st of (join-month + periodMonths)
  const firstPeriodStart = new Date(joinYear, joinMonth, 1)
  const secondPeriodStart = new Date(joinYear, joinMonth + periodMonths, 1) // exclusive end of first period

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
): Promise<LeaveTypeWithBalance[]> {
  const types = await getWorkspaceLeaveTypes(workspaceId)
  return Promise.all(
    types.map(async (t) => {
      const totalAccrued = computeTotalAccrued(memberJoinedAt, t.accrual_frequency, t.accrual_credits, t.credit_timing)
      const usedDays = await getUsedLeaveDays(workspaceId, userId, t.id)
      return {
        ...t,
        total_accrued: totalAccrued,
        used_days: usedDays,
        available_days: Math.max(0, totalAccrued - usedDays),
      }
    }),
  )
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
     WHERE workspace_id = ? AND user_id = ? AND status = 'approved'
       AND start_date <= ? AND end_date >= ?`,
    [workspaceId, userId, endDate, startDate],
  )
  return (row?.cnt ?? 0) > 0
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
       (id, workspace_id, user_id, leave_type_id, start_date, end_date, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
