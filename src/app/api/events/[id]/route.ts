import { NextRequest, NextResponse } from 'next/server'
import { getEventByIdForUser, updateEventNote } from '@/lib/db/queries/events'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { id } = await params
  let body: { note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  if (body.note === undefined) {
    return NextResponse.json({ error: 'note field required', code: 'MISSING_FIELD' }, { status: 400 })
  }

  const event = await getEventByIdForUser(id, userId)
  if (!event) {
    return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const updated = await updateEventNote(id, userId, body.note)
  return NextResponse.json({ event: updated })
}

// Presence data is never permanently deleted - soft-delete only
export async function DELETE() {
  return NextResponse.json(
    { error: 'Presence data cannot be deleted', code: 'NOT_SUPPORTED' },
    { status: 405 }
  )
}
