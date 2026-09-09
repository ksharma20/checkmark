import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { LeaveAction } from '@/lib/db/queries/leaves'
import { actionRegularizationRequest, RegularizationAction } from '@/lib/db/queries/regularizations'
import { getUserById } from '@/lib/db/queries/users'
import { getMaternityCase, updateMaternityCase } from '@/lib/db/queries/maternity'
import {
  actionParentalExtension,
  computeUnpaidExtensionDays,
  getParentalExtension,
  ParentalExtensionAction,
} from '@/lib/db/queries/parental-extensions'
import { wsApprovals } from '@/locales/en/ws-approvals'
import { parentalExtensionNotifications } from '@/locales/en/ws-parental'
import { notify } from '@/lib/notify'
import { actionLeaveAndNotify } from '@/lib/leave-action'
import { en } from '@/locales/en'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; kind: string; id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, kind, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Approvals, Action.Write)
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }
  // `doc` is deliberately absent: verifying a document means looking at the
  // file, so it is actioned from the employee record, not from a queue row.
  if (kind !== 'leave' && kind !== 'regularization' && kind !== 'extension') {
    return NextResponse.json({ error: 'Unknown approval kind', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: { action?: unknown; rejection_reason?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }
  const rejectionReason = typeof body.rejection_reason === 'string' ? body.rejection_reason.trim() : ''
  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json(
      { error: 'rejection_reason is required when rejecting', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  if (kind === 'leave') {
    // The transition and the employee notification are shared with
    // `PATCH /api/ws/[slug]/leaves/[id]`, which actions the same row behind a
    // different gate. Only the gate above and the response shape below belong
    // to this route; duplicating the notification block here is what used to
    // risk two different feed rows for one decision.
    const result = await actionLeaveAndNotify({
      id,
      workspaceId: ctx.workspace.id,
      workspaceSlug: slug,
      action: action === 'approve' ? LeaveAction.APPROVE : LeaveAction.REJECT,
      actionedByUserId: ctx.userId,
      rejectionReason,
    })
    if ('error' in result) {
      return NextResponse.json(
        result.error === 'NOT_FOUND'
          ? { error: 'Leave request not found', code: 'NOT_FOUND' }
          : { error: 'Leave request has already been actioned', code: 'ALREADY_ACTIONED' },
        { status: result.error === 'NOT_FOUND' ? 404 : 409 },
      )
    }

    return NextResponse.json({ leaveRequest: result.updated })
  }

  if (kind === 'extension') {
    return actionExtension({
      id,
      workspaceId: ctx.workspace.id,
      workspaceSlug: slug,
      workingDaysJson: ctx.workspace.working_days,
      actionedByUserId: ctx.userId,
      approve: action === 'approve',
      rejectionReason,
    })
  }

  // kind === 'regularization'
  const result = await actionRegularizationRequest({
    id,
    workspaceId: ctx.workspace.id,
    workspaceTimezone: ctx.workspace.display_timezone,
    action: action === 'approve' ? RegularizationAction.APPROVE : RegularizationAction.REJECT,
    actionedByUserId: ctx.userId,
    rejectionReason: action === 'reject' ? rejectionReason : null,
  })
  if ('error' in result) {
    return NextResponse.json(
      result.error === 'NOT_FOUND'
        ? { error: 'Regularization request not found', code: 'NOT_FOUND' }
        : { error: 'Regularization request has already been actioned', code: 'ALREADY_ACTIONED' },
      { status: result.error === 'NOT_FOUND' ? 404 : 409 },
    )
  }

  const employee = await getUserById(result.updated.user_id)
  if (employee) {
    const isApproved = action === 'approve'
    const notifType = isApproved ? 'regularization_approved' as const : 'regularization_rejected' as const
    const title = isApproved ? en.notifications.regularizationApprovedTitle : en.notifications.regularizationRejectedTitle
    const notifBody = isApproved
      ? en.notifications.regularizationApprovedBody(result.updated.target_date)
      : en.notifications.regularizationRejectedBody(result.updated.target_date)
    await notify({
      userIds: [result.updated.user_id],
      workspaceId: ctx.workspace.id,
      workspaceSlug: slug,
      type: notifType,
      title,
      body: notifBody,
      refId: result.updated.id,
      refType: 'regularization_request',
      push: { tag: `regularization-${notifType}-${result.updated.id}` },
    })
  }

  return NextResponse.json({ regularizationRequest: result.updated })
}

/**
 * The unpaid parental-leave extension branch.
 *
 * UNPAID is the whole point: approving one writes NO `leave_requests` row and
 * touches no balance. All it does besides marking the request is move the
 * case's `end_date` - which is also what extends the reminder gate, since
 * `getActiveParentalUserIds()` matches on dates rather than on status.
 *
 * The day count is RECOMPUTED here rather than trusted from the row. The figure
 * stored at submit time was computed against the holiday calendar as it stood
 * then, and an admin can add a company holiday inside the requested window
 * while the request sits in the queue; the number the workspace is held to is
 * the one true at the moment of approval, so that is the one written.
 *
 * ORDER: claim the transition FIRST, then move the case. `actionParentalExtension`
 * is atomic on `status = 'pending'`, so claiming first is what makes a second
 * admin's click a 409 instead of a second date move. A crash between the two
 * leaves an approved request whose case date has not moved - visible on the case
 * screen and fixable with the edit form - whereas the reverse order could extend
 * a case whose request another admin had just rejected.
 */
async function actionExtension(params: {
  id: string
  workspaceId: string
  workspaceSlug: string
  workingDaysJson: string | null
  actionedByUserId: string
  approve: boolean
  rejectionReason: string
}) {
  const existing = await getParentalExtension(params.id, params.workspaceId)
  if (!existing) {
    return NextResponse.json(
      { error: wsApprovals.extensionNotFound, code: 'NOT_FOUND' },
      { status: 404 },
    )
  }
  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: wsApprovals.extensionAlreadyActioned, code: 'ALREADY_ACTIONED' },
      { status: 409 },
    )
  }

  let unpaidDays: number | undefined
  let parentalCase: Awaited<ReturnType<typeof getMaternityCase>> = null

  if (params.approve) {
    parentalCase = await getMaternityCase(existing.case_id, params.workspaceId)
    if (!parentalCase || !parentalCase.end_date) {
      return NextResponse.json(
        { error: wsApprovals.extensionCaseMissing, code: 'CASE_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (existing.requested_end_date <= parentalCase.end_date) {
      return NextResponse.json(
        { error: wsApprovals.extensionNotAnExtension, code: 'NOT_AN_EXTENSION' },
        { status: 409 },
      )
    }
    unpaidDays = await computeUnpaidExtensionDays({
      workspaceId: params.workspaceId,
      currentEndDate: parentalCase.end_date,
      requestedEndDate: existing.requested_end_date,
      workingDaysJson: params.workingDaysJson,
    })
  }

  const result = await actionParentalExtension({
    id: params.id,
    workspaceId: params.workspaceId,
    action: params.approve ? ParentalExtensionAction.APPROVE : ParentalExtensionAction.REJECT,
    actionedByUserId: params.actionedByUserId,
    rejectionReason: params.approve ? null : params.rejectionReason,
    unpaidDays,
  })
  if ('error' in result) {
    return NextResponse.json(
      result.error === 'NOT_FOUND'
        ? { error: wsApprovals.extensionNotFound, code: 'NOT_FOUND' }
        : { error: wsApprovals.extensionAlreadyActioned, code: 'ALREADY_ACTIONED' },
      { status: result.error === 'NOT_FOUND' ? 404 : 409 },
    )
  }

  if (params.approve && parentalCase) {
    await updateMaternityCase(parentalCase.id, params.workspaceId, {
      end_date: result.updated.requested_end_date,
    })
  }

  await notify({
    userIds: [result.updated.user_id],
    workspaceId: params.workspaceId,
    workspaceSlug: params.workspaceSlug,
    type: params.approve ? 'extension_approved' : 'extension_rejected',
    title: params.approve
      ? parentalExtensionNotifications.approvedTitle
      : parentalExtensionNotifications.rejectedTitle,
    body: params.approve
      ? parentalExtensionNotifications.approvedBody(result.updated.requested_end_date)
      : parentalExtensionNotifications.rejectedBody(params.rejectionReason),
    refId: result.updated.id,
    refType: 'parental_extension',
    push: { tag: `extension-${params.approve ? 'approved' : 'rejected'}-${result.updated.id}` },
  })

  return NextResponse.json({ extension: result.updated })
}
