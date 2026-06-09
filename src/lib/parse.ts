export function parseStringIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  if (!value.every((id) => typeof id === 'string')) return undefined
  return value as string[]
}
