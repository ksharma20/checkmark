import { NextRequest, NextResponse } from 'next/server'
import { getMostRecentOpenEvent, checkoutEvent } from '@/lib/db/queries/events'
import { updateUserStats } from '@/lib/stats'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const openEvent = await getMostRecentOpenEvent(userId)
  if (!openEvent) {
    return NextResponse.json({ error: 'No active check-in found', code: 'NO_ACTIVE_CHECKIN' }, { status: 404 })
  }

  const event = await checkoutEvent(openEvent.id, userId)
  if (!event) {
    return NextResponse.json({ error: 'Checkout failed', code: 'CHECKOUT_FAILED' }, { status: 500 })
  }

  const durationHours = event.checkout_at
    ? (new Date(event.checkout_at).getTime() - new Date(event.checkin_at).getTime()) / (1000 * 60 * 60)
    : null

  updateUserStats(userId).catch(console.error)

  return NextResponse.json({ event, duration_hours: durationHours })
}
