import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { LeaveAction } from '@/lib/db/queries/leaves'
import { actionRegularizationRequest, RegularizationAction } from '@/lib/db/queries/regularizations'
import { getUserById } from '@/lib/db/queries/users'
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
  if (kind !== 'leave' && kind !== 'regularization') {
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
