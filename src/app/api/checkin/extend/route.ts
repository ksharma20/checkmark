import { NextRequest, NextResponse } from 'next/server'
import { getOpenEvent, setScheduledCheckout } from '@/lib/db/queries/events'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

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

  const extendedMs = currentScheduledMs + 4 * 60 * 60 * 1000
  const scheduledCheckoutAt = new Date(Math.min(extendedMs, hardLimitMs)).toISOString()

  await setScheduledCheckout(openEvent.id, scheduledCheckoutAt)

  return NextResponse.json({ extended: true, scheduled_checkout_at: scheduledCheckoutAt })
}
