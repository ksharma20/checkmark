import { db } from '../index'

export type NotificationType = 'leave_submitted' | 'leave_approved' | 'leave_rejected'

export interface Notification {
  id: string
  user_id: string
  workspace_id: string | null
  workspace_slug: string | null
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
      `SELECT n.*, w.slug AS workspace_slug
       FROM notifications n LEFT JOIN workspaces w ON w.id = n.workspace_id
       WHERE n.user_id = ? AND n.workspace_id = ?
       ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
      [userId, workspaceId, limit, offset],
    )
  }
  return db.query<Notification>(
    `SELECT n.*, w.slug AS workspace_slug
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
