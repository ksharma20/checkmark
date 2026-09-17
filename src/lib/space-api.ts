import { NextResponse } from 'next/server'
import { meSpace } from '@/locales/en/me-space'

/**
 * The shared request/response vocabulary of the `/me/space` routes.
 *
 * Eight small routes back the personal space, and every one of them has to
 * answer the same four questions identically: is there a session, is the body
 * JSON at all, is this row the caller's, and what shape does a refusal take.
 * Writing that out eight times is how the ninth route quietly answers 403 where
 * the other eight answer 404 - which on this surface is not a style difference
 * but a disclosure (see `notFound` below).
 *
 * Errors keep the repo's shape: `{ error, code }`, a human sentence from
 * `src/locales/en/me-space.ts` and a machine code the client can branch on.
 */

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
}

/** 400 - the request itself is wrong: unparseable, malformed, out of range. */
export function bad(error: string, code = 'VALIDATION_ERROR'): NextResponse {
  return NextResponse.json({ error, code }, { status: 400 })
}

/**
 * 404 - and it is what a row belonging to SOMEBODY ELSE gets, not 403.
 *
 * Every query in `notes.ts`, `todos.ts` and `focus.ts` carries `AND user_id = ?`
 * and returns null on a miss, so this route layer genuinely cannot tell "no such
 * id" from "not yours" - and that is deliberate. A 403 would confirm the id
 * exists, which turns an opaque identifier into an oracle: an attacker with a
 * list of ids learns which are real by the status code alone. Invariant 1 keeps
 * the user id off the request; this keeps the answer from leaking back.
 */
export function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
}

/**
 * Parse a JSON body into an object, or return the 400 to send instead.
 *
 * `typeof null === 'object'` in JavaScript, and `JSON.parse('null')` succeeds,
 * so the null check is not belt-and-braces - without it every `body.x` below
 * would throw a TypeError and the route would answer 500 to a request it should
 * have refused with 400. Arrays are refused for the same reason: `body.title` on
 * one is `undefined`, which reads as "key omitted" rather than as a bad body.
 */
export async function readJsonObject(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return { ok: false, response: bad(meSpace.saveFailed, 'INVALID_BODY') }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: bad(meSpace.saveFailed, 'INVALID_BODY') }
  }
  return { ok: true, body: parsed as Record<string, unknown> }
}

/**
 * Read an optional string field, distinguishing "absent" from "cleared".
 *
 * Three outcomes, and they are genuinely three - the same argument the session
 * ladder's `readRung()` makes. `undefined` means the key was absent and the
 * stored value stands; `null` means the member cleared it; a string means set
 * it. Collapsing the first two makes a field impossible to empty, because
 * "clear this" and "do not touch this" would arrive as the same value.
 *
 * A non-string, non-null value is REFUSED rather than coerced. `String(42)` is
 * `'42'` and `String({})` is `'[object Object]'`, and a to-do reading
 * "[object Object]" is a bug that has already been written to the database by
 * the time anyone sees it.
 */
export type OptionalField<T> = { ok: true; present: false } | { ok: true; present: true; value: T } | { ok: false }

export function readOptionalString(
  raw: unknown,
  maxLength: number,
  { nullable = true }: { nullable?: boolean } = {},
): OptionalField<string | null> {
  if (raw === undefined) return { ok: true, present: false }
  if (raw === null) return nullable ? { ok: true, present: true, value: null } : { ok: false }
  if (typeof raw !== 'string') return { ok: false }
  if (raw.length > maxLength) return { ok: false }
  return { ok: true, present: true, value: raw }
}

/** As above, for a flag. Absent leaves it alone; anything non-boolean is refused. */
export function readOptionalBoolean(raw: unknown): OptionalField<boolean> {
  if (raw === undefined) return { ok: true, present: false }
  if (typeof raw !== 'boolean') return { ok: false }
  return { ok: true, present: true, value: raw }
}

/**
 * A whole number inside a closed range.
 *
 * `Number.isInteger` rather than `Number.isFinite`: every integer the space
 * routes read is a count of something discrete - minutes, positions - and `2.5`
 * in a `display_order` sorts fine today and confuses every later `max + 1`.
 */
export function readInteger(
  raw: unknown,
  min: number,
  max: number,
): { ok: true; value: number } | { ok: false } {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return { ok: false }
  if (raw < min || raw > max) return { ok: false }
  return { ok: true, value: raw }
}
