import { NextRequest, NextResponse } from 'next/server'
import { getUserEvents } from '@/lib/db/queries/events'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const start = searchParams.get('start') ?? undefined
  const end = searchParams.get('end') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { events, total } = await getUserEvents({ userId, start, end, limit, offset })
  return NextResponse.json({ events, total })
}
