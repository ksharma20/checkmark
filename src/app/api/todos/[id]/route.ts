import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { softDeleteTodo, updateTodo, type TodoPatch } from '@/lib/db/queries/todos'
import { MAX_TODO_TEXT_LEN, isDateKey, isTodoPriority } from '@/lib/space'
import {
  bad,
  notFound,
  readJsonObject,
  readOptionalBoolean,
  readOptionalString,
  unauthorized,
} from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * One to-do: `PATCH` to change it, `DELETE` to soft-delete it.
 *
 * `completed_at` IS NOT IN THIS CONTRACT. It is derived from `done` inside
 * `updateTodo()`, because the two are one fact seen twice and a caller free to
 * send them separately can put the row in a state no read can interpret.
 */

interface Props {
  params: Promise<{ id: string }>
}

const t = meSpace.todos

export async function PATCH(request: Request, { params }: Props) {
  const user = await getServerUser()
  if (!user) return unauthorized()
  const { id } = await params

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const patch: TodoPatch = {}

  const text = readOptionalString(body.text, MAX_TODO_TEXT_LEN, { nullable: false })
  if (!text.ok) return bad(t.errorTextTooLong(MAX_TODO_TEXT_LEN), 'TEXT_TOO_LONG')
  if (text.present) {
    const trimmed = (text.value ?? '').trim()
    if (!trimmed) return bad(t.errorTextRequired, 'TEXT_REQUIRED')
    patch.text = trimmed
  }

  const done = readOptionalBoolean(body.done)
  if (!done.ok) return bad(meSpace.saveFailed, 'INVALID_BODY')
  if (done.present) patch.done = done.value

  if (body.due_date !== undefined) {
    if (body.due_date === null) patch.dueDate = null
    else if (!isDateKey(body.due_date)) return bad(t.errorBadDate, 'INVALID_DATE')
    else patch.dueDate = body.due_date
  }

  if (body.priority !== undefined) {
    if (!isTodoPriority(body.priority)) return bad(t.errorBadPriority, 'INVALID_PRIORITY')
    patch.priority = body.priority
  }

  const todo = await updateTodo(id, user.userId, patch)
  if (!todo) return notFound()

  return NextResponse.json({ todo })
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getServerUser()
  if (!user) return unauthorized()
  const { id } = await params

  const deleted = await softDeleteTodo(id, user.userId)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
