/**
 * Client-side time formatting utilities.
 *
 * SQLite stores datetimes as "2026-03-17 07:54:11" (space, no Z).
 * new Date("2026-03-17 07:54:11") is implementation-defined — browsers treat
 * it as LOCAL time, not UTC. Always normalize before parsing.
 *
 * All functions here assume the input is a UTC string (from the DB) and
 * display in the browser's local timezone.
 */

function parseUtc(s: string): Date {
  if (!s) return new Date(NaN)
  // Already ISO with Z: "2026-03-17T07:54:11.000Z"
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z')
  // SQLite format "2026-03-17 07:54:11" → append T + Z
  return new Date(s.replace(' ', 'T') + 'Z')
}

/**
 * "1:37 PM" — time only, in browser's local timezone.
 */
export function fmtTime(utcStr: string): string {
  return parseUtc(utcStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * "1:37 PM on 17 Mar 2026" — full datetime with "on" separator.
 * Used consistently throughout the platform for all event timestamps.
 */
export function fmtTimeOnDate(utcStr: string): string {
  const d = parseUtc(utcStr)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${time} on ${date}`
}

/**
 * "YYYY-MM-DD" — extracts the UTC date portion for grouping/counting distinct days.
 * Uses slice(0,10) which works for both "2026-03-17 ..." and "2026-03-17T..." formats.
 */
export function utcDateKey(utcStr: string): string {
  return utcStr.slice(0, 10)
}

/**
 * Duration between two UTC strings: "45min", "4hr", "4hr 30min".
 * Returns null if checkoutStr is null/empty.
 */
export function durationLabel(checkinStr: string, checkoutStr: string | null): string | null {
  if (!checkoutStr) return null
  const diff = parseUtc(checkoutStr).getTime() - parseUtc(checkinStr).getTime()
  if (diff <= 0) return null
  const totalMins = Math.round(diff / 60_000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hrs === 0) return `${mins}min`
  if (mins === 0) return `${hrs}hr`
  return `${hrs}hr ${mins}min`
}

/**
 * Duration in fractional hours — for aggregating totals.
 */
export function durationHoursNum(checkinStr: string, checkoutStr: string | null): number {
  if (!checkoutStr) return 0
  const diff = parseUtc(checkoutStr).getTime() - parseUtc(checkinStr).getTime()
  return diff > 0 ? diff / 3_600_000 : 0
}

/**
 * Converts a decimal hours number to "Xhr Ymin" format.
 * Examples: 1.5 → "1hr 30min", 2.3 → "2hr 18min", 0.75 → "45min", 2.0 → "2hr".
 * Use this everywhere a numeric hours value needs to be displayed to a user.
 */
export function fmtHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}hr`
  return `${h}hr ${m}min`
}

/**
 * Whether a UTC timestamp is within the last N minutes (client-side clock).
 */
export function isWithinMinutes(utcStr: string, minutes: number): boolean {
  return Date.now() - parseUtc(utcStr).getTime() < minutes * 60 * 1000
}
