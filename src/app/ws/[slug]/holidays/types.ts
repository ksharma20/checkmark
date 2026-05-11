export interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export function formatDateRange(year: number) {
  return `01-Jan-${year} - 31-Dec-${year}`
}

export function formatDate(iso: string): { full: string; day: string } {
  const [y, m, d] = iso.split('-')
  const day = DAYS[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()]
  return { full: `${d}-${MONTHS[parseInt(m) - 1]}-${y}`, day }
}
