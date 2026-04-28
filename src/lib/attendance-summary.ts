import type { MatchedBy, PresenceEventWithMatch } from './signals'

export type AttendanceDayStatus = 'office' | 'remote' | 'absent' | 'future'

export interface AttendanceSummary {
  days: Record<string, AttendanceDayStatus>
  officeDays: number
  remoteDays: number
  absentDays: number
  workingDays: number
}

export function isOfficeMatched(matchedBy: MatchedBy): boolean {
  return matchedBy === 'verified' || matchedBy === 'override'
}

export function dateKeyInTimezone(utcString: string, timezone: string): string {
  const date = new Date(
    utcString.includes('T')
      ? utcString.endsWith('Z') ? utcString : `${utcString}Z`
      : `${utcString.replace(' ', 'T')}Z`
  )

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isWorkday(dateStr: string): boolean {
  const date = new Date(`${dateStr}T12:00:00Z`)
  const day = date.getUTCDay()
  return day >= 1 && day <= 5
}

export function nextDateKey(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + 1))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function countWorkdays(startDate: string, endDate: string): number {
  let count = 0
  for (let date = startDate; date <= endDate; date = nextDateKey(date)) {
    if (isWorkday(date)) count++
  }
  return count
}

export function summarizeAttendanceDays(params: {
  events: PresenceEventWithMatch[]
  startDate: string
  endDate: string
  timezone: string
  todayDate?: string
}): AttendanceSummary {
  const todayDate = params.todayDate ?? params.endDate
  const eventsByDay = new Map<string, PresenceEventWithMatch[]>()

  for (const event of params.events) {
    const day = dateKeyInTimezone(event.checkin_at, params.timezone)
    if (day < params.startDate || day > params.endDate) continue
    const dayEvents = eventsByDay.get(day) ?? []
    dayEvents.push(event)
    eventsByDay.set(day, dayEvents)
  }

  const days: Record<string, AttendanceDayStatus> = {}
  let officeDays = 0
  let remoteDays = 0
  let absentDays = 0
  let workingDays = 0

  for (let date = params.startDate; date <= params.endDate; date = nextDateKey(date)) {
    if (date > todayDate) {
      days[date] = 'future'
      continue
    }

    if (!isWorkday(date)) continue

    workingDays++
    const dayEvents = eventsByDay.get(date) ?? []

    if (dayEvents.length === 0) {
      days[date] = 'absent'
      absentDays++
    } else if (dayEvents.some((event) => isOfficeMatched(event.matched_by))) {
      days[date] = 'office'
      officeDays++
    } else {
      days[date] = 'remote'
      remoteDays++
    }
  }

  return { days, officeDays, remoteDays, absentDays, workingDays }
}
