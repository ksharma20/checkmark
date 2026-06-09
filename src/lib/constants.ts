export const MS_PER_DAY = 86400000

export function parseRawNum(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  return NaN
}

export function parseRawStr(value: unknown, lowercase = false): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return lowercase ? trimmed.toLowerCase() : trimmed
}
