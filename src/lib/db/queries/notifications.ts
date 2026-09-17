import { db } from '../index'

export type NotificationType =
  | 'leave_submitted' | 'leave_approved' | 'leave_rejected'
  | 'regularization_submitted' | 'regularization_approved' | 'regularization_rejected'
  // No reminder types here, and that is structural rather than an omission. The
  // wall-clock check-in / check-out reminders (see `src/lib/reminders.ts`) are
  // PUSH-ONLY: they write no `notifications` row, so they have no
  // `NotificationType` and no category. Same shape the presence ladder has
  // always had. A nudge to check in is worthless an hour later, and a member's
  // reminder is now a schedule they set rather than a message class the
  // organisation broadcasts.
  // An employee document was verified or rejected. ref_id is the document id,
  // ref_type 'employee_document'. Until this existed, an admin could reject
  // somebody's ID proof and the employee was never told.
  | 'document_verified' | 'document_rejected'
  // A workspace-wide notice. ref_id is the workspace_announcements id,
  // ref_type 'announcement'. Delivered by fanning one row out per active
  // member, which is what gives each of them their own read state.
  | 'announcement'
  // An employee asked to extend a parental leave case by unpaid days, and the
  // outcome of that request. ref_id is the `parental_leave_extensions` id,
  // ref_type 'parental_extension'. Deliberately its own family rather than
  // reusing 'leave_*': an extension is filed against a maternity/paternity case,
  // not against an accrued balance, so it lands in a different queue.
  | 'extension_submitted' | 'extension_approved' | 'extension_rejected'
  // A workspace invited this account to join. ref_id is the
  // `workspace_members` id, ref_type 'workspace_member'. It is the one type
  // whose row is not a RECORD of something that already happened but an OFFER
  // that is still open, so the row alone is never the truth: the membership it
  // points at can be accepted, declined, revoked or expire after it is written.
  // Every read of an invitation row therefore joins the membership back on
  // (see `getNotificationsForUser`), and the feed renders the live state rather
  // than the snapshot the row was written from.
  | 'invitation'

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
  /**
   * ── Live state of an `invitation` row's membership ─────────────────────────
   *
   * NULL on every other type, and also on an invitation whose
   * `workspace_members` row has been hard-deleted (removing a member is a hard
   * delete - see `removeWorkspaceMember`). All three come from a LEFT JOIN on
   * `ref_id`, never from the row's own columns.
   *
   * A notification is a record, and invariant 22 means it is never unsent. But
   * an invitation is an OFFER, and an offer that has already been answered must
   * not keep rendering Accept. The snapshot in `title` / `body` was true when it
   * was written; these three say what is true now.
   */
  invite_status: string | null
  invite_expires_at: string | null
  /**
   * 1 when the invited address still matches the account reading this, 0 when
   * it does not. Resolved in SQL against `users.email` rather than compared in
   * the browser: the client must not be the thing that decides an invitation is
   * addressed to it. `POST /api/me/consent` re-checks the same fact server-side
   * regardless - this only decides whether a button is worth showing.
   */
  invite_email_match: number | null
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

/**
 * The columns every notification read selects, invitation join included.
 *
 * `workspace_members` is joined on `n.ref_id` ONLY for `type = 'invitation'`,
 * so no other row pays for it (and no other family's `ref_id` can collide into
 * a membership id by accident). `users` is joined to resolve the email match in
 * SQL - see `invite_email_match`.
 *
 * One string, four callers, because a second spelling of this join is a second
 * place for the feed and the bell to disagree about whether an invitation is
 * still open.
 */
const NOTIFICATION_SELECT = `
  SELECT n.*,
         w.slug AS workspace_slug,
         w.name AS workspace_name,
         wm.status AS invite_status,
         wm.consent_token_expires_at AS invite_expires_at,
         CASE WHEN wm.id IS NULL THEN NULL
              WHEN lower(wm.email) = lower(u.email) THEN 1
              ELSE 0 END AS invite_email_match
  FROM notifications n
  LEFT JOIN workspaces w ON w.id = n.workspace_id
  LEFT JOIN users u ON u.id = n.user_id
  LEFT JOIN workspace_members wm
    ON n.type = 'invitation' AND wm.id = n.ref_id
`

/**
 * Why a workspace-scoped read still returns `invitation` rows.
 *
 * The `/me` bell polls the ACTIVE workspace, and every `/api/me/ws/[slug]/*`
 * route requires an active membership there. An invitation to a DIFFERENT
 * workspace is, by definition, addressed to somebody who is not a member of it
 * yet - so scoping it away is scoping away the only rows that can never arrive
 * any other way, and a member who already belongs to one workspace would never
 * see a second invitation at all.
 *
 * An invitation is keyed to the USER, not to a membership, which is what makes
 * this safe: `user_id = ?` is still the whole access check, exactly as it is for
 * the unscoped feed. The workspace filter is a view preference; the ownership
 * filter is the one that matters, and it is untouched.
 */
const SCOPED_WHERE = `n.user_id = ? AND (n.workspace_id = ? OR n.type = 'invitation')`

export async function getNotificationsForUser(
  userId: string,
  workspaceId?: string,
  limit = 50,
  offset = 0,
  /**
   * Opt-in, and only the `/me` surface turns it on. The `/ws` bell is an
   * admin's view of one workspace's news; an invitation addressed to them
   * personally, for somewhere else entirely, does not belong in it. Defaulting
   * to `false` means adding this argument changed no existing caller's
   * behaviour.
   */
  includeInvitations = false,
): Promise<Notification[]> {
  if (workspaceId) {
    const where = includeInvitations
      ? SCOPED_WHERE
      : 'n.user_id = ? AND n.workspace_id = ?'
    return db.query<Notification>(
      `${NOTIFICATION_SELECT} WHERE ${where} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
      [userId, workspaceId, limit, offset],
    )
  }
  return db.query<Notification>(
    `${NOTIFICATION_SELECT} WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  )
}

export async function getUnreadCount(
  userId: string,
  workspaceId?: string,
  includeInvitations = false,
): Promise<number> {
  if (workspaceId) {
    // The count and the list must agree about what is in scope, or the bell
    // shows a badge for a row the screen it opens does not contain.
    const where = includeInvitations
      ? SCOPED_WHERE
      : 'n.user_id = ? AND n.workspace_id = ?'
    const row = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications n WHERE ${where} AND n.read_at IS NULL`,
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
  /**
   * Must match whatever the matching READ used, or "mark all read" in the
   * scoped view leaves the invitation rows it just displayed still unread and
   * the badge never clears.
   */
  includeInvitations = false,
): Promise<void> {
  const scope = includeInvitations
    ? `user_id = ? AND (workspace_id = ? OR type = 'invitation')`
    : 'user_id = ? AND workspace_id = ?'
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ')
    if (workspaceId) {
      await db.execute(
        `UPDATE notifications SET read_at = datetime('now') WHERE ${scope} AND id IN (${placeholders}) AND read_at IS NULL`,
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
      `UPDATE notifications SET read_at = datetime('now') WHERE ${scope} AND read_at IS NULL`,
      [userId, workspaceId],
    )
  } else {
    await db.execute(
      `UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`,
      [userId],
    )
  }
}

/**
 * Drop this user's existing rows pointing at one `ref_id`, before writing a new
 * one for the same thing.
 *
 * Re-sending an invitation is the normal repair for a link that was lost or
 * left to expire (see `POST /api/ws/[slug]/members`), and every send issues a
 * fresh token. Without this, three re-sends leave three rows in the feed, all
 * looking equally live, all pointing at the same membership - and the two older
 * ones are describing a token that is already dead.
 *
 * A DELETE rather than a soft-delete or a superseded flag, and the distinction
 * matters: invariant 22 says a notification is never UNSENT, and nothing here
 * is. The previous row is not being retracted from somebody who acted on it -
 * it is being replaced, in the same breath, by a row about the same offer with
 * a longer deadline. Leaving it would be showing the same invitation twice.
 *
 * No unique index backs this. One would have to be partial on `type` and would
 * still not express "one row per (user, ref_id) but only for invitations";
 * deleting first is one statement, is what the route already needs, and cannot
 * be defeated by a row written before the index existed.
 */
export async function deleteNotificationsByRef(params: {
  userId: string
  type: NotificationType
  refId: string
}): Promise<void> {
  await db.execute(
    `DELETE FROM notifications WHERE user_id = ? AND type = ? AND ref_id = ?`,
    [params.userId, params.type, params.refId],
  )
}
