import { db } from '../index'
import {
  MAX_REORDER_IDS,
  MAX_TODO_TEXT_LEN,
  TODO_PRIORITIES,
  isTodoPriority,
  type TodoPriority,
} from '@/lib/space'

/**
 * `user_todos` - the member's own task list, at `/me/space`.
 *
 * Personal, exactly like `notes.ts`: no `workspace_id` column, no `/ws` reader,
 * and `AND user_id = ?` on every statement including the reads, so a row
 * belonging to somebody else is indistinguishable from one that does not exist.
 * Soft-deleted (invariant 5).
 *
 * The priority values and the reorder cap live in the pure `src/lib/space.ts`
 * and are re-exported below for server callers; the client imports them from
 * there directly.
 */

export { TODO_PRIORITIES, isTodoPriority, MAX_TODO_TEXT_LEN, MAX_REORDER_IDS }
export type { TodoPriority }

/** Documentation, not enforcement - see the note in `notes.ts`. */
export interface UserTodo {
  id: string
  user_id: string
  text: string
  /** SQLite has no boolean: 0 or 1. */
  done: number
  /** `YYYY-MM-DD`, or null for "no date". */
  due_date: string | null
  priority: string
  display_order: number
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
}

export type TodoFilter = 'all' | 'pending' | 'done' | 'today'

export function isTodoFilter(value: unknown): value is TodoFilter {
  return value === 'all' || value === 'pending' || value === 'done' || value === 'today'
}

/**
 * The member's live to-dos, in their own order.
 *
 * `ORDER BY display_order, created_at` rather than `display_order` alone: the
 * column is deliberately NOT unique (a reorder passing through a transient
 * collision must not fail), so ties are possible and an unstable sort would let
 * two rows swap places between two reads of an unchanged list.
 *
 * `'today'` means "due today, or carrying no date at all". The undated half is
 * the point: a task with no due date is not a task for some other day, it is one
 * the member has not scheduled, and hiding it from the one view they open every
 * morning is how it never gets done. `today` is a workspace-free calendar day
 * resolved by the CALLER - there is no workspace here to take a timezone from,
 * so the browser's own date is what the route passes in.
 */
export async function listTodos(params: {
  userId: string
  filter?: TodoFilter
  today?: string
}): Promise<UserTodo[]> {
  const conditions = ['user_id = ?', 'deleted_at IS NULL']
  const args: unknown[] = [params.userId]

  if (params.filter === 'pending') conditions.push('done = 0')
  if (params.filter === 'done') conditions.push('done = 1')
  if (params.filter === 'today' && params.today) {
    conditions.push('done = 0', '(due_date = ? OR due_date IS NULL)')
    args.push(params.today)
  }

  return db.query<UserTodo>(
    `SELECT * FROM user_todos
     WHERE ${conditions.join(' AND ')}
     ORDER BY display_order ASC, created_at ASC`,
    args,
  )
}

/** One to-do, or null if it is deleted, missing, or somebody else's. */
export async function getTodo(id: string, userId: string): Promise<UserTodo | null> {
  return db.queryOne<UserTodo>(
    `SELECT * FROM user_todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId],
  )
}

export async function createTodo(params: {
  userId: string
  text: string
  dueDate?: string | null
  priority?: TodoPriority
}): Promise<UserTodo> {
  const id = crypto.randomUUID().replace(/-/g, '')

  // A new task goes to the BOTTOM of the member's order, which is what
  // `max + 1` buys over a plain `0`: appending at the top would silently
  // rearrange a list the member has already arranged. `COALESCE` covers the
  // first-ever row, where `MAX()` over no rows is NULL rather than 0.
  //
  // Read-then-insert is two statements and races itself, and that is accepted
  // here rather than papered over: the loser of a race gets the same
  // `display_order` as the winner, which the tie-break in `listTodos` already
  // resolves deterministically. The alternative - a UNIQUE index - would turn a
  // harmless collision into a failed insert and make every reorder fragile.
  const row = await db.queryOne<{ next_order: number }>(
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
     FROM user_todos WHERE user_id = ? AND deleted_at IS NULL`,
    [params.userId],
  )

  await db.execute(
    `INSERT INTO user_todos (id, user_id, text, due_date, priority, display_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.text,
      params.dueDate ?? null,
      params.priority ?? 'none',
      row?.next_order ?? 0,
    ],
  )

  const todo = await getTodo(id, params.userId)
  if (!todo) throw new Error('todo disappeared immediately after insert')
  return todo
}

/** A partial update. An omitted key means "leave it alone", never "clear it". */
export interface TodoPatch {
  text?: string
  done?: boolean
  dueDate?: string | null
  priority?: TodoPriority
  displayOrder?: number
}

/**
 * Apply a patch, or return null when the to-do is not this member's.
 *
 * `completed_at` IS DERIVED FROM `done`, NEVER SENT. It is written here rather
 * than accepted in the patch because the two are one fact seen twice: a caller
 * free to send `done: 1` with no timestamp - or a timestamp with no `done` -
 * would put the row in a state no read can interpret, and the focus stats and
 * the completed list disagree the moment they diverge. Ticking sets it, and
 * un-ticking clears it, so restoring a task does not leave it wearing the time
 * it was finished.
 */
export async function updateTodo(
  id: string,
  userId: string,
  patch: TodoPatch,
): Promise<UserTodo | null> {
  const sets: string[] = []
  const args: unknown[] = []

  if (patch.text !== undefined) { sets.push('text = ?'); args.push(patch.text) }
  if ('dueDate' in patch) { sets.push('due_date = ?'); args.push(patch.dueDate ?? null) }
  if (patch.priority !== undefined) { sets.push('priority = ?'); args.push(patch.priority) }
  if (patch.displayOrder !== undefined) {
    sets.push('display_order = ?')
    args.push(patch.displayOrder)
  }
  if (patch.done !== undefined) {
    sets.push('done = ?')
    args.push(patch.done ? 1 : 0)
    sets.push(patch.done ? `completed_at = datetime('now')` : 'completed_at = NULL')
  }

  if (sets.length > 0) {
    sets.push(`updated_at = datetime('now')`)
    await db.execute(
      `UPDATE user_todos SET ${sets.join(', ')}
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [...args, id, userId],
    )
  }

  return getTodo(id, userId)
}

/**
 * Raised when a reorder named a row that is not the caller's.
 *
 * A named error rather than a count returned to the route, because the check has
 * to happen INSIDE the transaction: the writes are already applied by the time
 * the count is known, and only throwing rolls them back. A route that compared
 * counts after `reorderTodos()` returned would be reporting a failure it had
 * already committed.
 */
export class TodoOwnershipError extends Error {
  constructor() {
    super('reorder named to-dos that do not belong to this user')
    this.name = 'TodoOwnershipError'
  }
}

/**
 * Write a whole new ordering, atomically.
 *
 * ONE TRANSACTION, AND THE OWNERSHIP CHECK IS INSIDE IT. Every UPDATE carries
 * `AND user_id = ?`, so an id belonging to somebody else matches nothing and
 * changes nothing - there is no way to reorder, or even to probe for, a row that
 * is not the caller's. If the number of rows actually touched does not match the
 * number of ids sent, the whole thing is thrown away rather than applied as the
 * subset it recognised: a list reordered to something the member did not ask for
 * is worse than a refused request, because nothing about it looks wrong
 * afterwards.
 *
 * Position IS the array index - the contract carries ids only - so there is no
 * ordering to validate. Two rows claiming position 3, a negative position and a
 * gap are all unrepresentable rather than refused.
 */
export async function reorderTodos(userId: string, orderedIds: string[]): Promise<number> {
  if (orderedIds.length === 0) return 0

  return db.transaction(async (tx) => {
    let changed = 0
    for (let i = 0; i < orderedIds.length; i++) {
      const result = await tx.execute(
        `UPDATE user_todos SET display_order = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [i, orderedIds[i], userId],
      )
      changed += result.changes ?? 0
    }
    // Throwing is what rolls the whole batch back - see TodoOwnershipError.
    if (changed !== orderedIds.length) throw new TodoOwnershipError()
    return changed
  })
}

/** Soft delete. False when there was nothing of this member's to delete. */
export async function softDeleteTodo(id: string, userId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE user_todos SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId],
  )
  return (result.changes ?? 0) > 0
}
