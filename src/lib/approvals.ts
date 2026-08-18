import { getPendingLeaveRequests, type PendingLeaveSummary } from './db/queries/leaves'
import { getPendingRegularizationRequests, type RegularizationRequestWithUser, type RegularizationType } from './db/queries/regularizations'

export type ApprovalItem =
  | {
      kind: 'leave'
      id: string
      user_full_name: string | null
      user_email: string
      leave_type_name: string
      start_date: string
      end_date: string
      days: number
    }
  | {
      kind: 'regularization'
      id: string
      user_full_name: string | null
      user_email: string
      target_date: string
      requested_type: RegularizationType
      reason: string
    }

/**
 * The single source of truth for "pending approvals" - reused by the Overview
 * dashboard widget, the dedicated Approvals page, and the People page section
 * so all three surfaces always agree with each other.
 */
export async function getPendingApprovalItems(
  workspaceId: string,
  opts?: { limit?: number; leavesEnabled?: boolean },
): Promise<{ leave: PendingLeaveSummary[]; regularization: RegularizationRequestWithUser[]; items: ApprovalItem[] }> {
  const [leave, regularization] = await Promise.all([
    opts?.leavesEnabled === false ? Promise.resolve([]) : getPendingLeaveRequests(workspaceId, opts?.limit ?? 100_000),
    getPendingRegularizationRequests(workspaceId, opts?.limit),
  ])

  const items: ApprovalItem[] = [
    ...leave.map((l): ApprovalItem => ({
      kind: 'leave',
      id: l.id,
      user_full_name: l.user_full_name,
      user_email: l.user_email,
      leave_type_name: l.leave_type_name,
      start_date: l.start_date,
      end_date: l.end_date,
      days: l.days,
    })),
    ...regularization.map((r): ApprovalItem => ({
      kind: 'regularization',
      id: r.id,
      user_full_name: r.user_full_name,
      user_email: r.user_email,
      target_date: r.target_date,
      requested_type: r.requested_type,
      reason: r.reason,
    })),
  ]

  return { leave, regularization, items }
}
