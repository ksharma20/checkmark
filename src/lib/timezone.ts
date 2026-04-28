/**
 * Normalize SQLite datetime "2026-03-17 07:54:11" (space, no Z) to a proper
 * UTC Date. Without this, new Date("2026-03-17 07:54:11") is implementation-
 * defined - Node.js may treat it as local time, producing a timezone offset bug.
 */
function parseDbUtc(s: string): Date {
  if (!s) return new Date(NaN)
  if (s.includes('T')) return new Date(s.endsWith('Z') ? s : s + 'Z')
  return new Date(s.replace(' ', 'T') + 'Z')
}

// All dates stored as UTC ISO 8601 strings in the DB.
// These helpers convert between UTC and workspace/user timezones for display.

/**
 * Format a UTC ISO string for display in a given IANA timezone.
 */
export function formatInTz(
  utcString: string,
  tz: string,
  format: 'time' | 'date' | 'datetime'
): string {
  const date = parseDbUtc(utcString)

  const opts: Intl.DateTimeFormatOptions = { timeZone: tz }

  switch (format) {
    case 'time':
      opts.hour = '2-digit'
      opts.minute = '2-digit'
      opts.hour12 = true
      break
    case 'date':
      opts.year = 'numeric'
      opts.month = 'short'
      opts.day = 'numeric'
      break
    case 'datetime':
      opts.year = 'numeric'
      opts.month = 'short'
      opts.day = 'numeric'
      opts.hour = '2-digit'
      opts.minute = '2-digit'
      opts.hour12 = true
      break
  }

  return new Intl.DateTimeFormat('en-US', opts).format(date)
}

/**
 * Get the UTC ISO bounds (start and end) for a calendar month
 * expressed in a given IANA timezone.
 */
export function monthBoundsUtc(
  year: number,
  month: number, // 1-indexed
  tz: string
): { start: string; end: string } {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`
  const start = localMidnightToUtc(startStr, tz)

  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  const end = localMidnightToUtc(endStr, tz)

  return { start, end }
}

/**
 * Convert a 'YYYY-MM-DD' date string (interpreted as midnight in tz) to UTC ISO string.
 */
export function localMidnightToUtc(dateStr: string, tz: string): string {
  // Use Intl to find the UTC offset at midnight local time in the given timezone
  const [year, month, day] = dateStr.split('-').map(Number)

  // Create a reference date at midnight UTC and adjust
  // We use the trick of formatting a known UTC time and comparing
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Binary-search-free approach: use the offset
  // Estimate: try midnight UTC, see what time it is in tz, compute diff
  let guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))

  for (let i = 0; i < 2; i++) {
    const parts = formatter.formatToParts(guess).reduce((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {} as Record<string, string>)

    const localYear = parseInt(parts.year)
    const localMonth = parseInt(parts.month)
    const localDay = parseInt(parts.day)
    const localHour = parseInt(parts.hour === '24' ? '0' : parts.hour)
    const localMin = parseInt(parts.minute)
    const localSec = parseInt(parts.second)

    const localTimestamp = Date.UTC(localYear, localMonth - 1, localDay, localHour, localMin, localSec)
    const targetTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0)
    const diff = localTimestamp - targetTimestamp

    guess = new Date(guess.getTime() - diff)
  }

  return guess.toISOString()
}

/**
 * Get today's date string 'YYYY-MM-DD' in a given IANA timezone.
 */
export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/**
 * Compute duration in hours between two ISO UTC strings.
 * Returns null if either value is missing.
 */
export function durationHours(checkinAt: string, checkoutAt: string | null): number | null {
  if (!checkoutAt) return null
  const diff = parseDbUtc(checkoutAt).getTime() - parseDbUtc(checkinAt).getTime()
  return diff / (1000 * 60 * 60)
}
