import { db } from '../index'
import {
  CATEGORY_DEFS,
  isNotificationCategory,
  type NotificationCategory,
} from '@/lib/notifications/categories'

/**
 * Per-member notification mutes.
 *
 * The storage rule, which every function here depends on: **a row means muted**.
 * There is no `enabled` column. Absence is the default and the default is "on",
 * so nothing needs seeding, a member who never opens the settings screen has no
 * rows, and un-muting is a DELETE rather than an UPDATE.
 *
 * The trade-off, stated so it is not rediscovered: if a category's default ever
 * needs to become "off", this representation cannot express it - absence would
 * then mean off and every existing row would be meaningless. That is acceptable
 * because the workspace switchboard already covers "off for everybody", which is
 * the only reason a default would need flipping.
 *
 * `workspaceId === null` addresses the account-level row, which only the
 * `presence` category uses.
 */

export interface NotificationPref {
  id: string
  user_id: string
  workspace_id: string | null
  category: string
  created_at: string
}

/**
 * The categories this member has muted in this scope.
 *
 * Pass `null` for the account-level scope. Callers get a Set because every use
 * is a membership test, and because it makes "no rows" and "no preferences"
 * the same empty answer.
 */
export async function getMutedCategories(
  userId: string,
  workspaceId: string | null,
): Promise<Set<NotificationCategory>> {
  const rows = workspaceId
    ? await db.query<{ category: string }>(
        'SELECT category FROM notification_prefs WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId],
      )
    : await db.query<{ category: string }>(
        'SELECT category FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL',
        [userId],
      )

  // Filter through the catalogue rather than trusting the column: a row left
  // behind by a category that was later removed must not resolve to anything.
  return new Set(rows.map((r) => r.category).filter(isNotificationCategory))
}

/**
 * Mute or un-mute one category.
 *
 * The INSERT is `OR IGNORE` and the unique indexes are what make it idempotent -
 * two tabs toggling the same switch cannot produce two rows, and neither call
 * needs to read first. Muting an immutable category is refused here as well as
 * in the route, because a preference row that nothing will ever honour is worse
 * than an error.
 */
export async function setCategoryMuted(
  userId: string,
  workspaceId: string | null,
  category: NotificationCategory,
  muted: boolean,
): Promise<void> {
  if (!CATEGORY_DEFS[category].memberMutable) {
    throw new Error(`notification category '${category}' is not member-mutable`)
  }

  if (!muted) {
    if (workspaceId) {
      await db.execute(
        'DELETE FROM notification_prefs WHERE user_id = ? AND workspace_id = ? AND category = ?',
        [userId, workspaceId, category],
      )
    } else {
      await db.execute(
        'DELETE FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL AND category = ?',
        [userId, category],
      )
    }
    return
  }

  await db.execute(
    `INSERT OR IGNORE INTO notification_prefs (user_id, workspace_id, category)
     VALUES (?, ?, ?)`,
    [userId, workspaceId, category],
  )
}

/**
 * Everyone in this workspace who has muted this category.
 *
 * The bulk counterpart to `getMutedCategories`, and the reason
 * `idx_notif_prefs_lookup` exists. The wall-clock reminder pass iterates
 * workspaces, not members, so it reads this once per workspace and filters the
 * member list in memory - the alternative is one preference query per member
 * per tick, which for a 500-person workspace is 500 round trips every 30
 * minutes to answer a question about a handful of rows.
 */
export async function mutedUserIdsFor(
  workspaceId: string,
  category: NotificationCategory,
): Promise<Set<string>> {
  const rows = await db.query<{ user_id: string }>(
    'SELECT user_id FROM notification_prefs WHERE workspace_id = ? AND category = ?',
    [workspaceId, category],
  )
  return new Set(rows.map((r) => r.user_id))
}

/**
 * The account-level counterpart, for the presence ladder. Same shape, but keyed
 * on the member alone because a check-in session belongs to no workspace.
 */
export async function isAccountCategoryMuted(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const row = await db.queryOne<{ id: string }>(
    'SELECT id FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL AND category = ? LIMIT 1',
    [userId, category],
  )
  return row !== null
}
