import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { actionLeaveRequest, getLeaveTypeById, LeaveAction } from '@/lib/db/queries/leaves'
import { getUserById } from '@/lib/db/queries/users'
import { createNotification } from '@/lib/db/queries/notifications'
import { sendPushToUser } from '@/lib/push'
import { en } from '@/locales/en'

interface Props { params: Promise<{ slug: string; id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  let body: { action?: unknown; rejection_reason?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const action = body.action
  if (action !== LeaveAction.APPROVE && action !== LeaveAction.REJECT) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const rejectionReason =
    typeof body.rejection_reason === 'string' ? body.rejection_reason.trim() : ''

  if (action === LeaveAction.REJECT && !rejectionReason) {
    return NextResponse.json(
      { error: 'rejection_reason is required when rejecting', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const result = await actionLeaveRequest({
    id,
    workspaceId: ctx.workspace.id,
    action,
    actionedByUserId: ctx.userId,
    rejectionReason: action === LeaveAction.REJECT ? rejectionReason : null,
  })

  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Leave request not found', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }
    return NextResponse.json(
      { error: 'Leave request has already been actioned', code: 'ALREADY_ACTIONED' },
      { status: 409 },
    )
  }

  const [employee, leaveType] = await Promise.all([
    getUserById(result.updated.user_id),
    getLeaveTypeById(result.updated.leave_type_id, ctx.workspace.id),
  ])

  // Notify the requesting employee (leaveType may be null if soft-deleted — use fallback name)
  if (employee) {
    const leaveTypeName = leaveType?.name ?? 'Leave'
    const isApproved = action === LeaveAction.APPROVE
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

  return NextResponse.json({
    leaveRequest: result.updated,
    employee: employee ? { id: employee.id, email: employee.email, full_name: employee.full_name } : null,
    leaveType: leaveType ? { id: leaveType.id, name: leaveType.name } : null,
  })
}
