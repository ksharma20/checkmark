import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { MS_PER_DAY } from '@/lib/constants'
import { getHolidaysInRange } from '@/lib/db/queries/holidays'
import {
  getLeaveTypeById,
  getLeaveTypesWithBalance,
  hasOverlappingLeaveRequest,
  createLeaveRequest,
} from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { workspace, userId, member } = ctx

  let body: {
    leave_type_id?: unknown
    start_date?: unknown
    end_date?: unknown
    reason?: unknown
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const leaveTypeId = typeof body.leave_type_id === 'string' ? body.leave_type_id.trim() : ''
  const startDate = typeof body.start_date === 'string' ? body.start_date.trim() : ''
  const endDate = typeof body.end_date === 'string' ? body.end_date.trim() : ''

  if (!leaveTypeId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'leave_type_id, start_date, and end_date are required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return NextResponse.json(
      { error: 'Dates must be in YYYY-MM-DD format', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: 'end_date must be on or after start_date', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const overlaps = await hasOverlappingLeaveRequest(workspace.id, userId, startDate, endDate)
  if (overlaps) {
    return NextResponse.json(
      { error: 'You already have a leave request covering these dates.', code: 'OVERLAPPING_LEAVE' },
      { status: 409 },
    )
  }

  const conflictingHolidays = await getHolidaysInRange(workspace.id, startDate, endDate)
  if (conflictingHolidays.length > 0) {
    const names = conflictingHolidays.map((h) => h.name).join(', ')
    return NextResponse.json(
      {
        error: `Leave cannot be applied on company holidays: ${names}.`,
        code: 'ON_HOLIDAY',
      },
      { status: 400 },
    )
  }

  const leaveType = await getLeaveTypeById(leaveTypeId, workspace.id)
  if (!leaveType) {
    return NextResponse.json({ error: 'Leave type not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const typesWithBalance = await getLeaveTypesWithBalance(workspace.id, userId, member.added_at)
  const typeBalance = typesWithBalance.find((t) => t.id === leaveTypeId)
  const requestedDays =
    Math.floor(
      (new Date(endDate + 'T00:00:00Z').getTime() -
        new Date(startDate + 'T00:00:00Z').getTime()) /
        MS_PER_DAY,
    ) + 1

  if (!typeBalance || requestedDays > typeBalance.available_days) {
    return NextResponse.json(
      {
        error: `Insufficient leave balance. Requested ${requestedDays} day(s), available ${typeBalance?.available_days ?? 0}.`,
        code: 'INSUFFICIENT_BALANCE',
      },
      { status: 400 },
    )
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null

  const leaveRequest = await createLeaveRequest({
    workspaceId: workspace.id,
    userId,
    leaveTypeId,
    startDate,
    endDate,
    reason,
  })

  return NextResponse.json({ leaveRequest }, { status: 201 })
}
