import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { isWorkday, isOfficeMatched, nextDateKey } from '@/lib/attendance-summary'
import { historyStartDate } from '@/lib/plans'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getHolidaysInRange } from '@/lib/db/queries/holidays'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import {
  listWorkspaceEventsOnDate,
  bulkCreateOfficeDayOverrides,
  listDeclaredOfficeDays,
  type DeclaredOfficeDay,
} from '@/lib/db/queries/office-days'
import type { Workspace } from '@/lib/db/queries/workspaces'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** People counts, not event counts — one person can check in twice in a day. */
export interface OfficeDayCounts {
  date: string
  /** People whose day flips from WFH to WFO. */
  converted: number
  /** People already counted as in-office (signals verified, or already overridden). */
  alreadyOffice: number
  /** Active members with no event that date — left absent / on leave, untouched. */
  skipped: number
}

export interface OfficeDaysListResponse { officeDays: DeclaredOfficeDay[] }
export interface OfficeDayPreviewResponse { preview: OfficeDayCounts }
export interface OfficeDayResultResponse extends OfficeDayCounts { overridesWritten: number }

// ─── Refusals ─────────────────────────────────────────────────────────────────

/**
 * The two refusals that matter, and why they are refusals rather than a shrug.
 *
 * `summarizeAttendanceDays()` tests `!isWorkday(date)` and
 * `holidayDates.has(date)` BEFORE it ever looks at that day's events. So an
 * office day declared on a Sunday or on Diwali would faithfully write its
 * override rows and then be read by absolutely nothing — a silent no-op that
 * looks like it worked. Refuse loudly instead, reusing the exact codes the
 * single-day regularization path already returns for the same two situations
 * (`WEEKOFF_DATE`, `ON_HOLIDAY`) plus its plan-history-window check.
 */
async function refuseDate(workspace: Workspace, date: string): Promise<NextResponse | null> {
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errDateFormat, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  if (date > todayInTz(workspace.display_timezone)) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errFutureDate, code: 'FUTURE_DATE' },
      { status: 400 },
    )
  }

  const historyGate = historyStartDate(workspace.plan)
  if (historyGate && localMidnightToUtc(date, workspace.display_timezone) < historyGate) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errOutsideHistory, code: 'OUTSIDE_HISTORY' },
      { status: 400 },
    )
  }

  const workingDayNums: number[] = (() => {
    try { return JSON.parse(workspace.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()
  if (!isWorkday(date, workingDayNums)) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errWeekOff, code: 'WEEKOFF_DATE' },
      { status: 400 },
    )
  }

  const holidays = await getHolidaysInRange(workspace.id, date, date)
  if (holidays.length > 0) {
    return NextResponse.json(
      { error: wsAdmin.officeDay.errHoliday(date, holidays[0].name), code: 'ON_HOLIDAY' },
      { status: 400 },
    )
  }

  return null
}

// ─── Classification ───────────────────────────────────────────────────────────

interface Resolved extends OfficeDayCounts {
  /** The events that need an override row written. */
  eventIdsToOverride: string[]
}

/**
 * Work out who a declaration would actually move, without writing anything.
 *
 * Two reads, each doing a job the other cannot:
 *
 * - `listWorkspaceEventsOnDate()` is the COMPLETE set of that date's events for
 *   active members. It applies no plan cap, because it decides what gets
 *   written and a silently-capped write would leave people out.
 * - `queryWorkspaceEvents()` is the only thing that knows `matched_by`, so it
 *   is what tells a genuinely signal-verified check-in apart from a WFH one.
 *   Someone already verified is left alone: writing an override over them would
 *   downgrade their chip from "verified" to "override" and hide the fact that
 *   their GPS really did match.
 *
 * An event missing from the second read (free-plan `maxUsers` cap) falls back to
 * "not office unless it already has an override" — the declaring admin's stated
 * intent, rather than a silent skip.
 *
 * Used by both the preview and the write, so the number in the confirm modal is
 * produced by the same code that produces the result.
 */
async function resolveOfficeDay(workspace: Workspace, date: string): Promise<Resolved> {
  const tz = workspace.display_timezone
  const startUtc = localMidnightToUtc(date, tz)
  const endUtc = localMidnightToUtc(nextDateKey(date), tz)

  const [dayEvents, matchedEvents, activeMemberIds] = await Promise.all([
    listWorkspaceEventsOnDate(workspace.id, date, tz),
    queryWorkspaceEvents(workspace.id, workspace.plan, { startDate: startUtc, endDate: endUtc }),
    getActiveMemberIds(workspace.id),
  ])

  const officeById = new Map<string, boolean>()
  for (const event of matchedEvents) officeById.set(event.id, isOfficeMatched(event.matched_by))

  // Roll events up to people: a day is one status per person, not per check-in.
  const officeUsers = new Set<string>()
  const usersWithEvents = new Set<string>()
  const eventsByUser = new Map<string, string[]>()

  for (const row of dayEvents) {
    usersWithEvents.add(row.user_id)
    const isOffice = officeById.get(row.presence_event_id) ?? row.has_override === 1
    if (isOffice) officeUsers.add(row.user_id)
    if (row.has_override === 0) {
      const list = eventsByUser.get(row.user_id) ?? []
      list.push(row.presence_event_id)
      eventsByUser.set(row.user_id, list)
    }
  }

  const eventIdsToOverride: string[] = []
  let converted = 0
  for (const [userId, eventIds] of eventsByUser) {
    if (officeUsers.has(userId)) continue
    converted++
    eventIdsToOverride.push(...eventIds)
  }

  const skipped = activeMemberIds.filter((id) => !usersWithEvents.has(id)).length

  return { date, converted, alreadyOffice: officeUsers.size, skipped, eventIdsToOverride }
}

// ─── GET /api/ws/[slug]/office-days ───────────────────────────────────────────
// no `?date=` → the declared office days
// `?date=`    → a dry run for that date, so the confirm modal can name a count

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Approvals, Action.Read)
  if (!ctx) return forbidden()

  const date = request.nextUrl.searchParams.get('date')?.trim()

  if (!date) {
    const officeDays = await listDeclaredOfficeDays(ctx.workspace.id, ctx.workspace.display_timezone)
    return NextResponse.json({ officeDays } satisfies OfficeDaysListResponse)
  }

  const refusal = await refuseDate(ctx.workspace, date)
  if (refusal) return refusal

  const resolved = await resolveOfficeDay(ctx.workspace, date)
  const preview: OfficeDayCounts = {
    date: resolved.date,
    converted: resolved.converted,
    alreadyOffice: resolved.alreadyOffice,
    skipped: resolved.skipped,
  }
  return NextResponse.json({ preview } satisfies OfficeDayPreviewResponse)
}

// ─── POST /api/ws/[slug]/office-days ──────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Approvals, Action.Write)
  if (!ctx) return forbidden()

  let body: { date?: unknown; note?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: wsAdmin.officeDay.errBadBody, code: 'INVALID_BODY' }, { status: 400 })
  }

  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() || null : null

  const refusal = await refuseDate(ctx.workspace, date)
  if (refusal) return refusal

  const resolved = await resolveOfficeDay(ctx.workspace, date)

  // 200 even when nothing moved, matching the holidays bulk-import house
  // pattern: a partial (or empty) result is a RESULT, not an error. The caller
  // gets the three counts and decides what to say about them. Re-declaring the
  // same day lands here with `converted: 0` and is a clean no-op, not a 409 -
  // the unique index absorbs it.
  const overridesWritten = await bulkCreateOfficeDayOverrides({
    workspaceId: ctx.workspace.id,
    adminUserId: ctx.userId,
    presenceEventIds: resolved.eventIdsToOverride,
    note: note ? `${wsAdmin.officeDay.notePrefix}${note}` : wsAdmin.officeDay.noteDefault,
  })

  return NextResponse.json({
    date: resolved.date,
    converted: resolved.converted,
    alreadyOffice: resolved.alreadyOffice,
    skipped: resolved.skipped,
    overridesWritten,
  } satisfies OfficeDayResultResponse)
}
