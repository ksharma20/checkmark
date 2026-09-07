import {
  actionLeaveRequest,
  getLeaveTypeById,
  LeaveAction,
  type ActionLeaveError,
  type LeaveRequest,
  type LeaveType,
} from '@/lib/db/queries/leaves'
import { getUserById } from '@/lib/db/queries/users'
import { notify } from '@/lib/notify'
import { en } from '@/locales/en'

/**
 * Approve or reject a leave request, and tell the employee about it. Once.
 *
 * Two URLs action a leave: `PATCH /api/ws/[slug]/leaves/[id]` (the leave screen,
 * gated on `Resource.Leaves`) and `PATCH /api/ws/[slug]/approvals/leave/[id]`
 * (the unified approvals queue, gated on `Resource.Approvals`). Both are real
 * and both stay - they are different screens answering to different
 * permissions. What was duplicated was everything *after* the decision: each
 * route had its own copy of the notification + push block, so the same edit had
 * to be made twice and a divergence between them would show up as two different
 * feed rows for the same event depending on which screen the admin used.
 *
 * The gate stays in the route (it is the thing that differs); the transition
 * and the announcement live here (they are the thing that must not).
 *
 * `actionLeaveRequest()` is still what enforces the invariant that a leave row
 * only ever leaves `pending` once - the UPDATE carries `WHERE status = 'pending'`
 * - so a second caller racing the first gets `ALREADY_ACTIONED` and this
 * function returns before a single notification is written. That, not any check
 * here, is why only one feed row can result.
 */

export interface LeaveActionInput {
  id: string
  workspaceId: string
  /** Needed only to build the notification's destination URL. */
  workspaceSlug: string
  action: LeaveAction
  actionedByUserId: string
  rejectionReason: string | null
}

export interface LeaveActionSuccess {
  updated: LeaveRequest
  /** NULL when the requester's account has since been soft-deleted. */
  employee: { id: string; email: string; full_name: string | null } | null
  /** NULL when the leave type has since been soft-deleted. */
  leaveType: Pick<LeaveType, 'id' | 'name'> | null
}

export type LeaveActionOutcome = LeaveActionSuccess | { error: ActionLeaveError }

export async function actionLeaveAndNotify(input: LeaveActionInput): Promise<LeaveActionOutcome> {
  const result = await actionLeaveRequest({
    id: input.id,
    workspaceId: input.workspaceId,
    action: input.action,
    actionedByUserId: input.actionedByUserId,
    rejectionReason: input.action === LeaveAction.REJECT ? input.rejectionReason : null,
  })

  if ('error' in result) return { error: result.error }

  const [employee, leaveType] = await Promise.all([
    getUserById(result.updated.user_id),
    getLeaveTypeById(result.updated.leave_type_id, input.workspaceId),
  ])

  // No account to notify (soft-deleted user) - the transition still stands.
  if (employee) {
    const isApproved = input.action === LeaveAction.APPROVE
    const notifType = isApproved ? ('leave_approved' as const) : ('leave_rejected' as const)
    // The type may have been soft-deleted since the request was filed; the
    // employee still needs to be told what happened to it.
    const leaveTypeName = leaveType?.name ?? 'Leave'
    const title = isApproved ? en.notifications.leaveApprovedTitle : en.notifications.leaveRejectedTitle
    const body = isApproved
      ? en.notifications.leaveApprovedBody(leaveTypeName, result.updated.start_date, result.updated.end_date)
      : en.notifications.leaveRejectedBody(leaveTypeName, result.updated.start_date, result.updated.end_date)
    // `notify()` owns the destination URL and the allSettled containment that
    // used to be written out here - a dead push subscription (or, in dev,
    // missing VAPID keys) still must not take the in-app row down with it, nor
    // fail the request: the leave is already actioned in the database.
    await notify({
      userIds: [result.updated.user_id],
      workspaceId: input.workspaceId,
      workspaceSlug: input.workspaceSlug,
      type: notifType,
      title,
      body,
      refId: result.updated.id,
      refType: 'leave_request',
      push: { tag: `leave-${notifType}-${result.updated.id}` },
    })
  }

  return {
    updated: result.updated,
    employee: employee ? { id: employee.id, email: employee.email, full_name: employee.full_name } : null,
    leaveType: leaveType ? { id: leaveType.id, name: leaveType.name } : null,
  }
}
