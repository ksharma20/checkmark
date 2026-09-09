import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { listOpenCasesForUser } from '@/lib/db/queries/maternity'
import {
  computeUnpaidExtensionDays,
  createParentalExtension,
  hasPendingExtensionForCase,
  listExtensionsForUser,
} from '@/lib/db/queries/parental-extensions'
import { getUserById, getRateLimitCount, recordRateLimitHit } from '@/lib/db/queries/users'
import { getActiveWorkspaceAdmins } from '@/lib/db/queries/workspaces'
import { notify } from '@/lib/notify'
import { parentalExtension, parentalExtensionNotifications } from '@/locales/en/ws-parental'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A member asking to stay on parental leave longer than their case allows, as
 * UNPAID days.
 *
 * Modelled on `/api/me/ws/[slug]/regularizations` - the same shape of thing: a
 * member files it, it lands in the admin approvals queue, and the member is
 * told the outcome. Rate limit before the body is read, one distinct error code
 * per rule, create, then notify inside a try/catch so a dead push service
 * cannot cost the member their request.
 *
 * NOTHING here trusts a case id from the body. `listOpenCasesForUser()` resolves
 * cases through the caller's own employee record, and the requested case must be
 * in what it returns - so a case id belonging to somebody else is a 404 whatever
 * the caller sends (invariant 1).
 */

// ─── GET ──────────────────────────────────────────────────────────────────────
// The open cases this member may extend, plus their own request history. Both
// in one read so the `/me` form knows whether to render at all without a second
// round trip.
//
// `?case_id=&requested_end_date=` additionally returns a PREVIEW of the unpaid
// day count. The form has to show that number before submit - being told after
// the fact how many unpaid days you just asked for is no use - and this is how
// it gets it without a second implementation of the count living in the
// browser. One function computes it, on the server, for the preview, the
// submit and the approval alike; a client-side copy would be a second thing to
// keep in step with the workspace's working days and holiday calendar, and the
// two would disagree the first time an admin added a holiday.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const [allOpenCases, extensions] = await Promise.all([
    listOpenCasesForUser(ctx.workspace.id, ctx.userId),
    listExtensionsForUser(ctx.workspace.id, ctx.userId),
  ])

  // A case with no end_date cannot be extended - there is nothing to extend
  // FROM, and the unpaid-day count has no start. The admin has to set the date
  // first; the PATCH route already refuses to clear it on an open case.
  const openCases = allOpenCases.filter((c) => c.end_date !== null)

  const sp = req.nextUrl.searchParams
  const previewCaseId = sp.get('case_id')
  const previewEnd = sp.get('requested_end_date')
  let preview: { case_id: string; requested_end_date: string; unpaid_days: number } | null = null

  if (previewCaseId && previewEnd && DATE_RE.test(previewEnd)) {
    // Resolved out of the caller's OWN open cases, exactly as the POST does -
    // a preview must not become a way to read somebody else's dates.
    const target = openCases.find((c) => c.id === previewCaseId)
    if (target?.end_date && previewEnd > target.end_date) {
      preview = {
        case_id: target.id,
        requested_end_date: previewEnd,
        unpaid_days: await computeUnpaidExtensionDays({
          workspaceId: ctx.workspace.id,
          currentEndDate: target.end_date,
          requestedEndDate: previewEnd,
          workingDaysJson: ctx.workspace.working_days,
        }),
      }
    }
  }

  return NextResponse.json({ openCases, extensions, preview })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Body: { case_id, requested_end_date, reason? }
//
// `unpaid_days` is DELIBERATELY not accepted. It is computed here from the
// workspace's working days and holiday calendar, and recomputed again at
// approval time, because a client-supplied day count is a client-supplied
// entitlement.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { workspace, userId } = ctx

  // Checked BEFORE the body is read, matching the regularization route: a
  // rate-limited caller must not get to push a payload through first.
  const rateKey = `parental-extension:${userId}`
  if (await getRateLimitCount(rateKey, 'parental_extension_submit', 60) >= 10) {
    return NextResponse.json(
      { error: parentalExtension.errors.rateLimited, code: 'RATE_LIMITED' },
      { status: 429 },
    )
  }
  await recordRateLimitHit(rateKey, 'parental_extension_submit')

  let body: { case_id?: unknown; requested_end_date?: unknown; reason?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const caseId = typeof body.case_id === 'string' ? body.case_id.trim() : ''
  const requestedEndDate =
    typeof body.requested_end_date === 'string' ? body.requested_end_date.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!caseId || !requestedEndDate) {
    return NextResponse.json(
      { error: parentalExtension.errors.missingFields, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }
  if (!DATE_RE.test(requestedEndDate)) {
    return NextResponse.json(
      { error: parentalExtension.errors.badDate, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  // The ownership check. The list is resolved through the caller's employee
  // record, so a case that is not theirs simply is not in it.
  const openCases = await listOpenCasesForUser(workspace.id, userId)
  const parentalCase = openCases.find((c) => c.id === caseId)
  if (!parentalCase) {
    return NextResponse.json(
      { error: parentalExtension.errors.caseNotFound, code: 'CASE_NOT_FOUND' },
      { status: 404 },
    )
  }
  if (!parentalCase.end_date) {
    return NextResponse.json(
      { error: parentalExtension.errors.noEndDate, code: 'NO_END_DATE' },
      { status: 400 },
    )
  }
  if (requestedEndDate <= parentalCase.end_date) {
    return NextResponse.json(
      { error: parentalExtension.errors.notAnExtension, code: 'NOT_AN_EXTENSION' },
      { status: 400 },
    )
  }

  // One open request per case: two pending extensions would be two admins
  // moving the same end_date to two different values.
  if (await hasPendingExtensionForCase(workspace.id, parentalCase.id)) {
    return NextResponse.json(
      { error: parentalExtension.errors.duplicate, code: 'DUPLICATE_REQUEST' },
      { status: 409 },
    )
  }

  const unpaidDays = await computeUnpaidExtensionDays({
    workspaceId: workspace.id,
    currentEndDate: parentalCase.end_date,
    requestedEndDate,
    workingDaysJson: workspace.working_days,
  })
  if (unpaidDays <= 0) {
    // Every day in the window is a weekend or a company holiday, so the
    // extension costs nothing and grants nothing an admin has to decide on.
    return NextResponse.json(
      { error: parentalExtension.errors.noWorkingDays, code: 'NO_WORKING_DAYS' },
      { status: 400 },
    )
  }

  const extension = await createParentalExtension({
    workspaceId: workspace.id,
    caseId: parentalCase.id,
    userId,
    previousEndDate: parentalCase.end_date,
    requestedEndDate,
    unpaidDays,
    reason: reason || null,
  })

  try {
    const [member, admins] = await Promise.all([
      getUserById(userId),
      getActiveWorkspaceAdmins(workspace.id, userId),
    ])
    const memberName = member?.full_name ?? member?.email ?? 'Someone'
    await notify({
      userIds: admins.map((a) => a.user_id),
      workspaceId: workspace.id,
      workspaceSlug: slug,
      type: 'extension_submitted',
      title: parentalExtensionNotifications.submittedTitle,
      body: parentalExtensionNotifications.submittedBody(memberName, unpaidDays),
      refId: extension.id,
      refType: 'parental_extension',
      // Approvers, not the requester - the push must open the approvals queue
      // rather than `/me/leave`.
      surface: 'ws',
      push: { tag: `extension-submitted-${extension.id}` },
    })
  } catch { /* notification failure must not block the response */ }

  return NextResponse.json({ extension }, { status: 201 })
}
