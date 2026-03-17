import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventToday } from '@/lib/db/queries/events'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const openEvent = await getOpenEventToday(userId)

  if (openEvent) {
    return NextResponse.json({
      state: 'checked_in',
      activeEvent: {
        id: openEvent.id,
        checkin_at: openEvent.checkin_at,
        note: openEvent.note,
        event_type: openEvent.event_type,
      },
    })
  }

  return NextResponse.json({ state: 'checked_out', activeEvent: null })
}
