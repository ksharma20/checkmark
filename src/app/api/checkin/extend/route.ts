import { NextRequest, NextResponse } from 'next/server'
import { getOpenEvent, setScheduledCheckout } from '@/lib/db/queries/events'
import { extendSession } from '@/locales/en/notifications'

/**
 * How long a member may push their auto-checkout back, in one go.
 *
 * A closed allow-list rather than a range check: the picker offers exactly these
 * five, and an arbitrary number of hours from the client is a number nobody
 * chose from a screen. The 24h hard cap below still applies on top - this bounds
 * the *step*, that bounds the total.
 */
const ALLOWED_EXTENSION_H = [2, 4, 6, 8, 12]

/** What the service worker's `extend` action gets, since it posts no body. */
const DEFAULT_EXTENSION_H = 4

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  // The service worker posts with no body and no Content-Type, so parsing has to
  // survive an empty request rather than 500 on it - that call site predates the
  // picker and must keep working untouched.
  const body = await request.json().catch(() => ({}))
  const requested = (body as { hours?: unknown }).hours
  const hours = requested === undefined || requested === null ? DEFAULT_EXTENSION_H : requested

  if (typeof hours !== 'number' || !ALLOWED_EXTENSION_H.includes(hours)) {
    return NextResponse.json(
      { error: extendSession.errorInvalidExtension, code: 'INVALID_EXTENSION' },
      { status: 400 }
    )
  }

  const openEvent = await getOpenEvent(userId)
  if (!openEvent)
    return NextResponse.json({ error: 'Not checked in', code: 'NOT_CHECKED_IN' }, { status: 409 })

  const checkinMs = new Date(
    openEvent.checkin_at.includes('T')
      ? openEvent.checkin_at
      : openEvent.checkin_at.replace(' ', 'T') + 'Z'
  ).getTime()
  const hardLimitMs = checkinMs + 24 * 60 * 60 * 1000

  const currentScheduledMs = openEvent.scheduled_checkout_at
    ? new Date(openEvent.scheduled_checkout_at).getTime()
    : Date.now()

  if (currentScheduledMs >= hardLimitMs) {
    return NextResponse.json(
      { error: 'Cannot extend past 24 hours', code: 'MAX_DURATION_REACHED' },
      { status: 409 }
    )
  }

  // Clamped, not refused. Somebody at hour 20 asking for 12 more wants as much
  // as they can have; erroring would leave them checked out at the old time for
  // the sake of a technicality they cannot see.
  const extendedMs = currentScheduledMs + hours * 60 * 60 * 1000
  const scheduledCheckoutAt = new Date(Math.min(extendedMs, hardLimitMs)).toISOString()

  await setScheduledCheckout(openEvent.id, scheduledCheckoutAt)

  return NextResponse.json({ extended: true, scheduled_checkout_at: scheduledCheckoutAt })
}
