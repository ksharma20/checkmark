import { db } from '../index'
import {
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  NOTE_COLORS,
  isNoteColor,
  type NoteColor,
} from '@/lib/space'

/**
 * `user_notes` - the member's own notes, at `/me/space`.
 *
 * THERE IS NO `workspace_id` IN THIS FILE and there must never be one. A note
 * belongs to a person, not to an organisation: it follows the account across
 * workspaces, survives leaving one, and no `/ws` surface reads it. The scoping
 * question every other query file answers with `AND workspace_id = ?` is
 * answered here with `AND user_id = ?`, on EVERY statement including the reads -
 * a note that is not the caller's must be indistinguishable from a note that
 * does not exist, so a miss returns null and the route answers 404 rather than
 * confirming the row is somebody else's with a 403.
 *
 * Soft-deleted (invariant 5): `deleted_at` is set, the row stays, and every read
 * filters `deleted_at IS NULL`.
 *
 * The colour constants live in the pure `src/lib/space.ts` and are only
 * re-exported below, so the client-side colour picker can import them without
 * dragging better-sqlite3 into the browser bundle.
 */

export { NOTE_COLORS, isNoteColor, MAX_NOTE_TITLE_LEN, MAX_NOTE_CONTENT_LEN }
export type { NoteColor }

/**
 * The row as SQLite hands it back. Like every other row interface in this
 * directory it is DOCUMENTATION, not enforcement - nothing checks it against the
 * database, and a column rename that only touches this file typechecks and then
 * fails at runtime.
 */
export interface UserNote {
  id: string
  user_id: string
  title: string | null
  content: string
  /** SQLite has no boolean: 0 or 1. */
  pinned: number
  color: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Every live note for one member, pinned first and newest first.
 *
 * The ordering is the index's ordering (`idx_user_notes_user`) rather than a
 * sort SQLite has to perform, and it is not paginated: a personal note list is
 * bounded by how many notes one human writes, and a "load more" on a board of
 * cards would hide the pinned ones behind it the moment the list grew.
 */
export async function listNotes(userId: string): Promise<UserNote[]> {
  return db.query<UserNote>(
    `SELECT * FROM user_notes
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY pinned DESC, created_at DESC`,
    [userId],
  )
}

/** One note, or null if it is deleted, missing, or somebody else's. */
export async function getNote(id: string, userId: string): Promise<UserNote | null> {
  return db.queryOne<UserNote>(
    `SELECT * FROM user_notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId],
  )
}

export async function createNote(params: {
  userId: string
  title?: string | null
  content?: string
  pinned?: boolean
  color?: NoteColor
}): Promise<UserNote> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO user_notes (id, user_id, title, content, pinned, color)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.title ?? null,
      params.content ?? '',
      params.pinned ? 1 : 0,
      params.color ?? 'default',
    ],
  )
  // Re-read rather than echo the arguments back: the row carries two column
  // defaults (`created_at`, `updated_at`) that only the database knows.
  const note = await getNote(id, params.userId)
  if (!note) throw new Error('note disappeared immediately after insert')
  return note
}

/** A partial update. An omitted key means "leave it alone", never "clear it". */
export interface NotePatch {
  title?: string | null
  content?: string
  pinned?: boolean
  color?: NoteColor
}

/**
 * Apply a patch, or return null when the note is not this member's.
 *
 * The SET list is built from the keys actually present, which is what keeps
 * "omitted" and "cleared" apart - `title: null` clears the title, and no `title`
 * key at all leaves it standing. Collapsing the two (the usual `?? current`
 * shorthand) would make a title impossible to remove, because "clear this" and
 * "do not touch this" would arrive as the same value.
 *
 * `updated_at` is always rewritten; that is the one field a patch cannot omit.
 * `user_id` is in the WHERE clause, never in the SET list - it is not a field,
 * it is the boundary.
 */
export async function updateNote(
  id: string,
  userId: string,
  patch: NotePatch,
): Promise<UserNote | null> {
  const sets: string[] = []
  const args: unknown[] = []

  if ('title' in patch) { sets.push('title = ?'); args.push(patch.title ?? null) }
  if (patch.content !== undefined) { sets.push('content = ?'); args.push(patch.content) }
  if (patch.pinned !== undefined) { sets.push('pinned = ?'); args.push(patch.pinned ? 1 : 0) }
  if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color) }

  // Nothing to change still has to answer "is this yours?", so it falls through
  // to the read below rather than returning early with a fabricated row.
  if (sets.length > 0) {
    sets.push(`updated_at = datetime('now')`)
    await db.execute(
      `UPDATE user_notes SET ${sets.join(', ')}
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [...args, id, userId],
    )
  }

  return getNote(id, userId)
}

/**
 * Soft delete. Returns false when there was nothing of this member's to delete,
 * which is what lets the route answer 404 without a second read.
 *
 * `deleted_at IS NULL` in the WHERE clause makes a repeated delete a no-op
 * rather than a tombstone that keeps moving forward - the interesting timestamp
 * is when it was first deleted.
 */
export async function softDeleteNote(id: string, userId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE user_notes SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [id, userId],
  )
  return (result.changes ?? 0) > 0
}
