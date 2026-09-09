import { queryWorkspaceEvents } from '@/lib/signals'
import { dateKeyInTimezone, nextDateKey, summarizeAttendanceDays } from '@/lib/attendance-summary'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'
import { historyStartDate } from '@/lib/plans'
import { listHolidayDatesInRange } from '@/lib/db/queries/holidays'
import { getUserLeaveDatesInRange } from '@/lib/db/queries/leaves'

/**
 * How far back the correction form offers days.
 *
 * The plan history window can reach 7 years, and a form whose day list runs to
 * four figures is not a form. Somebody correcting a day from last quarter is
 * not the case this serves; somebody correcting last Tuesday is. The POST route
 * still accepts anything inside the plan window, so this caps the *picker*, not
 * the right to file.
 */
export const CORRECTABLE_LOOKBACK_DAYS = 90

/** `date` shifted by `days`, both as `YYYY-MM-DD` day keys. */
function shiftDateKey(date: string, days: number): string {
  const ms = new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * The days this member may still file a correction request for.
 *
 * This is the single source of the correction form's day list, and it exists
 * because that form no longer hangs off a timeline row that already knew its own
 * date. It has to agree with what `POST /api/me/ws/[slug]/regularizations` will
 * accept - offering a day the route then refuses is worse than not offering it -
 * so every exclusion below mirrors one of that route's guards:
 *
 * - `summarizeAttendanceDays()` yields only `'absent'` (nothing logged) and
 *   `'remote'` (events exist but none verified or overridden) days. Non-working
 *   days, company holidays and future dates never reach its output at all, and a
 *   verified day is `'office'`, so `WEEKOFF_DATE`, `ON_HOLIDAY`, `FUTURE_DATE`
 *   and `ALREADY_VERIFIED` are all covered by that one call.
 * - approved *or pending* leave is subtracted (`ON_LEAVE`)
 * - the plan history floor bounds the window (`OUTSIDE_HISTORY`)
 *
 * `DUPLICATE_REQUEST` is deliberately NOT handled here: the caller holds the
 * member's existing requests and subtracts those itself, so this stays a pure
 * "which days are correctable at all" question.
 *
 * Do not re-derive any of this in the browser. The `/me` surface used to decide
 * a day was correctable from `matched_by` alone, which is why the one case
 * members actually hit - forgot to check in, so there is no event and no
 * `matched_by` - had no entry point at all.
 */
export async function getCorrectableDates(params: {
  workspaceId: string
  userId: string
  plan: string
  timezone: string
  workingDaysJson: string | null
}): Promise<string[]> {
  const { workspaceId, userId, plan, timezone } = params

  const today = todayInTz(timezone)
  const lookbackStart = shiftDateKey(today, -CORRECTABLE_LOOKBACK_DAYS)
  const planFloor = historyStartDate(plan)
  const planFloorKey = planFloor ? dateKeyInTimezone(planFloor, timezone) : null
  const startKey =
    planFloorKey && planFloorKey > lookbackStart ? planFloorKey : lookbackStart
  if (startKey > today) return []

  const workingDays: number[] = (() => {
    try { return JSON.parse(params.workingDaysJson ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()

  const [events, holidayDates, leaveDates] = await Promise.all([
    queryWorkspaceEvents(workspaceId, plan, {
      startDate: localMidnightToUtc(startKey, timezone),
      endDate: localMidnightToUtc(nextDateKey(today), timezone),
      userId,
    }),
    listHolidayDatesInRange(workspaceId, startKey, today),
    getUserLeaveDatesInRange(workspaceId, userId, startKey, today),
  ])

  const { days } = summarizeAttendanceDays({
    events,
    startDate: startKey,
    endDate: today,
    timezone,
    todayDate: today,
    holidayDates,
    workingDays,
  })

  return Object.entries(days)
    .filter(([date, status]) => {
      if (status !== 'absent' && status !== 'remote') return false
      return !leaveDates.has(date)
    })
    .map(([date]) => date)
    .sort((a, b) => (a > b ? -1 : 1)) // newest first - the day being corrected is usually recent
}
