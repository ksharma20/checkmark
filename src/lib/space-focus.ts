import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { recordSession } from '@/lib/db/queries/focus'
import { getTodo } from '@/lib/db/queries/todos'
import { MAX_FOCUS_LABEL_LEN, MAX_SESSION_MIN, MIN_SESSION_MIN } from '@/lib/space'
import {
  bad,
  readInteger,
  readJsonObject,
  readOptionalString,
  unauthorized,
} from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * The body both focus-ending routes read.
 *
 * `/api/focus/complete` and `/api/focus/interrupt` differ in exactly one stored
 * column - `interrupted` - and in nothing else they validate. They are two
 * routes rather than one with an `outcome` field because the outcome is not data
 * the client is reporting, it is WHICH THING HAPPENED, and a URL is a better
 * place for that than a string in a body that has to be enum-checked. Sharing
 * the reading of the body is what keeps the pair from drifting: a limit tightened
 * on one would otherwise stay loose on the other.
 */

const t = meSpace.focus

export async function handleFocusEnd(
  request: Request,
  { interrupted }: { interrupted: boolean },
): Promise<NextResponse> {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  // Both durations are bounded. The ACTUAL one is the one that matters: it is a
  // claim the browser makes about a countdown the server never saw, so without a
  // ceiling "I focused for nine million minutes" becomes today's statistics.
  const planned = readInteger(body.planned_duration_min, MIN_SESSION_MIN, MAX_SESSION_MIN)
  if (!planned.ok) return bad(t.errorBadDuration(MIN_SESSION_MIN, MAX_SESSION_MIN), 'INVALID_DURATION')

  const actual = readInteger(body.actual_duration_min, 0, MAX_SESSION_MIN)
  if (!actual.ok) return bad(t.errorBadDuration(MIN_SESSION_MIN, MAX_SESSION_MIN), 'INVALID_DURATION')

  const label = readOptionalString(body.label, MAX_FOCUS_LABEL_LEN)
  if (!label.ok) return bad(t.errorLabelTooLong(MAX_FOCUS_LABEL_LEN), 'LABEL_TOO_LONG')
  const labelValue = label.present ? (label.value?.trim() || null) : null

  /**
   * A linked to-do is RE-READ against the session user before it is stored.
   *
   * The foreign key on `pomodoro_sessions.todo_id` only asks whether the row
   * exists, never whose it is, so it would happily accept somebody else's task
   * id - and the focus history would then name a task the member has never
   * seen. `getTodo()` carries `AND user_id = ?`, which is the check that
   * matters, and a miss is refused rather than quietly stored as NULL: silently
   * dropping the link would tell the member their session was filed against a
   * task when it was not.
   */
  let todoId: string | null = null
  if (body.todo_id !== undefined && body.todo_id !== null) {
    if (typeof body.todo_id !== 'string') return bad(t.errorBadTodo, 'INVALID_TODO')
    const todo = await getTodo(body.todo_id, user.userId)
    if (!todo) return bad(t.errorBadTodo, 'INVALID_TODO')
    todoId = todo.id
  }

  const session = await recordSession({
    userId: user.userId,
    todoId,
    label: labelValue,
    plannedDurationMin: planned.value,
    actualDurationMin: actual.value,
    interrupted,
  })

  return NextResponse.json({ session }, { status: 201 })
}
