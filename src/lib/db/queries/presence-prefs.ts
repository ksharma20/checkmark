import { db } from '../index'
import { DEFAULT_PRESENCE_PREFS, type MemberPresencePrefs } from '@/lib/presence-ladder'

/**
 * The read/write path for `member_presence_prefs` - one member's session ladder.
 *
 * ACCOUNT-scoped, keyed on `user_id` alone, and that is structural rather than a
 * preference. `presence_events` carries no `workspace_id` and deliberately never
 * will, so a member of two workspaces has ONE open check-in session and there is
 * no workspace to key a ladder on. Asking "which workspace's rungs apply to this
 * session" has no answer, and inventing one would put two ladders in a race to
 * push about the same row.
 *
 * The shapes and bounds live in `src/lib/presence-ladder.ts`, not here, and are
 * only re-exported below. That module is pure because the `/me/settings` form
 * that edits these values is a CLIENT component: a runtime import from this file
 * would drag `lib/db/index.ts` - and with it better-sqlite3 and libSQL - into the
 * browser bundle, and the build failure that causes is a long `Can't resolve
 * 'fs'` trace naming none of it.
 */

/** Re-exported so a server-side caller needs one import, not two. */
export { DEFAULT_PRESENCE_PREFS }
export type { MemberPresencePrefs }

/**
 * The row as SQLite hands it back: snake_case, and every rung nullable.
 *
 * These types are DOCUMENTATION, not enforcement - nothing checks them against
 * the database, SQLite stores whatever a writer put in the column, and neither
 * driver validates on the way out. `toPrefs` below treats them as claims to be
 * flattened rather than as facts.
 */
interface PresencePrefsRow {
  user_id: string
  half_day_after_h: number | null
  full_day_after_h: number | null
  repeat_every_h: number | null
  auto_checkout_after_h: number
}

/**
 * One stored rung, flattened to a finite number or to "off".
 *
 * The `== null` test is deliberately loose: it catches SQL NULL arriving as
 * either `null` or `undefined`, and `Number(null)` is `0` - which would silently
 * turn "this rung is off" into "this rung fires the instant you check in".
 *
 * NULLNESS IS NOT THE ONLY WAY A COLUMN CAN BE UNREADABLE, and finiteness is
 * checked for the same reason rather than as belt-and-braces. `Number()` of
 * anything non-numeric is `NaN`; the rung columns carry no CHECK constraint and
 * SQLite is loosely typed, so a value no route would have accepted can still
 * arrive from a migration, a support fix or a future importer - which is the
 * exact class of write the auto-checkout clamp in `/api/checkin` already cites.
 *
 * `NaN` is worse here than either `0` or `null`, because EVERY comparison
 * against it is false rather than merely wrong, so it does not produce a wrong
 * answer - it produces NO answer. A `NaN` reaching the overtime loop in
 * `resolveLadder()` used to defeat its hour-vs-auto-checkout exit test outright
 * and the loop pushed rungs until the process died; that loop now carries its
 * own structural bound, and this is the layer that stops the value instead of
 * containing it. A rung nobody can read is OFF - which is what absence already
 * means, so it needs no new state to express.
 */
function toRung(value: number | null): number | null {
  if (value == null) return null
  const hours = Number(value)
  return Number.isFinite(hours) ? hours : null
}

/**
 * Auto-checkout, flattened to a finite number ALWAYS.
 *
 * It cannot fall back to null the way a rung does, because the column is NOT
 * NULL and the asymmetry is the point (invariant 31): the rungs are nudges and
 * switching one off costs a buzz, whereas auto-checkout is a MECHANIC - an open
 * `presence_events` row is what the day's attendance is computed from, and
 * invariant 4 forbids repairing it by editing afterwards. So an unreadable value
 * resolves to the documented default, which is both what a member with no row
 * gets and the 12 `src/app/api/checkin/route.ts` hardcoded before this table
 * existed. Reinterpreting one corrupt row as "the default" is recoverable;
 * leaving it unbounded is not.
 *
 * Propagating `NaN` instead costs more than a wrong ladder. `/api/checkin`
 * schedules the close from this number, and `Math.min(24, Math.max(1, NaN))` is
 * `NaN`, so `new Date(Date.now() + NaN).toISOString()` throws `RangeError` -
 * AFTER the presence event row has already been inserted, i.e. a check-in that
 * reports failure having actually happened.
 *
 * ABSENCE IS CHECKED SEPARATELY FROM FINITENESS, and not as belt-and-braces:
 * `Number(null)` is `0`, which is finite and would sail past the test below as
 * a real answer meaning "close this session the instant it opens". The schema's
 * NOT NULL is what should make that unreachable, but this function's whole job
 * is to hold when the schema has not - and a column dropped from a future
 * SELECT arrives as `undefined` with no schema involved at all.
 *
 * The range is deliberately NOT clamped here. `/api/checkin` clamps into
 * [MIN_AUTO_CHECKOUT_H, MAX_AUTO_CHECKOUT_H] before scheduling, and a second
 * clamp at this layer would be a second source of truth for one bound - the
 * thing that has to be avoided is an unusable value, not an unusual one.
 */
function toAutoCheckoutH(value: number): number {
  if (value == null) return DEFAULT_PRESENCE_PREFS.autoCheckoutAfterH
  const hours = Number(value)
  return Number.isFinite(hours) ? hours : DEFAULT_PRESENCE_PREFS.autoCheckoutAfterH
}

/**
 * Map a row onto the interface, one column at a time.
 *
 * Explicit rather than a spread, for two reasons that are both silent when got
 * wrong. The columns are snake_case and the interface is camelCase, so a spread
 * would produce an object that satisfies nothing and typechecks nowhere useful;
 * and the numeric columns are REAL, which better-sqlite3 and libSQL do not agree
 * on the JavaScript type of - libSQL can hand back a value that is not a
 * `number` for the same column better-sqlite3 gives a plain one. `Number()`
 * flattens both, the same trick `toMuted()` plays on the INTEGER column in
 * `notification-prefs.ts`.
 *
 * Flattening is what makes this the RIGHT layer for the finiteness guard too:
 * everything downstream - the ladder, the checkout scheduler, the settings form -
 * reads `MemberPresencePrefs` and none of it re-validates, so a value that leaves
 * here finite is finite everywhere. See `toRung` and `toAutoCheckoutH`.
 */
function toPrefs(row: PresencePrefsRow): MemberPresencePrefs {
  return {
    halfDayAfterH: toRung(row.half_day_after_h),
    fullDayAfterH: toRung(row.full_day_after_h),
    repeatEveryH: toRung(row.repeat_every_h),
    autoCheckoutAfterH: toAutoCheckoutH(row.auto_checkout_after_h),
  }
}

/**
 * Every stored ladder among these members, as a map from user id to their prefs.
 *
 * THE BULK READ, and the shape the push cron needs. That loop runs up to
 * `CRON_EVENT_LIMIT` (500) times every thirty minutes, so a per-event lookup is
 * 500 round trips to answer a question about a handful of rows - the ladder is
 * opt-in, so most of those 500 members have no row at all. Same argument, and
 * the same shape, as the one bulk `getCategoryChoices()` read per workspace in
 * the wall-clock reminder pass.
 *
 * That 500 is also why the `IN (...)` list is NOT chunked. SQLite's default
 * parameter ceiling is in the hundreds of thousands (999 on very old builds, and
 * the de-duplicated id count is well under even that), so the bound the cron
 * already enforces keeps this one statement safe without a batching loop nobody
 * would ever be able to exercise.
 *
 * MEMBERS WITH NO ROW ARE SIMPLY ABSENT, and a caller must resolve every id it
 * asked about against `DEFAULT_PRESENCE_PREFS` rather than iterating the rows it
 * got back. For an opt-in feature the members who matter are precisely the ones
 * this table has no rows for: iterating the result would silently process only
 * the minority who have configured something, which happens to look correct for
 * the ladder (a default member earns no pushes) and is wrong for auto-checkout,
 * which every member has whether they set it or not.
 *
 * Ids are de-duplicated before the placeholders are built: the caller passes one
 * id per open EVENT, and one member can hold several rows in the batch after an
 * outage, which would otherwise repeat the same parameter needlessly.
 */
export async function getPresenceLadderPrefs(
  userIds: string[],
): Promise<Map<string, MemberPresencePrefs>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const placeholders = unique.map(() => '?').join(', ')
  const rows = await db.query<PresencePrefsRow>(
    `SELECT user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h
     FROM member_presence_prefs
     WHERE user_id IN (${placeholders})`,
    unique,
  )

  const byUser = new Map<string, MemberPresencePrefs>()
  for (const row of rows) byUser.set(row.user_id, toPrefs(row))
  return byUser
}

/**
 * One member's ladder, resolved - never null.
 *
 * The fallback is here rather than at the call sites because there are two of
 * them with very different stakes: the settings screen, where a default is a
 * pre-filled form, and `/api/checkin`, where it decides when somebody's session
 * closes. A route that had to remember to apply the default itself is a route
 * that can forget, and forgetting means `autoCheckoutAfterH` is `undefined` and
 * the scheduled checkout is `Invalid Date`.
 */
export async function getPresencePrefsForUser(userId: string): Promise<MemberPresencePrefs> {
  const row = await db.queryOne<PresencePrefsRow>(
    `SELECT user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h
     FROM member_presence_prefs
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  return row ? toPrefs(row) : DEFAULT_PRESENCE_PREFS
}

/**
 * Write this member's whole ladder.
 *
 * Takes the COMPLETE object, not a patch. The rungs constrain each other -
 * a repeat is meaningless without a full-day mark, and no rung may sit at or
 * past auto-checkout - so a partial write at this layer would be a write that
 * cannot check its own result. The merge-then-validate happens one level up, in
 * `/api/me/presence-prefs`, against the member's current stored values.
 *
 * Two statements rather than an `ON CONFLICT` upsert, for the same reason as
 * `setCategoryMuted()`: `INSERT OR IGNORE` then `UPDATE` reaches the same state
 * and is race-safe in the way that matters here. The PRIMARY KEY on `user_id`
 * decides which of two concurrent tabs creates the row, the loser's insert is
 * ignored rather than raising, and the UPDATE then sets the values on whichever
 * row survived. Either tab's save wins whole; neither can half-apply.
 *
 * `updated_at` is set by the UPDATE and never by the INSERT, which is exactly
 * right: the INSERT's column default is `datetime('now')` already, and the row
 * that matters is always the one the UPDATE touches.
 */
export async function setPresencePrefsForUser(
  userId: string,
  prefs: MemberPresencePrefs,
): Promise<void> {
  await db.execute(
    `INSERT OR IGNORE INTO member_presence_prefs
       (user_id, half_day_after_h, full_day_after_h, repeat_every_h, auto_checkout_after_h)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      prefs.halfDayAfterH,
      prefs.fullDayAfterH,
      prefs.repeatEveryH,
      prefs.autoCheckoutAfterH,
    ],
  )

  await db.execute(
    `UPDATE member_presence_prefs
     SET half_day_after_h = ?, full_day_after_h = ?, repeat_every_h = ?,
         auto_checkout_after_h = ?, updated_at = datetime('now')
     WHERE user_id = ?`,
    [
      prefs.halfDayAfterH,
      prefs.fullDayAfterH,
      prefs.repeatEveryH,
      prefs.autoCheckoutAfterH,
      userId,
    ],
  )
}
