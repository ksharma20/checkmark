import { NextRequest, NextResponse } from 'next/server'
import {
  getOpenEventsForCron,
  updatePushRemindersSent,
  autoCheckoutEvent,
  isEventOpen,
} from '@/lib/db/queries/events'
import { getPresenceLadderPrefs } from '@/lib/db/queries/presence-prefs'
import {
  DEFAULT_PRESENCE_PREFS,
  LADDER_WINDOW_H,
  normaliseLadderKey,
  resolveLadder,
  type MemberPresencePrefs,
} from '@/lib/presence-ladder'
import { sendPushToUser } from '@/lib/push'
import { notificationHref } from '@/lib/client/notification-href'
import { presenceLadder } from '@/locales/en/notifications'
import { runReminderPass, type ReminderPassResult } from '@/lib/reminders'

/**
 * `sendPushToUser` is imported and called DIRECTLY here, and that is the second
 * sanctioned exception to invariant 24, alongside `src/lib/reminders.ts`.
 *
 * Two properties of the ladder are the argument, and neither is convenience.
 * First, it is PUSH-ONLY BY DESIGN: it writes no `notifications` row, because a
 * nudge to go home is worthless an hour later and a bell full of "still checked
 * in?" from last Tuesday is a bell nobody opens - which costs them the approval
 * notices that do matter. `notify()` cannot express "no feed row"; writing the
 * row unconditionally is the whole point of step 3 of its contract. Second, the
 * ladder resolves its schedule from ONE bulk read per batch (see below), where
 * `notify()` resolves preferences per call - 500 events would be 500 lookups.
 *
 * The preference check `notify()` exists to centralise is not being skipped, it
 * has moved: having a rung set at all IS the opt-in, so a member with no row
 * generates no rungs and this loop sends them nothing. There is no switch left
 * to forget to consult.
 */

/**
 * Destinations are built through the shared resolver rather than written as
 * literals, so a future move of `/me` cannot leave the service worker opening
 * one URL and the in-app row another.
 */
const CHECKIN_URL = notificationHref(
  { type: 'checkin_reminder', ref_type: null, ref_id: null },
  'me',
)
const EXTEND_URL = notificationHref(
  { type: 'presence_extend', ref_type: null, ref_id: null },
  'me',
)

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  // The same instant decides both the age cutoff and every elapsed-hours
  // calculation below, so a slow query cannot make an event pass the cutoff and
  // then be measured against a later clock.
  const events = await getOpenEventsForCron(new Date(now))

  /**
   * Every member's ladder, resolved ONCE for the whole batch.
   *
   * This loop runs up to CRON_EVENT_LIMIT (500) times every thirty minutes, so a
   * per-event lookup is 500 round trips to answer a question about a handful of
   * rows. Same shape as the one bulk preference read per workspace in
   * `lib/reminders.ts`.
   *
   * ON FAILURE THE SAFE DIRECTION IS NOW THE OPPOSITE OF WHAT IT USED TO BE, and
   * this paragraph is here because a future reader will otherwise "fix" it back.
   * The old code read a set of SILENCED user ids, so an empty set on failure
   * meant everybody heard their ladder - fail-open, and correct then, because
   * the ladder was hardcoded and on for everyone by default. The ladder is now
   * OPT-IN: an empty map means every member falls back to
   * DEFAULT_PRESENCE_PREFS, whose three rungs are all null, so a failed lookup
   * sends NOTHING. Silence is the default state of this feature, and a database
   * hiccup must not be able to promote a member into a schedule they never set.
   *
   * Auto-checkout is unaffected either way: it runs off the event's own
   * `scheduled_checkout_at`, written at check-in time, not off this map.
   */
  let ladderPrefs = new Map<string, MemberPresencePrefs>()
  try {
    ladderPrefs = await getPresenceLadderPrefs(events.map((e) => e.user_id))
  } catch (err) {
    console.error('[cron] presence ladder lookup failed; sending no ladder pushes:', err)
  }

  for (const event of events) {
    try {
      const reminders: string[] = (() => {
        const parsed = JSON.parse(event.push_reminders_sent ?? '[]')
        return Array.isArray(parsed) ? parsed : []
      })()

      /**
       * Keys claimed WITHOUT anything being sent, held until the next write.
       *
       * Only ever holds burnt rungs (see the staleness ceiling below). Nothing
       * that is about to be pushed is ever parked here, so a key in this buffer
       * can never be written by a path that has not already decided not to send
       * it.
       */
      const burnt: string[] = []

      /**
       * Persist the dedupe keys, in ONE write.
       *
       * Two separate things are being kept honest here.
       *
       * A DELIVERED key is persisted the moment its push is actually out. This
       * used to be one write at the very end of the event, after every push for
       * that event had been sent. GitHub Actions calls this endpoint with
       * `curl -m 30`: when the request is cut off mid-flight the pushes are
       * already on the wire but `push_reminders_sent` was never written, so the
       * next tick sees a virgin row and sends the same notifications again.
       * Writing right after each individual push keeps the delivered set and the
       * recorded set diverged by at most one.
       *
       * A BURNT key costs nothing to defer, because nothing was sent, so they
       * ride along with the next write instead of each paying for a round trip
       * of its own. That matters at the only moment it ever happens: after an
       * outage, a member with a short `repeat_every_h` can have ~47 overtime
       * rungs stale at once (`OT_MAX` in `scripts/drain-open-events.js` derives
       * the same bound), and one UPDATE per burnt rung made a single event cost
       * ~48 sequential round trips - enough, across a 500-event batch, to run
       * the whole request into that same `-m 30` and skip every event after it,
       * INCLUDING their unconditional auto-checkout. Batching cannot lose a
       * burn: an unwritten burnt key is simply re-evaluated on the next tick,
       * found stale again and burnt again. What invariant 30 forbids is a rung
       * that is *skipped* - never claimed by any tick, and so re-evaluated for
       * the life of the session - and the `finally` below is what guarantees the
       * buffer is always drained, even out of a throwing push.
       */
      const claim = async (...keys: string[]) => {
        if (burnt.length === 0 && keys.length === 0) return
        reminders.push(...burnt, ...keys)
        burnt.length = 0
        await updatePushRemindersSent(event.id, reminders)
      }

      try {
        /**
         * The claimed set, read through `normaliseLadderKey`.
         *
         * Sessions that were already open when this deployed hold the keys the old
         * hardcoded ladder wrote - `'5h'` and `'10h'`. Without the shim this would
         * find no `'half'` or `'full'` claimed and re-nudge somebody who was
         * nudged hours ago under the other names, which is the worst possible
         * first impression of a feature whose whole purpose is to nag less.
         *
         * Only the READ is normalised. Nothing rewrites `reminders`, and `claim()`
         * keeps appending modern keys to the array exactly as it found it: a
         * claimed key is claimed forever on that row, so normalising on read is
         * sufficient to answer "was this already sent", and rewriting the column
         * would be a write against live sessions for no behavioural gain.
         */
        const claimedKeys = new Set(reminders.map(normaliseLadderKey))

        const checkinMs = new Date(
          event.checkin_at.includes('T') ? event.checkin_at : event.checkin_at.replace(' ', 'T') + 'Z'
        ).getTime()
        const hoursElapsed = (now - checkinMs) / 3_600_000

        // 1. The member's own ladder. Absent prefs mean the defaults, whose rungs
        //    are all null - so `resolveLadder` returns an empty list and a member
        //    who has never opened the settings screen is silent, by construction
        //    rather than by a filter this loop has to remember to apply.
        const prefs = ladderPrefs.get(event.user_id) ?? DEFAULT_PRESENCE_PREFS
        const rungs = resolveLadder(prefs, { checkin: CHECKIN_URL, extend: EXTEND_URL })

        for (const step of rungs) {
          if (claimedKeys.has(step.key)) continue
          if (hoursElapsed < step.hours) continue

          /**
           * THE STALENESS CEILING - the fix for a reported bug, not a nicety.
           *
           * GitHub Actions cron is best-effort: it runs late, and during an outage
           * it does not run at all. Without this, an event first seen thirteen
           * hours old has every rung due at once, so the half-day push, the
           * full-day push and the auto-checkout notice land within seconds of each
           * other. Members reported exactly that as "I got my 5-hour notification
           * after I had already checked out", which is precisely what it looked
           * like from the phone. A rung delivered hours after its hour is not a
           * nudge about anything; the moment it was about has passed.
           *
           * BURNING THE RUNG RATHER THAN MERELY SKIPPING IT IS THE DELIBERATE
           * PART. A skipped rung stays unclaimed, so the next tick re-evaluates it,
           * finds it still stale, skips it again - forever, for the life of the
           * session, on every tick. Claiming it records the truth that this rung's
           * moment is over and takes it permanently out of consideration. The row's
           * state stays honest: `push_reminders_sent` means "this rung has been
           * dealt with", which is what every reader of it already assumes.
           *
           * The claim is BUFFERED, not skipped - see `claim()` above. Rungs are
           * ascending, so every stale rung is passed before the first live one,
           * and the live rung's own write (or the `finally` drain, if there is no
           * live rung) carries the whole burnt set in a single UPDATE.
           */
          if (hoursElapsed >= step.hours + LADDER_WINDOW_H) {
            burnt.push(step.key)
            continue
          }

          // The batch was read in one query and this loop has been awaiting pushes
          // ever since, so a member may have checked out in between. Re-read
          // immediately before sending rather than once per event - the window
          // spans the gap between rungs too.
          if (!(await isEventOpen(event.id))) break

          await sendPushToUser(event.user_id, {
            title: step.title,
            body: step.body,
            tag: `presence-${step.key}`,
            data: { url: step.url },
          })
          await claim(step.key)
        }

        // 2. Auto-checkout — fires when the scheduled time has passed.
        //
        // Nothing warns beforehand any more: the full-day rung above is the last
        // chance to act, and it says so. A separate ≤60-minute warning carrying
        // `Extend 4h` / `Checkout Now` actions meant two pushes about the same
        // deadline, the second of which usually arrived while the phone was in a
        // pocket.
        if (event.scheduled_checkout_at) {
          const checkoutMs = new Date(event.scheduled_checkout_at).getTime()

          if (now >= checkoutMs && !claimedKeys.has('autocheckedout')) {
            /**
             * The mechanic runs FIRST and UNCONDITIONALLY. A session must close
             * whether or not anybody is told: an open `presence_events` row is what
             * the day's attendance is computed from, and invariant 4 means it can
             * never be repaired by editing it afterwards.
             *
             * The push is likewise NOT suppressible by any preference, and is not
             * one of the configurable rungs above. It reports a FACT that has
             * already changed the member's attendance record - their day is now
             * closed, at a time they did not choose to close it - and a member is
             * entitled to be told that. It is also not subject to the staleness
             * ceiling for the same reason: unlike a nudge, it does not go stale,
             * because what it reports is still true whenever it arrives.
             *
             * It IS conditional on the write having done something. The UPDATE
             * carries `AND checkout_at IS NULL`, so a manual checkout that landed
             * first changes no rows - and announcing "we closed your session" to
             * somebody who closed it themselves is announcing a thing that did not
             * happen. The key is claimed either way: this event is resolved, and
             * leaving it unclaimed would re-run this branch on every future tick.
             */
            const closed = await autoCheckoutEvent(event.id, new Date(now).toISOString())
            if (closed) {
              await sendPushToUser(event.user_id, {
                title: presenceLadder.autoCheckout.title,
                body: presenceLadder.autoCheckout.body,
                tag: 'presence-autocheckedout',
                data: { url: CHECKIN_URL },
              })
            }
            await claim('autocheckedout')
          }
        }
      } finally {
        /**
         * The drain. Anything still buffered is burnt, never pending - so this
         * writes at most once more, and writes nothing at all when a live rung
         * or the auto-checkout above already carried the set. It sits in a
         * `finally` so a throwing push cannot leave a stale rung unclaimed for
         * the life of the session, which is the one outcome invariant 30 rules
         * out.
         */
        await claim()
      }
    } catch (err) {
      console.error(`[cron] failed to process event ${event.id}:`, err)
    }
  }

  // 3. Wall-clock check-in / check-out reminders.
  //
  // A second, workspace-anchored pass. The loop above starts from open events,
  // so it can only ever see people who are already checked in - it is
  // structurally incapable of noticing someone who never checked in at all.
  // Wrapped separately so a failure here cannot discard the work above.
  let reminders: ReminderPassResult | null = null
  try {
    reminders = await runReminderPass(new Date(now))
  } catch (err) {
    console.error('[cron] reminder pass failed:', err)
  }

  return NextResponse.json({ processed: events.length, reminders })
}
