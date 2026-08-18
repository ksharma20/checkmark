import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { nextDateKey, isWorkday } from '@/lib/attendance-summary'
import { historyStartDate } from '@/lib/plans'
import { getHolidaysInRange } from '@/lib/db/queries/holidays'
import { hasOverlappingLeaveRequest } from '@/lib/db/queries/leaves'
import {
  createRegularizationRequest,
  getUserRegularizationRequests,
  hasPendingOrApprovedRegularization,
  type RegularizationType,
} from '@/lib/db/queries/regularizations'
import { getUserById, getRateLimitCount, recordRateLimitHit } from '@/lib/db/queries/users'
import { getActiveWorkspaceAdmins } from '@/lib/db/queries/workspaces'
import { createNotification } from '@/lib/db/queries/notifications'
import { sendPushToUser } from '@/lib/push'
import { queryWorkspaceEvents } from '@/lib/signals'
import { en } from '@/locales/en'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const requests = await getUserRegularizationRequests(ctx.workspace.id, ctx.userId)

  const gate = historyStartDate(ctx.workspace.plan)
  const minRequestDate = gate
    ? new Intl.DateTimeFormat('en-CA', { timeZone: ctx.workspace.display_timezone }).format(new Date(gate))
    : null

  return NextResponse.json({ regularizationRequests: requests, minRequestDate })
}

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { workspace, userId } = ctx

  // Rate limit: max 10 correction requests per user per hour (prevents spam)
  const regularizationKey = `regularization:${userId}`
  if (await getRateLimitCount(regularizationKey, 'regularization_submit', 60) >= 10) {
    return NextResponse.json(
      { error: 'Too many correction requests. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 },
    )
  }
  await recordRateLimitHit(regularizationKey, 'regularization_submit')

  let body: { target_date?: unknown; requested_type?: unknown; reason?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const targetDate = typeof body.target_date === 'string' ? body.target_date.trim() : ''
  const requestedType = body.requested_type
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!targetDate || !reason) {
    return NextResponse.json(
      { error: 'target_date and reason are required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }
  if (!DATE_RE.test(targetDate)) {
    return NextResponse.json(
      { error: 'target_date must be in YYYY-MM-DD format', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }
  if (requestedType !== 'office' && requestedType !== 'remote') {
    return NextResponse.json(
      { error: 'requested_type must be "office" or "remote"', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const today = todayInTz(workspace.display_timezone)
  if (targetDate > today) {
    return NextResponse.json(
      { error: 'Cannot regularize a future date.', code: 'FUTURE_DATE' },
      { status: 400 },
    )
  }

  const historyGate = historyStartDate(workspace.plan)
  if (historyGate && localMidnightToUtc(targetDate, workspace.display_timezone) < historyGate) {
    return NextResponse.json(
      { error: 'This date is outside your plan’s history window.', code: 'OUTSIDE_HISTORY' },
      { status: 400 },
    )
  }

  const workingDayNums: number[] = (() => {
    try { return JSON.parse(workspace.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()
  if (!isWorkday(targetDate, workingDayNums)) {
    return NextResponse.json(
      { error: 'Cannot regularize a non-working day.', code: 'WEEKOFF_DATE' },
      { status: 400 },
    )
  }

  const holidays = await getHolidaysInRange(workspace.id, targetDate, targetDate)
  if (holidays.length > 0) {
    return NextResponse.json(
      { error: `${targetDate} is a company holiday (${holidays[0].name}).`, code: 'ON_HOLIDAY' },
      { status: 400 },
    )
  }

  const onLeave = await hasOverlappingLeaveRequest(workspace.id, userId, targetDate, targetDate)
  if (onLeave) {
    return NextResponse.json(
      { error: 'You have a leave request covering this date.', code: 'ON_LEAVE' },
      { status: 400 },
    )
  }

  const duplicate = await hasPendingOrApprovedRegularization(workspace.id, userId, targetDate)
  if (duplicate) {
    return NextResponse.json(
      { error: 'You already have a pending or approved correction request for this date.', code: 'DUPLICATE_REQUEST' },
      { status: 409 },
    )
  }

  const startUtc = localMidnightToUtc(targetDate, workspace.display_timezone)
  const endUtc = localMidnightToUtc(nextDateKey(targetDate), workspace.display_timezone)
  const dayEvents = await queryWorkspaceEvents(workspace.id, workspace.plan, {
    startDate: startUtc,
    endDate: endUtc,
    userId,
  })

  const alreadyVerified = dayEvents.find((e) => e.matched_by === 'verified' || e.matched_by === 'override')
  if (alreadyVerified) {
    return NextResponse.json(
      { error: 'This day is already verified - there is nothing to correct.', code: 'ALREADY_VERIFIED' },
      { status: 400 },
    )
  }

  const correctable = dayEvents.find((e) => e.matched_by === 'partial' || e.matched_by === 'none')
  const presenceEventId = correctable?.id ?? null

  const regularizationRequest = await createRegularizationRequest({
    workspaceId: workspace.id,
    userId,
    targetDate,
    presenceEventId,
    requestedType: requestedType as RegularizationType,
    reason,
  })

  // Notify all active workspace admins
  try {
    const [employee, admins] = await Promise.all([
      getUserById(userId),
      getActiveWorkspaceAdmins(workspace.id, userId),
    ])
    const employeeName = employee?.full_name ?? employee?.email ?? 'Someone'
    const title = en.notifications.regularizationSubmittedTitle
    const notifBody = en.notifications.regularizationSubmittedBody(employeeName, targetDate)
    await Promise.allSettled(
      admins
        .flatMap((a) => [
          createNotification({ userId: a.user_id, workspaceId: workspace.id, type: 'regularization_submitted', title, body: notifBody, refId: regularizationRequest.id, refType: 'regularization_request' }),
          sendPushToUser(a.user_id, { title, body: notifBody, tag: `regularization-submitted-${regularizationRequest.id}` }),
        ]),
    )
  } catch { /* notification failure must not block the response */ }

  return NextResponse.json({ regularizationRequest }, { status: 201 })
}
