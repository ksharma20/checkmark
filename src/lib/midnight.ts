/** Returns the UTC ISO string of the next midnight in the given IANA timezone. */
export function nextMidnightUtc(timezone: string): string {
  const now = new Date()

  // Get tomorrow's date string in the target timezone (en-CA gives YYYY-MM-DD)
  const tomorrowDateStr = (() => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    return d.toLocaleDateString('en-CA', { timeZone: timezone })
  })()

  // Find the UTC time that equals 00:00:00 tomorrow in the timezone.
  // Use a noon reference to avoid DST ambiguity, then measure the offset.
  const refDate = new Date(`${tomorrowDateStr}T12:00:00Z`)
  const localStr = refDate.toLocaleString('en-CA', { timeZone: timezone, hour12: false })
  // en-CA format: "YYYY-MM-DD, HH:MM:SS" — parse both hours and minutes for sub-hour timezones (e.g. IST +05:30)
  const parts = localStr.split(', ')[1]?.split(':') ?? ['12', '0']
  const hour = parseInt(parts[0] ?? '12', 10)
  const minute = parseInt(parts[1] ?? '0', 10)
  const offsetMinutes = 12 * 60 - (hour * 60 + minute)

  const midnightUtc = new Date(`${tomorrowDateStr}T00:00:00Z`)
  midnightUtc.setMinutes(midnightUtc.getMinutes() - offsetMinutes)

  return midnightUtc.toISOString()
}

/** Milliseconds until next midnight in user's timezone. */
export function msUntilMidnight(timezone: string): number {
  return Math.max(0, new Date(nextMidnightUtc(timezone)).getTime() - Date.now())
}

/** Milliseconds until 15 minutes before midnight (warning time). */
export function msUntilMidnightWarning(timezone: string): number {
  return Math.max(0, msUntilMidnight(timezone) - 15 * 60 * 1000)
}
