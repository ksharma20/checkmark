import { db } from '../index'

export type NotificationType =
  | 'leave_submitted' | 'leave_approved' | 'leave_rejected'
  | 'regularization_submitted' | 'regularization_approved' | 'regularization_rejected'
  // Scheduled wall-clock reminders (see lib/reminders.ts). ref_id is the
  // workspace-local 'YYYY-MM-DD', ref_type is 'reminder'.
  | 'checkin_reminder' | 'checkout_reminder'
  // An employee document was verified or rejected. ref_id is the document id,
  // ref_type 'employee_document'. Until this existed, an admin could reject
  // somebody's ID proof and the employee was never told.
  | 'document_verified' | 'document_rejected'
  // A workspace-wide notice. ref_id is the workspace_announcements id,
  // ref_type 'announcement'. Delivered by fanning one row out per active
  // member, which is what gives each of them their own read state.
  | 'announcement'

export interface Notification {
  id: string
  user_id: string
  workspace_id: string | null
  workspace_slug: string | null
  /** Workspace display name, for the badge on the unified /me view. NULL for
   *  account-level notifications that belong to no workspace. */
  workspace_name: string | null
  type: NotificationType
  title: string
  body: string
  ref_id: string | null
  ref_type: string | null
  read_at: string | null
  created_at: string
}

export async function createNotification(params: {
  userId: string
  workspaceId?: string | null
  type: NotificationType
  title: string
  body: string
  refId?: string
  refType?: string
}): Promise<void> {
  await db.execute(
    `INSERT INTO notifications (user_id, workspace_id, type, title, body, ref_id, ref_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.userId, params.workspaceId ?? null, params.type, params.title, params.body, params.refId ?? null, params.refType ?? null],
  )
}

export async function getNotificationsForUser(
  userId: string,
  workspaceId?: string,
  limit = 50,
  offset = 0,
): Promise<Notification[]> {
  if (workspaceId) {
    return db.query<Notification>(
      `SELECT n.*, w.slug AS workspace_slug, w.name AS workspace_name
       FROM notifications n LEFT JOIN workspaces w ON w.id = n.workspace_id
       WHERE n.user_id = ? AND n.workspace_id = ?
       ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
      [userId, workspaceId, limit, offset],
    )
  }
  return db.query<Notification>(
    `SELECT n.*, w.slug AS workspace_slug, w.name AS workspace_name
     FROM notifications n LEFT JOIN workspaces w ON w.id = n.workspace_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  )
}

export async function getUnreadCount(userId: string, workspaceId?: string): Promise<number> {
  if (workspaceId) {
    const row = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND workspace_id = ? AND read_at IS NULL`,
      [userId, workspaceId],
    )
    return row?.count ?? 0
  }
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [userId],
  )
  return row?.count ?? 0
}

export async function markNotificationsRead(
  userId: string,
  workspaceId?: string,
  ids?: string[],
): Promise<void> {
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ')
    if (workspaceId) {
      await db.execute(
        `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND workspace_id = ? AND id IN (${placeholders}) AND read_at IS NULL`,
        [userId, workspaceId, ...ids],
      )
    } else {
      await db.execute(
        `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND id IN (${placeholders}) AND read_at IS NULL`,
        [userId, ...ids],
      )
    }
  } else if (workspaceId) {
    await db.execute(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND workspace_id = ? AND read_at IS NULL`,
      [userId, workspaceId],
    )
  } else {
    await db.execute(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`,
      [userId],
    )
  }
}
