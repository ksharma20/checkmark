/**
 * The open-session ladder: which pushes an open check-in earns, and when.
 *
 * PURE. No database access, no imports from `src/lib/db/**`, no React - exactly
 * like `src/lib/hierarchy.ts` and `src/lib/parental.ts`, and here for the same
 * sharp reason as the latter rather than for tidiness. The `/me/settings` screen
 * that edits these values is a CLIENT component and needs the bounds below at
 * runtime to build its inputs and validate them. If those constants lived in a
 * query file, importing them from that form would pull `lib/db/index.ts` into the
 * browser bundle and with it better-sqlite3 and libSQL - a build failure whose
 * error is a long `Can't resolve 'fs'` trace naming none of that. `import type`
 * is erased and is always safe; a runtime import is not. So anything both the
 * form and the cron need lives here, and the query file re-exports it for its own
 * callers.
 *
 * The locale module IS imported, and that is not a contradiction: a locale module
 * is plain data with no transitive dependency on the database, and `resolveLadder`
 * has to fill each rung's title and body from somewhere. Writing the copy inline
 * would put user-facing strings outside `src/locales/` (invariant 16).
 */
import { presenceLadder } from '@/locales/en/notifications'

/**
 * One member's ladder, as stored in `member_presence_prefs`.
 *
 * Account-scoped, not per workspace, and that follows from the data rather than
 * from a preference: `presence_events` has no `workspace_id` and deliberately
 * never will, so a member of two workspaces has ONE check-in session and there is
 * no workspace to key these on.
 *
 * A null rung is off. There is no separate enabled flag anywhere in this
 * feature - having set a value IS the opt-in - because two sources of truth for
 * "is this rung live" is two things to keep in step, and the one that drifts is
 * always the flag.
 */
export interface MemberPresencePrefs {
  /** "You are half way through a day." Null = never sent. */
  halfDayAfterH: number | null
  /** "Your day is complete." Null = never sent. */
  fullDayAfterH: number | null
  /** Overtime, repeating AFTER the full-day rung. Null = no overtime nudges. */
  repeatEveryH: number | null
  /** When the session is force-closed. Never null - see DEFAULT_PRESENCE_PREFS. */
  autoCheckoutAfterH: number
}

/**
 * What a member with NO row in `member_presence_prefs` gets.
 *
 * All three rungs null, so a member who has never opened these settings is
 * SILENT. The ladder is opt-in for a reason that has already cost us once: a
 * nudge nobody asked for is what makes a person revoke the browser's push
 * permission outright, and revoking it is not selective - it also costs them the
 * approval notifications they do want, which are the ones with consequences. A
 * quiet default is recoverable; a revoked permission is not.
 *
 * `autoCheckoutAfterH: 12` is NOT a preference and cannot be null. Auto-checkout
 * is a mechanic, not a nudge: a session that never closes leaves an open
 * `presence_events` row that the day's attendance is computed against, so the
 * member's day is simply wrong until somebody notices. 12 is the value
 * `src/app/api/checkin/route.ts` hardcoded before this table existed, kept so
 * nobody's behaviour changes on the deploy - only their ability to change it.
 */
export const DEFAULT_PRESENCE_PREFS: MemberPresencePrefs = {
  halfDayAfterH: null,
  fullDayAfterH: null,
  repeatEveryH: null,
  autoCheckoutAfterH: 12,
}

/**
 * The earliest hour a rung may be set to.
 *
 * Half an hour, not zero. A rung at 0 would fire on the same cron tick as the
 * check-in itself, which reads as a bug rather than as a nudge, and a rung below
 * the tick interval cannot be delivered on time anyway.
 */
export const MIN_RUNG_H = 0.5

/** A rung past a full day is unreachable - the session is closed by then. */
export const MAX_RUNG_H = 24

/**
 * The shortest overtime interval.
 *
 * Same floor as a rung, and the reason is the same: below the cron's own
 * granularity the member is asking for pushes that cannot arrive when they said.
 * It is also the guard that keeps `resolveLadder` from generating hundreds of
 * rungs between the full-day mark and auto-checkout.
 */
export const MIN_REPEAT_H = 0.5

/** Below an hour, auto-checkout would close sessions people are still inside. */
export const MIN_AUTO_CHECKOUT_H = 1

/**
 * The hard ceiling on an open session, in hours.
 *
 * This is the SAME 24-hour cap `src/app/api/checkin/extend/route.ts` already
 * enforces when it clamps a requested extension to `checkin_at + 24h`. It lives
 * here so the check-in route (which sets the initial scheduled checkout), the
 * extend route (which moves it) and the `/me/settings` form (which bounds the
 * input) all read ONE definition. Before this it was three separate literals in
 * three files, which is the arrangement where one of them gets raised and the
 * other two silently disagree with it.
 */
export const MAX_AUTO_CHECKOUT_H = 24

/**
 * How long after a rung's hour that rung may still be delivered, in hours.
 *
 * Past this window the rung is CLAIMED WITHOUT BEING SENT - the dedupe token
 * goes into `presence_events.push_reminders_sent` and no push leaves. That is
 * the fix for a real reported bug, not a nicety. GitHub Actions cron is
 * best-effort and routinely runs late or not at all, so after an outage an event
 * thirteen hours old would be seen for the first time with every rung due at
 * once: the half-day push, the full-day push and the auto-checkout notice would
 * land within seconds of each other. Members reported that as "I got my 5-hour
 * notification after checkout", which is exactly what it looked like.
 *
 * Claiming rather than skipping matters: a skipped rung is still unclaimed, so
 * the next tick would try to send it again and again for the life of the session.
 */
export const LADDER_WINDOW_H = 1.5

/**
 * The hard ceiling on how many overtime rungs one session can generate.
 *
 * DERIVED, not chosen: the longest a session can run is `MAX_AUTO_CHECKOUT_H`
 * and the shortest gap between overtime rungs is `MIN_REPEAT_H`, so a valid
 * ladder cannot reach this number - the full-day mark is at least `MIN_RUNG_H`
 * into the session, which costs it a rung before the first one is emitted. It is
 * therefore INERT for every input the API will accept, and that is the point: it
 * changes no behaviour and exists only so the loop in `resolveLadder` cannot run
 * unbounded.
 *
 * The arithmetic bound the loop used to rely on silently assumed finite inputs.
 * `hours >= autoCheckoutAfterH` is false FOREVER when either side is `NaN`, so a
 * single non-numeric value in `member_presence_prefs` - a column with no CHECK
 * constraint, in a loosely typed database - turned this into an infinite loop
 * that pushes rungs until the process dies. The query layer now flattens such a
 * value before it gets here; this is the second line, because a pure function
 * that can hang its caller is not acceptable however well guarded that caller is
 * TODAY, and this one is reached from a request handler and from the cron.
 */
export const MAX_OVERTIME_RUNGS = Math.ceil(MAX_AUTO_CHECKOUT_H / MIN_REPEAT_H)

/** One step of a member's ladder, ready to push. */
export interface LadderRung {
  hours: number
  /** Dedupe token written into presence_events.push_reminders_sent. */
  key: string
  title: string
  body: string
  url: string
}

/**
 * Expand a member's four numbers into the ordered list of pushes their session
 * earns.
 *
 * The `url` strings are PARAMETERS rather than literals. They are produced by
 * `notificationHref()` in the cron route, so resolving them here would mean
 * either importing that resolver into this module or writing the paths a second
 * time - and a hardcoded path is precisely how the announcement fan-out drifted
 * from the resolver and started pushing a URL with an unencoded slug. One
 * resolver, one caller, passed in.
 */
export function resolveLadder(
  prefs: MemberPresencePrefs,
  urls: { checkin: string; extend: string },
): LadderRung[] {
  const { halfDayAfterH, fullDayAfterH, repeatEveryH, autoCheckoutAfterH } = prefs
  const rungs: LadderRung[] = []

  // No urgency, so it opens the check-in screen rather than the extension
  // picker: there is nothing to decide yet, and offering a decision here would
  // make the later full-day rung indistinguishable from this one.
  if (halfDayAfterH !== null) {
    rungs.push({
      hours: halfDayAfterH,
      key: 'half',
      title: presenceLadder.halfDay.title,
      body: presenceLadder.halfDay.body(halfDayAfterH),
      url: urls.checkin,
    })
  }

  // The last chance to act, so it opens the extension picker directly. From
  // here the only two honest answers are "check out" and "tell us you are still
  // working", and the second one needs a screen.
  if (fullDayAfterH !== null) {
    rungs.push({
      hours: fullDayAfterH,
      key: 'full',
      title: presenceLadder.fullDay.title,
      body: presenceLadder.fullDay.body(fullDayAfterH),
      url: urls.extend,
    })
  }

  /**
   * Overtime needs BOTH values: an interval with no full-day mark has nothing
   * to repeat after, and silently anchoring it on the half-day rung - or on the
   * check-in - would be this function inventing a schedule the member never set.
   *
   * The defensive `repeatEveryH > 0` is not redundant with the API's validation.
   * A zero or negative interval makes the loop below never advance, and a pure
   * function that can hang the cron process is not acceptable however well
   * guarded its callers are today; callers are added, and this one is called
   * from a request handler.
   */
  if (repeatEveryH !== null && fullDayAfterH !== null && repeatEveryH > 0) {
    /**
     * Bounded by auto-checkout - the count bound beside it is a backstop that
     * no valid ladder reaches, not a cap on what a member may configure.
     *
     * The session closing is the natural limit, and it is a limit the member
     * set themselves on the same screen. So somebody who asks to be pinged
     * every 30 minutes past their ninth hour gets exactly that, six times,
     * until the session closes at twelve. Capping the count instead would mean
     * silently ignoring half of what they configured.
     *
     * Strictly less than, not less than or equal: a rung landing exactly on
     * `autoCheckoutAfterH` would fire alongside the auto-checkout notice, so
     * the member would be told "you are still checked in" and "we checked you
     * out" in the same breath. It is written as the NEGATION of that test
     * rather than as `>=` so the unknown case falls on the safe side: both
     * spellings agree for every finite pair, and where one side is `NaN` the
     * negated form stops instead of emitting a rung whose hour is unknowable.
     *
     * The iteration count is bounded arithmetically by MAX_AUTO_CHECKOUT_H /
     * MIN_REPEAT_H once the guard above holds - but ONLY for finite values, and
     * that assumption was unstated and load-bearing. `hours >= autoCheckoutAfterH`
     * is false forever if either side is `NaN`, which no amount of guarding the
     * interval catches. `MAX_OVERTIME_RUNGS` is the structural bound that makes
     * termination independent of the inputs; it is unreachable for any ladder the
     * API accepts, so nothing valid behaves differently.
     */
    for (let n = 1; n <= MAX_OVERTIME_RUNGS; n++) {
      const hours = fullDayAfterH + n * repeatEveryH
      if (!(hours < autoCheckoutAfterH)) break
      rungs.push({
        hours,
        key: `ot-${n}`,
        title: presenceLadder.overtime.title,
        body: presenceLadder.overtime.body(hours),
        url: urls.extend,
      })
    }
  }

  // Ascending, because the caller walks it against elapsed hours and stops at
  // the first rung it has not claimed. The three sources above are already in
  // order for a sane configuration, but the API accepts a half-day rung later
  // than a full-day one being corrected in either order, and a mis-sorted
  // ladder would claim rungs out of sequence.
  return rungs.sort((a, b) => a.hours - b.hours)
}

/**
 * Map a legacy `push_reminders_sent` key onto its modern equivalent.
 *
 * Sessions that were already open when this deployed hold the keys the old
 * hardcoded ladder wrote: `'5h'` and `'10h'`. Without this shim the cron would
 * read those rows, find no `'half'` or `'full'` claimed, and re-nudge somebody
 * who was nudged hours ago under the old names - the worst possible first
 * impression of a feature whose entire purpose is to nag less.
 *
 * Read-side only. Nothing is rewritten, because a claimed key is claimed forever
 * on that row and normalising on read is sufficient to decide "has this already
 * been sent"; a migration that rewrote the column would be a write against
 * live sessions for no behavioural gain.
 *
 * Deletable once no event predating the deploy can still be open. The cron's own
 * 48-hour age cutoff (`CRON_MAX_EVENT_AGE_H`) is that horizon: past it, no such
 * event is ever fetched again.
 */
export function normaliseLadderKey(key: string): string {
  if (key === '5h') return 'half'
  if (key === '10h') return 'full'
  // `'autocheckedout'` never changed name and is listed rather than left to the
  // fallthrough so the full legacy vocabulary is visible in one place.
  if (key === 'autocheckedout') return 'autocheckedout'
  return key
}
