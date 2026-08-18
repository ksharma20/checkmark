import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { actionLeaveRequest, getLeaveTypeById, LeaveAction } from '@/lib/db/queries/leaves'
import { actionRegularizationRequest, RegularizationAction } from '@/lib/db/queries/regularizations'
import { getUserById } from '@/lib/db/queries/users'
import { createNotification } from '@/lib/db/queries/notifications'
import { sendPushToUser } from '@/lib/push'
import { en } from '@/locales/en'

interface Props { params: Promise<{ slug: string; kind: string; id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, kind, id } = await params
  const ctx = await requireWsAdmin(req, slug)
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
    const result = await actionLeaveRequest({
      id,
      workspaceId: ctx.workspace.id,
      action: action === 'approve' ? LeaveAction.APPROVE : LeaveAction.REJECT,
      actionedByUserId: ctx.userId,
      rejectionReason: action === 'reject' ? rejectionReason : null,
    })
    if ('error' in result) {
      return NextResponse.json(
        result.error === 'NOT_FOUND'
          ? { error: 'Leave request not found', code: 'NOT_FOUND' }
          : { error: 'Leave request has already been actioned', code: 'ALREADY_ACTIONED' },
        { status: result.error === 'NOT_FOUND' ? 404 : 409 },
      )
    }

    const [employee, leaveType] = await Promise.all([
      getUserById(result.updated.user_id),
      getLeaveTypeById(result.updated.leave_type_id, ctx.workspace.id),
    ])
    if (employee) {
      const leaveTypeName = leaveType?.name ?? 'Leave'
      const isApproved = action === 'approve'
      const notifType = isApproved ? 'leave_approved' as const : 'leave_rejected' as const
      const title = isApproved ? en.notifications.leaveApprovedTitle : en.notifications.leaveRejectedTitle
      const notifBody = isApproved
        ? en.notifications.leaveApprovedBody(leaveTypeName, result.updated.start_date, result.updated.end_date)
        : en.notifications.leaveRejectedBody(leaveTypeName, result.updated.start_date, result.updated.end_date)
      await Promise.allSettled([
        createNotification({ userId: result.updated.user_id, workspaceId: ctx.workspace.id, type: notifType, title, body: notifBody, refId: result.updated.id, refType: 'leave_request' }),
        sendPushToUser(result.updated.user_id, { title, body: notifBody, tag: `leave-${notifType}-${result.updated.id}` }),
      ])
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
    await Promise.allSettled([
      createNotification({ userId: result.updated.user_id, workspaceId: ctx.workspace.id, type: notifType, title, body: notifBody, refId: result.updated.id, refType: 'regularization_request' }),
      sendPushToUser(result.updated.user_id, { title, body: notifBody, tag: `regularization-${notifType}-${result.updated.id}` }),
    ])
  }

  return NextResponse.json({ regularizationRequest: result.updated })
}
