import { NextRequest, NextResponse } from 'next/server'
import { getNotificationsForUser, getUnreadCount } from '@/lib/db/queries/notifications'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  const [notifications, unread_count] = await Promise.all([
    getNotificationsForUser(userId),
    getUnreadCount(userId),
  ])
  return NextResponse.json({ notifications, unread_count })
}
