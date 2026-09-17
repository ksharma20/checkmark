import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { createTodo, isTodoFilter, listTodos } from '@/lib/db/queries/todos'
import { MAX_TODO_TEXT_LEN, isDateKey, isTodoPriority } from '@/lib/space'
import { bad, readJsonObject, readOptionalString, unauthorized } from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * `/api/todos` - the member's own task list.
 *
 * Personal, like `/api/notes`: no workspace in the path, no `userId` in any
 * contract, the session is the only source of identity (invariant 1).
 */

const t = meSpace.todos

export async function GET(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const url = new URL(request.url)

  /**
   * An unrecognised `filter` is DROPPED, not 400'd.
   *
   * The same call the assets list makes: a stale bookmark or an old tab naming a
   * filter that no longer exists should show the member their tasks, not an
   * error page. A bad filter has an honest reading - "all of them" - which is
   * what makes dropping it safe here and wrong for a write body.
   */
  const rawFilter = url.searchParams.get('filter')
  const filter = isTodoFilter(rawFilter) ? rawFilter : 'all'

  /**
   * `today` is supplied by the BROWSER, and it has to be.
   *
   * There is no workspace on this surface, so there is no `display_timezone` to
   * read a calendar day out of - and the server's own UTC date is somebody
   * else's day for most of the planet. The browser knows which day it is for the
   * member; that is the whole of what this parameter carries. It selects rows,
   * it never grants access to any, so trusting it costs nothing: the worst a
   * forged value does is show the caller their OWN tasks for the wrong date.
   */
  const rawToday = url.searchParams.get('today')
  const today = isDateKey(rawToday) ? rawToday : undefined

  const todos = await listTodos({ userId: user.userId, filter, today })
  return NextResponse.json({ todos })
}

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const text = readOptionalString(body.text, MAX_TODO_TEXT_LEN, { nullable: false })
  if (!text.ok) return bad(t.errorTextTooLong(MAX_TODO_TEXT_LEN), 'TEXT_TOO_LONG')
  const trimmed = text.present ? (text.value ?? '').trim() : ''
  if (!trimmed) return bad(t.errorTextRequired, 'TEXT_REQUIRED')

  // `null` is a real value here - "no due date" - and is why the key is read
  // through the three-way helper rather than with `??`.
  let dueDate: string | null = null
  if (body.due_date !== undefined && body.due_date !== null) {
    if (!isDateKey(body.due_date)) return bad(t.errorBadDate, 'INVALID_DATE')
    dueDate = body.due_date
  }

  const priority = body.priority === undefined ? 'none' : body.priority
  if (!isTodoPriority(priority)) return bad(t.errorBadPriority, 'INVALID_PRIORITY')

  const todo = await createTodo({
    userId: user.userId,
    text: trimmed,
    dueDate,
    priority,
  })

  return NextResponse.json({ todo }, { status: 201 })
}
