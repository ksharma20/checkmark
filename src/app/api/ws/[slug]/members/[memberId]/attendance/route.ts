import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { getActiveMemberWithDetails } from '@/lib/db/queries/workspaces'
import { listHolidayDatesInRange } from '@/lib/db/queries/holidays'
import { queryWorkspaceEvents } from '@/lib/signals'
import { summarizeAttendanceDays } from '@/lib/attendance-summary'
import { todayInTz } from '@/lib/timezone'
import { Action, Resource } from '@/lib/permissions/catalogue'

// ─── GET /api/ws/[slug]/members/[memberId]/attendance ─────────────────────────
//
// ID SPACE: `memberId` is a **users.id**, NOT a `workspace_members.id`.
//
// This segment is not one id space today, so the rule this route follows is
// "match the sibling that shares a tab": Activity renders this endpoint next to
// `.../timeline`, which takes a users.id, and the tab is handed exactly one id.
// The Leave tab's two routes take a `workspace_members.id` for the same reason -
// they sit beside `.../leave-balances`. Keying the two halves of one tab on two
// different ids is what would actually confuse a caller.
//
// Gated on Activity:read, not Members:read - the tab that shows it is
// `Resource.Activity` in person-tabs.ts, and a gate that disagrees with the tab
// it backs is a gate nobody can reason about.

interface Props { params: Promise<{ slug: string; memberId: string }> }

/**
 * Shift a YYYY-MM-DD key by `delta` days, either direction. `nextDateKey` in
 * attendance-summary only walks forward, and a UTC anchor keeps this DST-proof.
 */
function shiftDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + delta))
  return date.toISOString().slice(0, 10)
}

/** How far back the summary looks. Fixed, and stated in the copy. */
const WINDOW_DAYS = 30

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId: targetUserId } = await params

  const ctx = await requireWsAccess(req, slug, Resource.Activity, Action.Read)
  if (!ctx) return forbidden()

  const ws = ctx.workspace

  const member = await getActiveMemberWithDetails(ws.id, targetUserId)
  if (!member) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // The window is computed in the WORKSPACE's timezone, never the caller's: an
  // admin in another country must see the same 30 days the employee lived.
  const today = todayInTz(ws.display_timezone)
  const url = new URL(req.url)
  const end = url.searchParams.get('end')?.slice(0, 10) || today
  const start = url.searchParams.get('start')?.slice(0, 10) || shiftDays(end, -(WINDOW_DAYS - 1))

  const workingDays: number[] = (() => {
    try { return JSON.parse(ws.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()

  // Fetch a day wider on each side than we report. `summarizeAttendanceDays`
  // buckets by workspace-LOCAL date, but this query filters on UTC timestamps,
  // and the two disagree by up to a day at either edge - so an event at 23:00
  // local on the last day of the window would be silently dropped for any
  // workspace behind UTC. Over-fetching costs two days of rows for one person;
  // the summary discards anything outside [start, end] itself.
  const events = await queryWorkspaceEvents(ws.id, ws.plan, {
    startDate: `${shiftDays(start, -1)}T00:00:00Z`,
    endDate: `${shiftDays(end, 1)}T23:59:59Z`,
    userId: targetUserId,
  })

  const holidayDates = await listHolidayDatesInRange(ws.id, start, end)

  const summary = summarizeAttendanceDays({
    events,
    startDate: start,
    endDate: end,
    timezone: ws.display_timezone,
    todayDate: today,
    holidayDates,
    workingDays,
  })

  return NextResponse.json({ range: { start, end }, summary })
}
