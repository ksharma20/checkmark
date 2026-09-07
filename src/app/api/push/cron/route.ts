import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventsForCron, updatePushRemindersSent, autoCheckoutEvent } from '@/lib/db/queries/events'
import { notifyPresence } from '@/lib/notify'
import { notificationHref } from '@/lib/client/notification-href'
import { presenceLadder } from '@/locales/en/notifications'
import { runReminderPass, type ReminderPassResult } from '@/lib/reminders'

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

/**
 * The presence ladder, in full.
 *
 * It used to be a bare `[4, 8, 12, 16, 18, 20, 22]` sharing one string, which
 * had two problems. Auto-checkout lands at 12h, so every rung past it was
 * unreachable code; and seven identical pushes are a nag, which is how somebody
 * revokes notification permission and loses their approval notices with it.
 *
 * Two rungs now, each with its own copy and its own destination. `key` is the
 * dedupe token written into `push_reminders_sent` and must never be reused for
 * a different meaning - a claimed key is claimed forever on that row.
 */
const LADDER: { hours: number; key: string; title: string; body: string; url: string }[] = [
  { hours: 5, key: '5h', ...presenceLadder.fiveHour, url: CHECKIN_URL },
  // The last chance to act, so it opens the picker rather than the home screen.
  { hours: 10, key: '10h', ...presenceLadder.tenHour, url: EXTEND_URL },
]

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

  for (const event of events) {
    try {
      const reminders: string[] = (() => {
        const parsed = JSON.parse(event.push_reminders_sent ?? '[]')
        return Array.isArray(parsed) ? parsed : []
      })()

      /**
       * Persist the dedupe key the moment a push is actually delivered.
       *
       * This used to be one write at the end of the event, after every push for
       * that event had been sent. GitHub Actions calls this endpoint with
       * `curl -m 30`: when the request is cut off mid-flight the pushes are
       * already out on the wire but `push_reminders_sent` was never written, so
       * the next tick sees a virgin row and sends the same notifications again.
       * Writing after each individual push makes the delivered set and the
       * recorded set diverge by at most one.
       */
      const claim = async (key: string) => {
        reminders.push(key)
        await updatePushRemindersSent(event.id, reminders)
      }

      const checkinMs = new Date(
        event.checkin_at.includes('T') ? event.checkin_at : event.checkin_at.replace(' ', 'T') + 'Z'
      ).getTime()
      const hoursElapsed = (now - checkinMs) / 3_600_000

      // 1. Ladder notifications — fire once per rung
      for (const step of LADDER) {
        if (hoursElapsed >= step.hours && !reminders.includes(step.key)) {
          await notifyPresence(event.user_id, {
            title: step.title,
            body: step.body,
            tag: `presence-${step.key}`,
            data: { url: step.url },
          })
          await claim(step.key)
        }
      }

      // 2. Auto-checkout — fires when the scheduled time has passed.
      //
      // Nothing warns beforehand any more: the 10h rung above is the last chance
      // to act, and it says so. A separate ≤60-minute warning carrying `Extend
      // 4h` / `Checkout Now` actions meant two pushes about the same deadline,
      // the second of which usually arrived while the phone was in a pocket.
      if (event.scheduled_checkout_at) {
        const checkoutMs = new Date(event.scheduled_checkout_at).getTime()

        if (now >= checkoutMs && !reminders.includes('autocheckedout')) {
          await autoCheckoutEvent(event.id, new Date(now).toISOString())
          await notifyPresence(event.user_id, {
            title: presenceLadder.autoCheckout.title,
            body: presenceLadder.autoCheckout.body,
            tag: 'presence-autocheckedout',
            data: { url: CHECKIN_URL },
          })
          await claim('autocheckedout')
        }
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
