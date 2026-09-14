import { db } from '../index'
import {
  ALL_CATEGORIES,
  CATEGORY_DEFS,
  isNotificationCategory,
  type NotificationCategory,
} from '@/lib/notifications/categories'

/**
 * Per-member notification push preferences.
 *
 * ## THIS MODULE HAS NO LIVE CALLER
 *
 * Read that before anything else here. Every category remaining in
 * `lib/notifications/categories.ts` is `memberMutable: false`, so **nothing in
 * the product reads or writes a `notification_prefs` row today.** The two
 * categories that were member-mutable - `reminders` and `presence` - left the
 * catalogue when they became SCHEDULES rather than categories
 * (`member_reminder_prefs`, `member_presence_prefs`; having a time set is the
 * opt-in). `notify()` still calls into here, but only from a branch guarded by
 * `def.memberMutable`, which no category satisfies.
 *
 * It is kept rather than deleted because the machinery is correct and generic -
 * every function resolves through `CATEGORY_DEFS` rather than naming a category
 * - so the moment a third category is member-mutable this file works unchanged,
 * with no edit and no migration. Deleting it would mean rediscovering two things
 * that are not obvious from the outside and are silent when got wrong:
 *
 *  1. **SQLite treats NULLs as DISTINCT in a unique index.** That is why the
 *     table carries TWO PARTIAL unique indexes (`WHERE workspace_id IS NOT NULL`
 *     and `WHERE workspace_id IS NULL`) rather than one plain
 *     `UNIQUE (user_id, workspace_id, category)`. A single index would not
 *     constrain the account-level rows at all, and a member could quietly
 *     accumulate contradictory preferences for the same category. It is the same
 *     `NULL = NULL` trap that once detached invited people's HR records.
 *  2. **A boolean column is required for two defaults to coexist**, because
 *     absence can only ever mean one thing. See the storage rule below.
 *
 * ## The storage rule
 *
 * **A row is an explicit choice, and `muted` is what it chose.** Absence means
 * the member has never touched that switch, and resolves to
 * `CATEGORY_DEFS[category].defaultOn` - so nothing is ever seeded and a member
 * who has not opened the settings screen has no rows at all.
 *
 * It was not always this shape. A row used to MEAN muted, with no boolean, and
 * un-muting was a DELETE. That can express exactly one default - absence means
 * on, for every category - so an opt-in (`defaultOn: false`) category would have
 * had to be spelled as absence too, which is the same absence already meaning
 * "on" for its neighbour. The column is what lets two defaults coexist. It also
 * means an explicit choice SURVIVES a later change to the default instead of
 * silently inverting with it: flip `defaultOn` and only the members with no row
 * move.
 *
 * The consequence for callers is the one thing to get right: **you cannot answer
 * "is this muted?" from the rows alone.** A member with no row is muted for an
 * opt-in category and unmuted for the others, so every read below resolves
 * through the catalogue rather than testing for a row's existence. That is why
 * `mutedUserIdsFor()` is gone - a bare set of user ids from this table cannot
 * express the answer for a `defaultOn: false` category, because the members it
 * concerns are precisely the ones it has no rows for.
 *
 * `workspaceId === null` addresses the account-level row, for a category with
 * `scope: 'account'`. There is none today; the arm is kept for the same reason
 * the rest of this file is.
 */

export interface NotificationPref {
  id: string
  user_id: string
  workspace_id: string | null
  category: string
  muted: number
  created_at: string
}

/**
 * Read the `muted` column without trusting its JavaScript type.
 *
 * better-sqlite3 hands back `0`/`1` and libSQL may hand back a boolean for the
 * same INTEGER column, so a bare truthiness test reads `false` correctly and a
 * `!== 0` test does not. `Number()` flattens both.
 */
function toMuted(value: unknown): boolean {
  return Number(value) !== 0
}

/** What a member gets when they have expressed no preference. */
function defaultMuted(category: NotificationCategory): boolean {
  return !CATEGORY_DEFS[category].defaultOn
}

/**
 * The categories whose push this member does NOT receive in this scope.
 *
 * Pass `null` for the account-level scope. Callers get a Set because every use
 * is a membership test, and because it makes "no rows" and "no preferences"
 * the same empty answer.
 *
 * **Resolved, not raw.** The returned set is the effective answer: every
 * member-mutable category in this scope that the member has either muted
 * explicitly or never opted in to. That is what lets a settings screen paint an
 * opt-in category's switch off for a member who has never been there, with no
 * knowledge of defaults on the screen itself - the resolution rule stays in one
 * place instead of being re-implemented per surface. No category is
 * member-mutable today, so this currently returns the empty set for every
 * member in every scope.
 *
 * Categories are taken from the catalogue and matched against the rows, rather
 * than the other way round: a row left behind by a category that was later
 * removed resolves to nothing, and a category added later needs no backfill.
 */
export async function getMutedCategories(
  userId: string,
  workspaceId: string | null,
): Promise<Set<NotificationCategory>> {
  const rows = workspaceId
    ? await db.query<{ category: string; muted: number }>(
        'SELECT category, muted FROM notification_prefs WHERE user_id = ? AND workspace_id = ?',
        [userId, workspaceId],
      )
    : await db.query<{ category: string; muted: number }>(
        'SELECT category, muted FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL',
        [userId],
      )

  const explicit = new Map<NotificationCategory, boolean>()
  for (const row of rows) {
    if (isNotificationCategory(row.category)) explicit.set(row.category, toMuted(row.muted))
  }

  const scope = workspaceId ? 'workspace' : 'account'
  const muted = new Set<NotificationCategory>()
  for (const key of ALL_CATEGORIES) {
    const def = CATEGORY_DEFS[key]
    // An immutable category can hold no preference, so it has no resolved
    // answer to give - `notify()` never consults one for it either.
    if (def.scope !== scope || !def.memberMutable) continue
    if (explicit.get(key) ?? defaultMuted(key)) muted.add(key)
  }
  return muted
}

/**
 * Record this member's choice for one category.
 *
 * Both directions now WRITE a row. Un-muting can no longer be a DELETE: for an
 * opt-in category the absence of a row is what "muted" means, so deleting would
 * store the opposite of what the member just asked for. A row saying
 * `muted = 0` is what "I turned this on" is.
 *
 * Two statements rather than an `ON CONFLICT` upsert. The unique indexes on this
 * table are PARTIAL (`WHERE workspace_id IS NOT NULL` / `IS NULL`), so an upsert
 * would need its conflict target to repeat each index's predicate and would have
 * to be written twice anyway - once per scope. `INSERT OR IGNORE` then `UPDATE`
 * reaches the same state, and is race-safe in the same way the old insert was:
 * the index decides which of two concurrent tabs creates the row, and the update
 * then sets the value on whichever row exists.
 *
 * Muting an immutable category is refused here as well as in the route, because
 * a preference row that nothing will ever honour is worse than an error.
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

  const flag = muted ? 1 : 0

  await db.execute(
    `INSERT OR IGNORE INTO notification_prefs (user_id, workspace_id, category, muted)
     VALUES (?, ?, ?, ?)`,
    [userId, workspaceId, category, flag],
  )

  if (workspaceId) {
    await db.execute(
      'UPDATE notification_prefs SET muted = ? WHERE user_id = ? AND workspace_id = ? AND category = ?',
      [flag, userId, workspaceId, category],
    )
  } else {
    await db.execute(
      'UPDATE notification_prefs SET muted = ? WHERE user_id = ? AND workspace_id IS NULL AND category = ?',
      [flag, userId, category],
    )
  }
}

/**
 * Every explicit choice held in this workspace for one category, as a map from
 * user id to their `muted` value. Members with no row are simply absent.
 *
 * The bulk read, and the reason `idx_notif_prefs_lookup` exists. It is shaped
 * for a caller that iterates WORKSPACES rather than members - the wall-clock
 * reminder pass was one, before a reminder became a schedule - so it reads once
 * per workspace and resolves each member in memory. The alternative is one
 * preference query per member per tick, which for a 500-person workspace is 500
 * round trips every 30 minutes to answer a question about a handful of rows.
 *
 * It returns the CHOICES rather than a finished set of muted user ids, which is
 * the change the default-off categories forced. A set of muted ids would have to
 * enumerate every member who has never touched the switch - people this table
 * has no rows for and no way to name. Pair it with `isPushMuted()`, which is
 * pure and applies the catalogue default; the category travels inside the map so
 * a call site cannot resolve one category's rows against another's default.
 */
export interface CategoryChoices {
  category: NotificationCategory
  /** user id → the value that member explicitly chose. Absent = never chose. */
  explicit: Map<string, boolean>
}

export async function getCategoryChoices(
  workspaceId: string,
  category: NotificationCategory,
): Promise<CategoryChoices> {
  const rows = await db.query<{ user_id: string; muted: number }>(
    'SELECT user_id, muted FROM notification_prefs WHERE workspace_id = ? AND category = ?',
    [workspaceId, category],
  )
  const explicit = new Map<string, boolean>()
  for (const row of rows) explicit.set(row.user_id, toMuted(row.muted))
  return { category, explicit }
}

/**
 * Resolve one member against a `getCategoryChoices()` read. Pure - no DB, no
 * round trip - so a caller can ask it once per member inside a loop it has
 * already paid one query for.
 */
export function isPushMuted(choices: CategoryChoices, userId: string): boolean {
  return choices.explicit.get(userId) ?? defaultMuted(choices.category)
}

/**
 * The account-level counterpart. Same resolution, but keyed on the member alone,
 * for a `scope: 'account'` category - one whose subject belongs to no workspace.
 *
 * Its one caller was the presence ladder, back when `presence` was a category;
 * the ladder now resolves its own schedule from `member_presence_prefs` and no
 * account-scoped category exists. Kept with the rest of this file: the reason
 * the account scope was needed has not gone away, because `presence_events`
 * carries no `workspace_id` and deliberately never will, so any future message
 * about a check-in session still has no workspace to key on.
 */
export async function isAccountCategoryMuted(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const row = await db.queryOne<{ muted: number }>(
    'SELECT muted FROM notification_prefs WHERE user_id = ? AND workspace_id IS NULL AND category = ? LIMIT 1',
    [userId, category],
  )
  return row ? toMuted(row.muted) : defaultMuted(category)
}
