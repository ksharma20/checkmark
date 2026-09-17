import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { getSessionsSince } from '@/lib/db/queries/focus'
import { dateKeyInTimezone } from '@/lib/attendance-summary'
import { unauthorized } from '@/lib/space-api'

/**
 * `GET /api/focus/stats` - today's focus, for the signed-in member.
 *
 * WHOSE "TODAY"? Not the server's. `started_at` is stored in UTC and there is no
 * workspace on this surface to take a `display_timezone` from, so the only
 * authority on which day it is for this member is their own browser. It sends
 * `?tz=`; anything unrecognised falls back to UTC rather than 400ing, because a
 * stats tile is a summary and refusing to draw one over a timezone string is
 * worse than drawing it an hour off.
 *
 * The bucketing happens in JavaScript, over a 48-hour window read in one query.
 * Doing it in SQL would need offset arithmetic that better-sqlite3 and libSQL
 * need not agree on; `dateKeyInTimezone()` is the same helper the attendance
 * screens use to answer the same question about presence events, so the two
 * surfaces cannot drift on what "today" means.
 */

/** Wide enough for any offset on Earth (UTC-12..UTC+14), and still one small read. */
const WINDOW_HOURS = 48

/**
 * An unrecognised timezone falls back to UTC rather than throwing.
 *
 * `Intl.DateTimeFormat` raises a `RangeError` on a bad zone, and that would turn
 * one junk query string into a 500 on a read-only route.
 */
function safeTimezone(raw: string | null): string {
  if (!raw) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: raw })
    return raw
  } catch {
    return 'UTC'
  }
}

export async function GET(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const timezone = safeTimezone(new URL(request.url).searchParams.get('tz'))

  const since = new Date(Date.now() - WINDOW_HOURS * 3600_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19)

  const sessions = await getSessionsSince(user.userId, since)
  const today = dateKeyInTimezone(new Date().toISOString(), timezone)
  const todays = sessions.filter((s) => dateKeyInTimezone(s.started_at, timezone) === today)

  /**
   * Minutes count only sessions that were NOT interrupted.
   *
   * A stopped session is still a session - it happened, and the count says so -
   * but its minutes are not focus the member completed, and rolling them into
   * "75 min focused" makes the one number on the tile the least trustworthy
   * thing on the screen.
   */
  const totalMinutes = todays.reduce(
    (sum, s) => (s.interrupted ? sum : sum + (s.actual_duration_min ?? 0)),
    0,
  )

  return NextResponse.json({
    sessions_today: todays.length,
    sessions_completed: todays.filter((s) => !s.interrupted).length,
    total_minutes_today: totalMinutes,
  })
}
