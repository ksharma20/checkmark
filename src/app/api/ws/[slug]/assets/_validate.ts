/**
 * Shared body parsing for the asset routes.
 *
 * Lives beside the routes rather than in the query file because it is HTTP
 * concern: turning an untrusted JSON body into either a typed input or a field
 * error map. The query layer assumes it is handed values that already passed
 * through here.
 */

import { isAssetStatus, type AssetStatus } from '@/lib/db/queries/assets'

export type FieldErrors = Record<string, string>

/** Trim a string field, mapping empty to null so blank input clears a column. */
export function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export interface AssetBody {
  name?: string
  category?: string | null
  serial_number?: string | null
  condition?: string | null
  status?: AssetStatus
  purchase_value?: number | null
  notes?: string | null
}

/**
 * Validate an asset create/update body.
 *
 * `partial` distinguishes PATCH (nothing is required) from POST (`name` is).
 * Returns the fields that were actually present, so PATCH can tell "set this
 * to null" apart from "leave it alone" - `'category' in parsed` is the test.
 */
export function parseAssetBody(
  body: Record<string, unknown>,
  { partial }: { partial: boolean },
): { errors: FieldErrors; parsed: AssetBody } {
  const errors: FieldErrors = {}
  const parsed: AssetBody = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) errors.name = 'REQUIRED'
    else parsed.name = name
  } else if (!partial) {
    errors.name = 'REQUIRED'
  }

  for (const key of ['category', 'serial_number', 'condition', 'notes'] as const) {
    if (!(key in body)) continue
    const value = optionalString(body[key])
    if (value === undefined) errors[key] = 'INVALID'
    else parsed[key] = value
  }

  if ('status' in body) {
    if (!isAssetStatus(body.status)) errors.status = 'INVALID'
    else parsed.status = body.status
  }

  if ('purchase_value' in body) {
    const raw = body.purchase_value
    if (raw === null || raw === '') {
      parsed.purchase_value = null
    } else {
      const num = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(num) || num < 0) errors.purchase_value = 'INVALID'
      else parsed.purchase_value = num
    }
  }

  return { errors, parsed }
}
