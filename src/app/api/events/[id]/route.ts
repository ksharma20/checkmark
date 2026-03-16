import { NextRequest, NextResponse } from 'next/server'
import { getEventById, updateEventNote, deleteEvent } from '@/lib/db/queries/events'

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

  const event = await getEventById(id)
  if (!event || event.user_id !== userId) {
    return NextResponse.json({ error: 'Event not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const updated = await updateEventNote(id, userId, body.note)
  return NextResponse.json({ event: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { id } = await params
  const deleted = await deleteEvent(id, userId)

  if (!deleted) {
    return NextResponse.json(
      { error: 'Event not found or cannot be deleted after 5 minutes', code: 'DELETE_FORBIDDEN' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}
