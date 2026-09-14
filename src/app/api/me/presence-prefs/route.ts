import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import {
  getPresencePrefsForUser,
  setPresencePrefsForUser,
} from '@/lib/db/queries/presence-prefs'
import {
  MAX_AUTO_CHECKOUT_H,
  MAX_RUNG_H,
  MIN_AUTO_CHECKOUT_H,
  MIN_REPEAT_H,
  MIN_RUNG_H,
  resolveLadder,
  type MemberPresencePrefs,
} from '@/lib/presence-ladder'
import { meSettings } from '@/locales/en/me-settings'

const t = meSettings.settings.notifications.sessionLadder

/**
 * Placeholder URLs for the validation-only `resolveLadder()` call below.
 *
 * `resolveLadder` takes them because the real ones are produced by
 * `notificationHref()` in the cron route, which is the only place a rung is ever
 * pushed. Here nothing is pushed and nothing reads a `url` - the call is asking
 * the ladder "what would you generate from this row", and the answer's shape is
 * the whole interest. Resolving real hrefs would pull a push-side resolver into
 * a settings route for values that are then thrown away.
 */
const LADDER_PROBE_URLS = { checkin: '', extend: '' }

/**
 * The member's own session ladder: `GET` to read it, `PATCH` to change it.
 *
 * THERE IS NO WORKSPACE IN THIS PATH, and that is structural rather than an
 * omission. `presence_events` carries no `workspace_id` and deliberately never
 * will, so a member of two workspaces has ONE open check-in session - there is
 * nothing to scope these four numbers to except the account. That is also why it
 * sits at `/api/me/...` rather than `/api/me/ws/[slug]/...`: the sibling
 * reminder schedule IS per workspace, because everything it gates on (timezone,
 * working days, the holiday calendar, approved leave) belongs to a workspace,
 * and putting the two routes side by side would invite someone to "fix" the
 * inconsistency by giving this one a slug it cannot use.
 *
 * The user id comes from `getServerUser()`, i.e. the proxy-set header, never
 * from the body (invariant 1). There is no `userId` field in the contract at
 * all, so there is nothing to forget to ignore.
 */

/** The JSON body this route accepts. Every key optional; omitted = leave alone. */
interface PresencePrefsPatch {
  halfDayAfterH?: number | null
  fullDayAfterH?: number | null
  repeatEveryH?: number | null
  autoCheckoutAfterH?: number
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
}

function bad(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 })
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return unauthorized()

  // Always the resolved object, never "no row" - the client renders four fields
  // and a member who has never been here must still see their close time, which
  // is real (and enforced at check-in) whether or not a row exists.
  const prefs = await getPresencePrefsForUser(user.userId)
  return NextResponse.json(prefs)
}

/**
 * Read one optional rung out of the patch.
 *
 * Three outcomes, and they are genuinely three: `undefined` means the key was
 * absent and the stored value stands; `null` means the member cleared the rung;
 * a number means set it. Collapsing the first two - the usual `?? current`
 * shorthand - would make it impossible to ever turn a rung off, because "clear
 * this" and "do not touch this" would arrive as the same value.
 *
 * A non-number, non-null value is rejected rather than coerced: `Number('')` is
 * 0 and `Number(undefined)` is NaN, and a rung silently set to 0 would fire on
 * the same cron tick as the check-in itself.
 */
function readRung(
  raw: unknown,
  current: number | null,
): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined) return { ok: true, value: current }
  if (raw === null) return { ok: true, value: null }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return { ok: false }
  return { ok: true, value: raw }
}

export async function PATCH(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  let body: PresencePrefsPatch
  try {
    body = (await request.json()) as PresencePrefsPatch
  } catch {
    return bad(t.errorInvalidBody, 'INVALID_BODY')
  }
  if (typeof body !== 'object' || body === null) return bad(t.errorInvalidBody, 'INVALID_BODY')

  /**
   * VALIDATE THE MERGED STATE, NOT THE PATCH.
   *
   * The four values constrain each other, so a patch checked in isolation lets a
   * member walk into an invalid combination one field at a time: send
   * `fullDayAfterH: 4` today against a stored `halfDayAfterH: 6` and each
   * request looks fine on its own while the pair that results is out of order.
   * The rules below are rules about the ROW, so the row is what they are applied
   * to - read current, apply the patch, validate the result, then write.
   */
  const current = await getPresencePrefsForUser(user.userId)

  const half = readRung(body.halfDayAfterH, current.halfDayAfterH)
  const full = readRung(body.fullDayAfterH, current.fullDayAfterH)
  const repeat = readRung(body.repeatEveryH, current.repeatEveryH)
  if (!half.ok || !full.ok || !repeat.ok) return bad(t.errorInvalidBody, 'INVALID_BODY')

  // Auto-checkout takes no null arm. It is a MECHANIC, not a nudge: an open
  // `presence_events` row is what the day's attendance is computed from, so a
  // session with no close time leaves that day wrong - for the member and for
  // every workspace they are in - until somebody repairs it by hand, which
  // invariant 4 says cannot be done by editing the event.
  const rawClose = body.autoCheckoutAfterH
  if (rawClose !== undefined && (typeof rawClose !== 'number' || !Number.isFinite(rawClose))) {
    return bad(t.errorInvalidBody, 'INVALID_BODY')
  }

  const merged: MemberPresencePrefs = {
    halfDayAfterH: half.value,
    fullDayAfterH: full.value,
    repeatEveryH: repeat.value,
    autoCheckoutAfterH: rawClose === undefined ? current.autoCheckoutAfterH : rawClose,
  }

  // ── Ranges ─────────────────────────────────────────────────────────────────
  for (const rung of [merged.halfDayAfterH, merged.fullDayAfterH]) {
    if (rung !== null && (rung < MIN_RUNG_H || rung > MAX_RUNG_H)) {
      return bad(t.errorRange(MIN_RUNG_H, MAX_RUNG_H), 'OUT_OF_RANGE')
    }
  }
  // The repeat has its own floor and its own message: it is an INTERVAL, not an
  // hour count, so "enter between 0.5 and 24 hours since check-in" would be
  // describing the wrong quantity.
  if (merged.repeatEveryH !== null && merged.repeatEveryH < MIN_REPEAT_H) {
    return bad(t.errorRepeatRange(MIN_REPEAT_H), 'OUT_OF_RANGE')
  }
  if (
    merged.autoCheckoutAfterH < MIN_AUTO_CHECKOUT_H ||
    merged.autoCheckoutAfterH > MAX_AUTO_CHECKOUT_H
  ) {
    return bad(
      t.errorAutoCheckoutRange(MIN_AUTO_CHECKOUT_H, MAX_AUTO_CHECKOUT_H),
      'OUT_OF_RANGE',
    )
  }

  // ── Order ──────────────────────────────────────────────────────────────────
  // Only when BOTH are set: either alone is a perfectly coherent ladder, and
  // refusing a lone full-day rung because there is no half-day one to precede it
  // would be inventing a requirement the feature does not have.
  if (
    merged.halfDayAfterH !== null &&
    merged.fullDayAfterH !== null &&
    merged.halfDayAfterH >= merged.fullDayAfterH
  ) {
    return bad(t.errorAscending, 'NOT_ASCENDING')
  }

  /**
   * A repeat with no full-day mark.
   *
   * THIS ROUTE IS THE ONLY GUARD, and it has to be, which is why the refusal is
   * spelled out rather than left to the database. SQLite cannot attach a CHECK
   * to a column added by `ALTER TABLE`, and this constraint is conditional on
   * another nullable column in any case - no column-level CHECK could express
   * "not null only when that other one is not null either". It is exactly the
   * position `isParentalCaseType()` occupies for `maternity_cases.case_type`:
   * the database will not refuse a garbage combination, so every write path must
   * run its input through the check in code.
   *
   * `resolveLadder()` already ignores a repeat with no anchor, so the stored row
   * would be inert rather than dangerous - which is precisely the problem.
   * Accepting it would show the member a saved setting that generates nothing,
   * with nothing anywhere to say why.
   */
  if (merged.repeatEveryH !== null && merged.fullDayAfterH === null) {
    return bad(t.errorRepeatNeedsFullDay, 'REPEAT_NEEDS_FULL_DAY')
  }

  /**
   * A rung at or past the close time can never fire - the session is already
   * gone by then - so accepting it would let a member configure a nudge that
   * does nothing and never says so.
   *
   * At OR past, not merely past: a rung landing exactly on the close time would
   * race the auto-checkout notice, and the member would be told "you are still
   * checked in" and "we checked you out" in the same second. `resolveLadder()`
   * draws the overtime boundary with the same strict comparison for the same
   * reason, and the two must agree or the form promises rungs the ladder drops.
   */
  for (const rung of [merged.halfDayAfterH, merged.fullDayAfterH]) {
    if (rung !== null && rung >= merged.autoCheckoutAfterH) {
      return bad(t.errorAfterClose, 'AFTER_CLOSE')
    }
  }

  /**
   * A repeat interval too long to fit even ONE overtime rung before the close.
   *
   * The same failure `REPEAT_NEEDS_FULL_DAY` above exists to prevent, reached by
   * the other road: `resolveLadder()` emits overtime only while
   * `fullDayAfterH + n * repeatEveryH < autoCheckoutAfterH`, so `repeat: 50`
   * against a full day of 8 and a close at 12 puts the first candidate rung at
   * 58 hours and the loop breaks before it pushes anything. The row saves, the
   * form redisplays the 50, and not one overtime nudge is ever generated - a
   * setting that silently does nothing, which is exactly what that neighbouring
   * refusal calls unacceptable. The repeat had a floor (`MIN_REPEAT_H`) and no
   * ceiling, because its ceiling is not a constant: it depends on the two other
   * numbers in the same row.
   *
   * ASKED, NOT RE-DERIVED. The rule lives in `resolveLadder()` and this calls it
   * on the merged row rather than restating `full + repeat >= close` - the two
   * comparisons would then have to be kept in step by hand, and the failure mode
   * of their drifting apart is the silent one this refusal is here to close.
   * Anything past the full-day mark is an overtime rung by construction: the
   * only other rungs are half-day and full-day, and `NOT_ASCENDING` above has
   * already refused a half-day rung that sits after the full-day one.
   *
   * Runs after `AFTER_CLOSE` deliberately. A full-day mark that is itself past
   * the close would also produce no overtime, and blaming the repeat for that
   * would point the member at the wrong field.
   */
  const fullDay = merged.fullDayAfterH
  if (merged.repeatEveryH !== null && fullDay !== null) {
    const generatesOvertime = resolveLadder(merged, LADDER_PROBE_URLS).some(
      (rung) => rung.hours > fullDay,
    )
    if (!generatesOvertime) return bad(t.errorRepeatAfterClose, 'REPEAT_AFTER_CLOSE')
  }

  await setPresencePrefsForUser(user.userId, merged)

  // The full resolved object, same shape as GET, so the client can replace its
  // state from the response rather than re-deriving what it thinks it just sent.
  return NextResponse.json(merged)
}
