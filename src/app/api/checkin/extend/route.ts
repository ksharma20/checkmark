import { NextRequest, NextResponse } from 'next/server'
import { getOpenEvent, setScheduledCheckout } from '@/lib/db/queries/events'
import { nextMidnightUtc } from '@/lib/midnight'
import { getUserById } from '@/lib/db/queries/users'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const openEvent = await getOpenEvent(userId)
  if (!openEvent)
    return NextResponse.json({ error: 'Not checked in', code: 'NOT_CHECKED_IN' }, { status: 409 })

  const user = await getUserById(userId)
  const timezone = user?.timezone ?? 'UTC'

  // Extend by 8 hours from now, capped at next midnight
  const extendedAt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const nextMidnight = new Date(nextMidnightUtc(timezone))
  const scheduledCheckoutAt = extendedAt < nextMidnight
    ? extendedAt.toISOString()
    : nextMidnight.toISOString()

  await setScheduledCheckout(openEvent.id, scheduledCheckoutAt)

  return NextResponse.json({ extended: true, scheduled_checkout_at: scheduledCheckoutAt })
}
