import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventsForCron, updatePushRemindersSent, autoCheckoutEvent } from '@/lib/db/queries/events'
import { sendPushToUser } from '@/lib/push'

const MILESTONES_H = [4, 8, 12, 16, 18, 20, 22]

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const events = await getOpenEventsForCron()
  const now = Date.now()

  for (const event of events) {
    try {
      const reminders: string[] = (() => {
        const parsed = JSON.parse(event.push_reminders_sent ?? '[]')
        return Array.isArray(parsed) ? parsed : []
      })()
      let changed = false

      const checkinMs = new Date(
        event.checkin_at.includes('T') ? event.checkin_at : event.checkin_at.replace(' ', 'T') + 'Z'
      ).getTime()
      const hoursElapsed = (now - checkinMs) / 3_600_000

      // 1. Milestone notifications — fire once per milestone hour
      for (const h of MILESTONES_H) {
        const key = `${h}h`
        if (hoursElapsed >= h && !reminders.includes(key)) {
          await sendPushToUser(event.user_id, {
            title: 'Still working?',
            body: `You've been checked in for ${h} hours.`,
            tag: `milestone-${h}h`,
          })
          reminders.push(key)
          changed = true
        }
      }

      if (event.scheduled_checkout_at) {
        const checkoutMs = new Date(event.scheduled_checkout_at).getTime()
        const minsRemaining = (checkoutMs - now) / 60_000
        const warnKey = `warn_${event.scheduled_checkout_at.slice(0, 16)}`

        // 2. Warning push — fires when checkout is within this cron window (≤60 min away)
        if (minsRemaining > 0 && minsRemaining <= 60 && !reminders.includes(warnKey)) {
          const hardLimitMs = checkinMs + 24 * 3_600_000
          const canExtend = checkoutMs + 4 * 3_600_000 <= hardLimitMs
          const minsLabel = Math.round(minsRemaining)

          await sendPushToUser(event.user_id, {
            title: 'Auto-checkout soon',
            body: `Auto-checkout in ~${minsLabel} min. Hours without your location won't count. Checkout with location or extend if still working.`,
            tag: 'auto-checkout-warning',
            requireInteraction: true,
            actions: [
              ...(canExtend ? [{ action: 'extend', title: 'Extend 4h' }] : []),
              { action: 'checkout', title: 'Checkout Now' },
            ],
          })
          reminders.push(warnKey)
          changed = true
        }

        // 3. Auto-checkout — fires when scheduled time has passed
        if (now >= checkoutMs && !reminders.includes('autocheckedout')) {
          await autoCheckoutEvent(event.id, new Date(now).toISOString())
          await sendPushToUser(event.user_id, {
            title: 'Auto-checked out',
            body: "You've been auto-checked out. Hours logged without location data won't count in reports.",
            tag: 'auto-checked-out',
          })
          reminders.push('autocheckedout')
          changed = true
        }
      }

      if (changed) {
        await updatePushRemindersSent(event.id, reminders)
      }
    } catch (err) {
      console.error(`[cron] failed to process event ${event.id}:`, err)
    }
  }

  return NextResponse.json({ processed: events.length })
}
