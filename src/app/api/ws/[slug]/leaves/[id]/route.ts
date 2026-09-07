import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { LeaveAction } from '@/lib/db/queries/leaves'
import { actionLeaveAndNotify } from '@/lib/leave-action'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── PATCH /api/ws/[slug]/leaves/[id] ────────────────────────────────────────
// The leave screen's approve/reject. The approvals queue actions the same row
// through `/api/ws/[slug]/approvals/leave/[id]`, gated on a different resource.
//
// This route owns only the gate and the response shape. The transition and the
// employee notification live in `actionLeaveAndNotify()`, shared with that
// route, so the two cannot drift into emitting two different feed rows for the
// same decision.

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Leaves, Action.Write)
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

  const result = await actionLeaveAndNotify({
    id,
    workspaceId: ctx.workspace.id,
    workspaceSlug: slug,
    action,
    actionedByUserId: ctx.userId,
    rejectionReason,
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

  return NextResponse.json({
    leaveRequest: result.updated,
    employee: result.employee,
    leaveType: result.leaveType,
  })
}
