import { db } from '../index'

/**
 * Wall-clock check-in / check-out reminders.
 *
 * The existing cron reminders are *event-anchored*: they start from a
 * presence_events row and count elapsed hours. That design can never notice
 * somebody who never checked in, because there is no row to iterate. This file
 * backs the second, *workspace-anchored* pass: iterate workspaces that have
 * configured a reminder time, work out who has (or has not) an event today,
 * and dedupe on `reminder_log` rather than on a column of an event row.
 */

export type ReminderKind = 'checkin' | 'checkout'

/**
 * presence_events timestamps are stored SQLite-style ('YYYY-MM-DD HH:MM:SS',
 * space separator, no Z). Range predicates on that column are lexicographic,
 * so an ISO bound with a 'T' and a 'Z' would compare wrong. Same normalisation
 * as `toSqliteDt` in queries/events.ts.
 */
function toSqliteDt(s: string): string {
  return s.replace('T', ' ').replace('Z', '').slice(0, 19)
}

export interface WorkspaceReminderConfig {
  id: string
  slug: string
  name: string
  display_timezone: string
  /** JSON array of weekday numbers, 0 = Sunday. e.g. '[1,2,3,4,5]' */
  working_days: string
  /** 'HH:MM' in display_timezone, or null when the reminder is off. */
  checkin_reminder_at: string | null
  checkout_reminder_at: string | null
  /**
   * JSON array of the notification categories this workspace has switched off.
   * Selected here so the pass can drop a whole workspace before it queries
   * holidays or members - the alternative is re-reading the workspace row per
   * recipient inside `notify()`.
   */
  notification_categories_off: string
}

export interface ReminderMember {
  user_id: string
  email: string
  full_name: string | null
}

/**
 * Every live workspace that has at least one reminder time configured.
 * Archived workspaces are excluded - they must not notify anyone.
 */
export async function getWorkspacesWithReminders(): Promise<WorkspaceReminderConfig[]> {
  return db.query<WorkspaceReminderConfig>(
    `SELECT id, slug, name, display_timezone, working_days,
            checkin_reminder_at, checkout_reminder_at,
            notification_categories_off
     FROM workspaces
     WHERE archived_at IS NULL
       AND (checkin_reminder_at IS NOT NULL OR checkout_reminder_at IS NOT NULL)
     ORDER BY id ASC`,
  )
}

/**
 * Active members of this workspace with NO presence event in the given UTC
 * window - i.e. the people who have not checked in today.
 *
 * `presence_events` carries no workspace_id (verification is computed per
 * workspace), so membership is what scopes this: the workspace_members join is
 * the `AND workspace_id = ?` for this query.
 */
export async function getMembersMissingCheckin(
  workspaceId: string,
  dayStartUtc: string,
  dayEndUtc: string,
): Promise<ReminderMember[]> {
  return db.query<ReminderMember>(
    `SELECT wm.user_id AS user_id, u.email AS email, u.full_name AS full_name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?
       AND wm.status = 'active'
       AND wm.user_id IS NOT NULL
       AND u.deleted_at IS NULL
       AND u.deactivated_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM presence_events pe
         WHERE pe.user_id = wm.user_id
           AND pe.deleted_at IS NULL
           AND pe.checkin_at >= ?
           AND pe.checkin_at < ?
       )
     ORDER BY u.email ASC`,
    [workspaceId, toSqliteDt(dayStartUtc), toSqliteDt(dayEndUtc)],
  )
}

/**
 * Active members of this workspace who checked in during the window and are
 * still open (no checkout_at) - i.e. the people who owe us a check-out.
 */
export async function getMembersStillCheckedIn(
  workspaceId: string,
  dayStartUtc: string,
  dayEndUtc: string,
): Promise<ReminderMember[]> {
  return db.query<ReminderMember>(
    `SELECT wm.user_id AS user_id, u.email AS email, u.full_name AS full_name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?
       AND wm.status = 'active'
       AND wm.user_id IS NOT NULL
       AND u.deleted_at IS NULL
       AND u.deactivated_at IS NULL
       AND EXISTS (
         SELECT 1 FROM presence_events pe
         WHERE pe.user_id = wm.user_id
           AND pe.deleted_at IS NULL
           AND pe.checkout_at IS NULL
           AND pe.checkin_at >= ?
           AND pe.checkin_at < ?
       )
     ORDER BY u.email ASC`,
    [workspaceId, toSqliteDt(dayStartUtc), toSqliteDt(dayEndUtc)],
  )
}

/** Has this exact reminder already gone out for this workspace-local date? */
export async function hasReminderBeenSent(
  workspaceId: string,
  userId: string,
  kind: ReminderKind,
  localDate: string,
): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    `SELECT id FROM reminder_log
     WHERE workspace_id = ? AND user_id = ? AND kind = ? AND local_date = ?`,
    [workspaceId, userId, kind, localDate],
  )
  return row !== null
}

/**
 * Claim the (workspace, user, kind, local_date) slot.
 *
 * `INSERT OR IGNORE` against the unique index is what makes this safe under a
 * cron that can overlap with itself: two concurrent runs both read "not sent",
 * both insert, and exactly one row survives. The boolean is the claim - callers
 * should send only when it returns true, so a duplicate run is silent rather
 * than a second push.
 */
export async function recordReminderSent(
  workspaceId: string,
  userId: string,
  kind: ReminderKind,
  localDate: string,
): Promise<boolean> {
  const result = await db.execute(
    `INSERT OR IGNORE INTO reminder_log (workspace_id, user_id, kind, local_date)
     VALUES (?, ?, ?, ?)`,
    [workspaceId, userId, kind, localDate],
  )
  return result.changes > 0
}

/** All reminder rows already written for a workspace on one local date. */
export async function getRemindersSentOn(
  workspaceId: string,
  localDate: string,
): Promise<{ user_id: string; kind: ReminderKind }[]> {
  return db.query<{ user_id: string; kind: ReminderKind }>(
    `SELECT user_id, kind FROM reminder_log
     WHERE workspace_id = ? AND local_date = ?`,
    [workspaceId, localDate],
  )
}
