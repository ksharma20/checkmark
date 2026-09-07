export interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/**
 * Formats a stored `YYYY-MM-DD` without going through the Date constructor for
 * the display half: parsing a bare date string as local time shifts the day for
 * anyone west of UTC. Only the weekday needs a Date, and that is built from the
 * parts rather than the string.
 */
export function formatDate(iso: string): { full: string; day: string } {
  const [y, m, d] = iso.split('-')
  const day = DAYS[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()]
  return { full: `${d}-${MONTHS[parseInt(m) - 1]}-${y}`, day }
}
