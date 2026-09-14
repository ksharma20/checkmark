import { db } from '../index'

/**
 * Wall-clock check-in / check-out reminders.
 *
 * The existing cron reminders are *event-anchored*: they start from a
 * presence_events row and count elapsed hours. That design can never notice
 * somebody who never checked in, because there is no row to iterate. This file
 * backs the second, *workspace-anchored* pass: iterate workspaces where at
 * least one member has asked for a reminder, work out who has (or has not) an
 * event today, and dedupe on `reminder_log` rather than on a column of an event
 * row.
 *
 * The schedule moved. It used to be one pair of times on the workspace row,
 * pushed to everybody; it is now one pair of times per member per workspace in
 * `member_reminder_prefs`. `workspaces.checkin_reminder_at` /
 * `checkout_reminder_at` are VESTIGIAL - still written by
 * `PATCH /api/ws/[slug]`, never read as the schedule again, and deliberately
 * not selected by anything in this file. They survive only as a pre-filled
 * suggestion on the member's own settings screen. Selecting them here would be
 * the first step back towards a delivery fallback, which is exactly the nag the
 * move was made to stop.
 *
 * There is no enabled/muted column in `member_reminder_prefs` and there must
 * never be one: THE TIME IS THE SWITCH. A row with `checkin_at = '09:30'` and a
 * hypothetical `enabled = 0` is a question no code in the system could answer,
 * because neither column would be wrong - they answer different questions and
 * were only ever assumed to agree.
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

/**
 * What the pass needs to gate a workspace, and nothing else.
 *
 * Every field here answers a question the WORKSPACE owns even though the
 * schedule no longer is one: the timezone the member's 'HH:MM' is read in,
 * the working days a reminder is suppressed outside of, the id the holiday and
 * leave lookups are keyed on, and the name/slug the push text and its
 * destination need. A member may choose *when*; they cannot choose to be
 * reminded on a Sunday or on a company holiday.
 */
export interface WorkspaceReminderConfig {
  id: string
  slug: string
  name: string
  display_timezone: string
  /** JSON array of weekday numbers, 0 = Sunday. e.g. '[1,2,3,4,5]' */
  working_days: string
}

export interface ReminderMember {
  user_id: string
  email: string
  full_name: string | null
}

/** One member's schedule in one workspace. NULL = that kind is off. */
export interface MemberReminderTimes {
  user_id: string
  checkin_at: string | null
  checkout_at: string | null
}

/**
 * Every live workspace in which at least one member has asked for a reminder.
 *
 * Archived workspaces are excluded - they must not notify anyone.
 *
 * `EXISTS` rather than a join, because the question is "does this workspace
 * have any work to do", not "which members". A join would multiply the
 * workspace row out once per member and then need a DISTINCT, and the pass
 * still has to read the full member list per workspace anyway - once it has
 * cleared the working-day and holiday gates, which are the cheap ones. The
 * `(checkin_at IS NOT NULL OR checkout_at IS NOT NULL)` predicate is not
 * redundant with the row's existence: a member who turns both kinds off leaves
 * their row behind with two NULLs (there is no enabled column to unset and
 * nothing deletes the row), and that workspace has no work to do.
 *
 * `idx_member_reminder_prefs_ws` is what keeps the EXISTS from scanning every
 * member schedule in the product on every one of the 48 daily ticks.
 */
export async function getWorkspacesWithMemberReminders(): Promise<WorkspaceReminderConfig[]> {
  return db.query<WorkspaceReminderConfig>(
    `SELECT id, slug, name, display_timezone, working_days
     FROM workspaces w
     WHERE w.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM member_reminder_prefs p
         WHERE p.workspace_id = w.id
           AND (p.checkin_at IS NOT NULL OR p.checkout_at IS NOT NULL)
       )
     ORDER BY w.id ASC`,
  )
}

/**
 * Every schedule held in one workspace, in one read.
 *
 * The bulk shape is deliberate and is the reason the pass iterates workspaces
 * rather than members. The alternative - resolving each member's times inside
 * the member loop - is one round trip per member per tick, which for a
 * 500-person workspace is 500 queries every thirty minutes to answer a question
 * about a handful of rows. Rows with both columns NULL are returned rather than
 * filtered in SQL: the caller is bucketing by kind anyway, and a predicate here
 * would have to be repeated and kept in step with that.
 */
export async function getMemberReminderTimes(workspaceId: string): Promise<MemberReminderTimes[]> {
  return db.query<MemberReminderTimes>(
    `SELECT user_id, checkin_at, checkout_at
     FROM member_reminder_prefs
     WHERE workspace_id = ?`,
    [workspaceId],
  )
}

/**
 * One member's own schedule, for their settings screen.
 *
 * `null` means no row at all, which is NOT the same fact as a row holding two
 * NULLs even though both deliver nothing: the first is a member who has never
 * opened the screen, the second is one who turned both kinds off. The route
 * flattens them for display; the distinction stays available here rather than
 * being erased at the query layer.
 */
export async function getMemberReminderPrefs(
  userId: string,
  workspaceId: string,
): Promise<{ checkin_at: string | null; checkout_at: string | null } | null> {
  return db.queryOne<{ checkin_at: string | null; checkout_at: string | null }>(
    `SELECT checkin_at, checkout_at
     FROM member_reminder_prefs
     WHERE user_id = ? AND workspace_id = ?`,
    [userId, workspaceId],
  )
}

/**
 * Write this member's schedule for this workspace.
 *
 * Both times are written on every call - the route resolves "omitted means
 * leave it alone" against the current row before getting here, so by this point
 * the arguments are the whole intended state. `null` for a kind turns it off,
 * and turning both off leaves the row in place with two NULLs rather than
 * deleting it: there is nothing to clean up, and a DELETE would make "never
 * configured" and "deliberately off" the same absence.
 *
 * Two statements rather than an `ON CONFLICT` upsert, matching
 * `setCategoryMuted()` next door. It is race-safe for the reason the upsert
 * would be: `idx_member_reminder_prefs_one` is what decides which of two
 * concurrent tabs actually creates the row - the loser's INSERT is ignored, not
 * an error - and the UPDATE that follows then sets the values on whichever row
 * survived. Neither statement cares which one it was.
 */
export async function setMemberReminderPrefs(
  userId: string,
  workspaceId: string,
  times: { checkinAt: string | null; checkoutAt: string | null },
): Promise<void> {
  // Same id shape as every other insert in the query layer (holidays, leaves):
  // a UUID with the dashes stripped. The column has no DEFAULT in this table,
  // so it has to be generated here rather than left to SQLite.
  const id = crypto.randomUUID().replace(/-/g, '')

  await db.execute(
    `INSERT OR IGNORE INTO member_reminder_prefs (id, user_id, workspace_id, checkin_at, checkout_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, workspaceId, times.checkinAt, times.checkoutAt],
  )

  await db.execute(
    `UPDATE member_reminder_prefs
     SET checkin_at = ?, checkout_at = ?, updated_at = datetime('now')
     WHERE user_id = ? AND workspace_id = ?`,
    [times.checkinAt, times.checkoutAt, userId, workspaceId],
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
