import { db } from '../index'

/**
 * Workspace announcements - the canonical record of a workspace-wide notice.
 *
 * Delivery is NOT stored here. An announcement is fanned out as ordinary
 * `notifications` rows (one per active member, `ref_type: 'announcement'`,
 * `ref_id` = this row's id), which is what gives every recipient their own
 * read state and bell count with no new machinery. This table exists so the
 * admin can see and retract what they posted; retracting hides the row and
 * does not unsend what was already delivered.
 *
 * Soft-deleted, and every statement carries `AND workspace_id = ?` - the id is
 * never trusted on its own, so a row id guessed from another workspace matches
 * nothing.
 */
export interface Announcement {
  id: string
  workspace_id: string
  title: string
  body: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** A listed announcement carries its author's display name for the byline. */
export interface AnnouncementWithAuthor extends Announcement {
  /** NULL when the author's user row is gone (soft-deleted account). */
  author_name: string | null
}

export async function getAnnouncement(
  id: string,
  workspaceId: string,
): Promise<Announcement | null> {
  return db.queryOne<Announcement>(
    `SELECT * FROM workspace_announcements
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * Active announcements, newest first - the order the index
 * `idx_workspace_announcements_ws (workspace_id, created_at DESC)` is built for.
 *
 * LEFT JOIN, not JOIN: an author whose account was deleted must not make their
 * announcement vanish from the admin's list.
 */
export async function listAnnouncements(
  workspaceId: string,
): Promise<AnnouncementWithAuthor[]> {
  return db.query<AnnouncementWithAuthor>(
    `SELECT a.*, u.full_name AS author_name
     FROM workspace_announcements a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.workspace_id = ? AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
    [workspaceId],
  )
}

export async function createAnnouncement(params: {
  workspaceId: string
  title: string
  body: string
  createdBy: string
}): Promise<Announcement> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_announcements (id, workspace_id, title, body, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.title, params.body, params.createdBy],
  )
  const row = await getAnnouncement(id, params.workspaceId)
  if (!row) throw new Error('Announcement insert succeeded but row not found')
  return row
}

/**
 * Soft delete. Returns false when nothing matched - a wrong id, another
 * workspace's id, or an already-deleted row - which the route turns into a 404
 * rather than pretending it retracted something.
 */
export async function softDeleteAnnouncement(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await db.execute(
    `UPDATE workspace_announcements
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}
