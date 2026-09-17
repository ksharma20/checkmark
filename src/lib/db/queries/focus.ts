import { db } from '../index'
import {
  MAX_FOCUS_LABEL_LEN,
  MAX_SESSION_MIN,
  MIN_SESSION_MIN,
} from '@/lib/space'

/**
 * `pomodoro_sessions` - the focus timer's record, at `/me/space`.
 *
 * Personal like `notes.ts` and `todos.ts`: no `workspace_id`, `AND user_id = ?`
 * on every statement, nothing on `/ws` reads it.
 *
 * THE TIMER IS ENTIRELY CLIENT-SIDE AND A ROW IS WRITTEN ONLY WHEN A SESSION
 * ENDS. There is no start endpoint and no open row, and that is the design
 * rather than a simplification:
 *
 *   - A row created at start would stay open forever for every session the
 *     member abandoned - closed the tab, killed the PWA, went home - and nothing
 *     could tell those apart from a session running right now. Closing them
 *     would need a cron, which is exactly what sub-project E puts out of scope.
 *   - A countdown needs no server. Nothing has to be kept alive between start
 *     and finish, so a start round trip buys an id and one more thing to fail.
 *   - An abandoned session leaving NO row is the honest record. Nobody focused.
 *
 * `started_at` IS DERIVED, NEVER ACCEPTED. It is computed as
 * `now - actual_duration_min`, so the only number the browser supplies is a
 * duration - which is bounded (`MIN_SESSION_MIN`..`MAX_SESSION_MIN`) and cannot
 * place a session in the future or backdate one into a day it did not happen.
 */

export { MAX_FOCUS_LABEL_LEN, MAX_SESSION_MIN, MIN_SESSION_MIN }

/** Documentation, not enforcement - see the note in `notes.ts`. */
export interface PomodoroSession {
  id: string
  user_id: string
  todo_id: string | null
  label: string | null
  planned_duration_min: number
  actual_duration_min: number | null
  started_at: string
  completed_at: string | null
  /** SQLite has no boolean: 0 or 1. */
  interrupted: number
  created_at: string
}

/**
 * Record a session that has already finished.
 *
 * `todoId` is written only after `getTodo`-style ownership has been proved by
 * the caller; this function additionally refuses to store one that is not the
 * member's, because a foreign key alone would happily link a to-do belonging to
 * somebody else - the constraint checks that the row EXISTS, not whose it is.
 */
export async function recordSession(params: {
  userId: string
  todoId?: string | null
  label?: string | null
  plannedDurationMin: number
  actualDurationMin: number
  interrupted: boolean
}): Promise<PomodoroSession> {
  const id = crypto.randomUUID().replace(/-/g, '')

  await db.execute(
    `INSERT INTO pomodoro_sessions
       (id, user_id, todo_id, label, planned_duration_min, actual_duration_min,
        started_at, completed_at, interrupted)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now'), ?)`,
    [
      id,
      params.userId,
      params.todoId ?? null,
      params.label ?? null,
      params.plannedDurationMin,
      params.actualDurationMin,
      // The one place the duration becomes a clock reading. Whole minutes, so
      // the modifier is exact rather than a float SQLite has to parse.
      `-${Math.round(params.actualDurationMin)} minutes`,
      params.interrupted ? 1 : 0,
    ],
  )

  const session = await db.queryOne<PomodoroSession>(
    `SELECT * FROM pomodoro_sessions WHERE id = ? AND user_id = ?`,
    [id, params.userId],
  )
  if (!session) throw new Error('focus session disappeared immediately after insert')
  return session
}

/**
 * Every session this member started on or after `sinceUtc`.
 *
 * Deliberately a RANGE rather than "today": `started_at` is stored in UTC and
 * the member's day is not, so which rows count as today's can only be decided
 * once a timezone is known. The caller reads a generous window - two days is
 * enough for any offset on Earth - and buckets it with `dateKeyInTimezone()`
 * from `src/lib/attendance-summary.ts`, which is the same helper the attendance
 * screens use to answer the same question about presence events. Doing the
 * bucketing in SQL would mean an offset arithmetic the driver cannot express
 * portably and that better-sqlite3 and libSQL need not agree on.
 */
export async function getSessionsSince(
  userId: string,
  sinceUtc: string,
): Promise<PomodoroSession[]> {
  return db.query<PomodoroSession>(
    `SELECT * FROM pomodoro_sessions
     WHERE user_id = ? AND started_at >= ?
     ORDER BY started_at DESC`,
    [userId, sinceUtc],
  )
}
