import { getUserEvents } from '@/lib/db/queries/events'
import { getUserById } from '@/lib/db/queries/users'
import { listHolidays } from '@/lib/db/queries/holidays'
import { getUserWorkspaces, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import {
  dateKeyInTimezone,
  nextDateKey,
  summarizeAttendanceDays,
} from '@/lib/attendance-summary'
import { resolveActiveWorkspaceSlug } from '../active-workspace'

/**
 * The Insights tab's numbers, computed on the server.
 *
 * NO NEW TABLE AND NO NEW ROUTE. Everything here is derived from the member's
 * own `presence_events` rows, and it is computed in the Server Component rather
 * than behind a `/api/...` endpoint because there is no interactivity to serve:
 * the tab draws once per page load, and a route would add a round trip, a
 * loading state and a second place for the definition of "a day present" to
 * live.
 *
 * WHAT CAN AND CANNOT BE SAID WITHOUT A WORKSPACE - the whole design of this
 * file. `presence_events` carries no `workspace_id` (and deliberately never
 * will), so the member's raw record is genuinely account-level: how many days
 * they checked in, how many hours those sessions ran, how long their streak is.
 * Those hold across every workspace and with none at all.
 *
 * "Office vs remote" does NOT hold. Whether a day counts as office is
 * `matched_by`, and `matched_by` is computed against ONE workspace's signal
 * configuration - the same event is verified in a workspace that has GPS at the
 * member's desk and unverified in one that does not. So the split is computed
 * for the ACTIVE workspace, the one the top-bar pill is pointing at, using the
 * same `queryWorkspaceEvents()` + `summarizeAttendanceDays()` pair the admin
 * screens use, so the member sees the number their admin sees. With no
 * workspace it is `null`, and the tab says why rather than drawing an empty
 * chart that implies zero office days.
 *
 * The active workspace is resolved server-side with `resolveActiveWorkspaceSlug()`
 * - the same function `src/app/me/layout.tsx` uses to paint the pill - so the
 * split and the pill can never name different workspaces. Switching workspace
 * calls `router.refresh()`, which re-runs this.
 */

/** How far back the streak walk may look. A streak longer than this is a story. */
const STREAK_LOOKBACK_DAYS = 120

export interface PeriodStats {
  /** Distinct calendar days, in the member's timezone, carrying a check-in. */
  daysPresent: number
  /** Summed length of CLOSED sessions, in hours, to one decimal place. */
  hours: number
  /** Check-ins, not days - two sessions in one day count twice here. */
  checkins: number
}

export interface SpaceInsights {
  /** True when the member has any event at all; false paints the empty state. */
  hasEvents: boolean
  week: PeriodStats
  month: PeriodStats
  streakDays: number
  /**
   * Office/remote day counts for the month, from the ACTIVE workspace, or null
   * when the member has none. Null is not zero and the tab must not draw it as
   * though it were.
   */
  split: { office: number; remote: number } | null
}

/** `YYYY-MM-DD`, n days before the given key. */
function shiftDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The Monday of the week `dateKey` falls in.
 *
 * Monday rather than Sunday because every other week boundary in this codebase
 * is ISO (`working_days` defaults to `[1,2,3,4,5]`), and a "this week" tile that
 * resets on a different day from the leave calculations would be quietly telling
 * a different story about the same days.
 */
function weekStart(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return shiftDays(dateKey, -((weekday + 6) % 7))
}

/** Parse a UTC datetime SQLite stored with either separator. */
function toDate(value: string): Date {
  return new Date(
    value.includes('T')
      ? value.endsWith('Z') ? value : `${value}Z`
      : `${value.replace(' ', 'T')}Z`,
  )
}

export async function getSpaceInsights(userId: string): Promise<SpaceInsights> {
  /**
   * The member's OWN timezone, not a workspace's.
   *
   * `users.timezone` is kept in step by `TimezoneReporter` in the `/me` layout.
   * Reading a workspace's `display_timezone` here would be wrong in the one case
   * this tab exists to serve - a member with no workspace has none to read - and
   * subtly wrong in another: these counts span every workspace, so bucketing
   * them by one workspace's clock would move days for the others.
   */
  const profile = await getUserById(userId)
  const timezone = profile?.timezone || 'UTC'

  const today = dateKeyInTimezone(new Date().toISOString(), timezone)
  const monthStart = `${today.slice(0, 7)}-01`
  const weekStartKey = weekStart(today)
  const earliest = [monthStart, weekStartKey, shiftDays(today, -STREAK_LOOKBACK_DAYS)]
    .sort()[0]

  /**
   * ONE read covering every window. The month, the week and the streak all walk
   * the same rows, and three queries would be three chances for them to disagree
   * about the boundary. The limit is generous rather than absent: the query
   * paginates by default, and a member with several check-ins a day across four
   * months is still far inside it.
   */
  const { events } = await getUserEvents({
    userId,
    start: `${earliest}T00:00:00Z`,
    end: `${today}T23:59:59Z`,
    limit: 2000,
  })

  const blank = (): PeriodStats => ({ daysPresent: 0, hours: 0, checkins: 0 })
  const weekDays = new Set<string>()
  const monthDays = new Set<string>()
  const allDays = new Set<string>()
  const week = blank()
  const month = blank()
  let weekMs = 0
  let monthMs = 0

  for (const event of events) {
    const day = dateKeyInTimezone(event.checkin_at, timezone)
    allDays.add(day)

    // An OPEN session contributes a day and a check-in but no hours. It has no
    // length yet, and guessing one - "assume it is still running" - would make
    // the hours tile climb on its own while the member reads it.
    const ms = event.checkout_at
      ? Math.max(0, toDate(event.checkout_at).getTime() - toDate(event.checkin_at).getTime())
      : 0

    if (day >= monthStart && day <= today) {
      monthDays.add(day)
      month.checkins++
      monthMs += ms
    }
    if (day >= weekStartKey && day <= today) {
      weekDays.add(day)
      week.checkins++
      weekMs += ms
    }
  }

  week.daysPresent = weekDays.size
  month.daysPresent = monthDays.size
  week.hours = Math.round((weekMs / 3_600_000) * 10) / 10
  month.hours = Math.round((monthMs / 3_600_000) * 10) / 10

  /**
   * The streak: consecutive CALENDAR days with a check-in, counting back from
   * the most recent one.
   *
   * Calendar days rather than working days, and that is a choice worth stating.
   * Working days are a workspace's `working_days` column, and this number is
   * account-level - a member of two workspaces with different weeks has no one
   * answer, and a member of none has no answer at all. Counting back from the
   * member's LAST check-in rather than from today is the other half: a streak
   * that silently resets to zero over a weekend reports a break that did not
   * happen. The copy beside it says exactly this.
   */
  let streakDays = 0
  const sortedDays = [...allDays].sort()
  const lastDay = sortedDays[sortedDays.length - 1]
  if (lastDay) {
    let cursor = lastDay
    while (allDays.has(cursor) && streakDays < STREAK_LOOKBACK_DAYS) {
      streakDays++
      cursor = shiftDays(cursor, -1)
    }
  }

  return {
    hasEvents: events.length > 0,
    week,
    month,
    streakDays,
    split: await officeRemoteSplit(userId, monthStart, today),
  }
}

/**
 * The month's office/remote split for the member's ACTIVE workspace, or null.
 *
 * Null when the member belongs to no live workspace - which is a real state on
 * this surface, not an error - and the tab prints an explanation instead of a
 * zero. Everything else here is deliberately the admin path: `queryWorkspaceEvents`
 * applies the workspace's signal configuration (including config-light, where
 * every event is verified) and `summarizeAttendanceDays` applies its working
 * days and holiday calendar, so the member's split and the admin's monthly grid
 * are computed by the same two functions from the same rows.
 */
async function officeRemoteSplit(
  userId: string,
  monthStart: string,
  today: string,
): Promise<{ office: number; remote: number } | null> {
  const memberships = await getUserWorkspaces(userId)
  if (memberships.length === 0) return null

  const workspaces = (await getWorkspacesByIds(memberships.map((m) => m.workspace_id)))
    .filter((w) => !w.archived_at)
  if (workspaces.length === 0) return null

  const slug = await resolveActiveWorkspaceSlug(workspaces.map((w) => w.slug))
  const workspace = workspaces.find((w) => w.slug === slug) ?? workspaces[0]

  const events = await queryWorkspaceEvents(workspace.id, workspace.plan, {
    startDate: monthStart,
    endDate: nextDateKey(today),
    userId,
  })

  let workingDays: number[]
  try { workingDays = JSON.parse(workspace.working_days ?? '[1,2,3,4,5]') }
  catch { workingDays = [1, 2, 3, 4, 5] }

  const holidays = await listHolidays(workspace.id, Number(today.slice(0, 4)))

  const summary = summarizeAttendanceDays({
    events,
    startDate: monthStart,
    endDate: today,
    timezone: workspace.display_timezone,
    todayDate: today,
    holidayDates: holidays.map((h) => h.date),
    workingDays,
  })

  return { office: summary.officeDays, remote: summary.remoteDays }
}
