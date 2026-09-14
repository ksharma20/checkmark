/**
 * The notification category catalogue.
 *
 * A category is a class of message the ORGANISATION broadcasts, and it is the
 * unit the workspace switchboard operates on. Nothing in the system may invent a
 * category outside this file.
 *
 * Why categories and not `NotificationType` directly: there are twelve types and
 * an admin does not want twelve switches. "Leave approved" and "Document
 * verified" are the same thing to a person - the outcome of something they asked
 * for - and the day a thirteenth type lands it should inherit an existing switch
 * rather than silently arrive unswitchable.
 *
 * `CATEGORY_OF` is a total `Record` over `NotificationType` on purpose. A new
 * type added to that union without a category here is a **compile error**, which
 * is the same trick `RESOURCE_DEFS` uses in the permission catalogue. A
 * `Partial` here would mean a new notification quietly bypassing every
 * preference the organisation has set.
 */

import type { NotificationType } from '@/lib/db/queries/notifications'

export type NotificationCategory = 'approvals' | 'announcements'

/**
 * Which category each notification type belongs to.
 *
 * Not every message in the product appears here, and that is structural rather
 * than an oversight: the presence ladder (5h / 10h / auto-checkout) and the
 * daily check-in / check-out reminders are **push-only**. They write no
 * `notifications` row, so they have no `NotificationType` and therefore no
 * category. They are schedules the member sets, resolved from
 * `member_presence_prefs` and `member_reminder_prefs` at send time - see the
 * note on `CATEGORY_DEFS` below.
 */
export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  // Both halves of an approval - the request landing in an approver's queue and
  // the answer coming back to the person who filed it - are ONE category. They
  // were two (`approvals_inbox` / `approvals_outcome`) and the split did not
  // survive contact with the settings screen: two rows saying almost the same
  // thing, which an admin has to read twice to tell apart. See CATEGORY_DEFS.
  leave_submitted: 'approvals',
  regularization_submitted: 'approvals',
  extension_submitted: 'approvals',

  leave_approved: 'approvals',
  leave_rejected: 'approvals',
  regularization_approved: 'approvals',
  regularization_rejected: 'approvals',
  document_verified: 'approvals',
  document_rejected: 'approvals',
  extension_approved: 'approvals',
  extension_rejected: 'approvals',

  announcement: 'announcements',
}

export interface CategoryDef {
  key: NotificationCategory
  /**
   * `workspace` - the preference is keyed on (workspace, member), because the
   * notification is produced by a workspace and a member may want it from one
   * workspace and not another. Every category is this today.
   *
   * `account` - keyed on the member alone, for a message that belongs to no
   * workspace. `presence` was the only one and has left the catalogue (see
   * `CATEGORY_DEFS`), so this arm is currently unused. It is kept because the
   * reason it existed has not gone away: `presence_events` carries no
   * `workspace_id` and deliberately never will, so any future message about a
   * check-in session has no workspace to key on either.
   */
  scope: 'workspace' | 'account'
  /**
   * May a workspace admin switch this off for everybody?
   *
   * This field decides two things: what the workspace may configure, and what
   * the admin switchboard RENDERS AT ALL. A category a workspace cannot switch
   * is not shown there disabled - it is not shown. Every category is `true`
   * today, so the switchboard shows the whole catalogue;
   * `/ws/[slug]/settings` still filters on this field rather than listing keys,
   * so a future locked category disappears from it by setting one flag.
   *
   * `true` is exact for a `scope: 'workspace'` category: the workspace produced
   * the notification, so switching it off means nothing is written and nothing
   * is sent. For a `scope: 'account'` category it could only ever be a VOTE
   * rather than a verdict - a session belongs to no workspace, so one workspace
   * must not silence a member who belongs to two. No category is both, and none
   * should be made both without answering that question first.
   *
   * It is NOT what enforces the rule. `serialiseCategoriesOff()` refuses to
   * store a non-switchable key and `parseCategoriesOff()` refuses to honour one
   * already stored; the filter is presentation.
   */
  workspaceSwitchable: boolean
  /**
   * May a member mute the push for this?
   *
   * Also what would put a category on the member settings screen at all - a
   * category a member cannot mute is not rendered there disabled, it is not
   * rendered. Showing somebody a switch they may not throw invites them to try,
   * and the answer is always no.
   *
   * **Every category is `false` today**, so `/me/settings` shows no categories
   * whatsoever: what a member controls there are their reminder and ladder
   * SCHEDULES, which are not categories (see `CATEGORY_DEFS`). The filter is
   * kept rather than replaced by "render nothing", because the screen resolves
   * from this field instead of hardcoding.
   *
   * It is NOT what enforces the rule. Both member PATCH routes and
   * `setCategoryMuted()` in `db/queries/notification-prefs.ts` refuse a
   * non-mutable category on their own; the filter is presentation.
   */
  memberMutable: boolean
  /**
   * Does a member who has never touched the switch receive the push?
   *
   * The fallback `notification_prefs` resolves against when a member has no row
   * for the category. `true` is the classic default - the notification arrives
   * until somebody mutes it. `false` would make the category **opt-in**.
   *
   * It applies to the PUSH CHANNEL ONLY, exactly like a mute does, so the in-app
   * feed row is written for everybody regardless (invariant 24, step 3).
   *
   * **Nothing reads this today**, because it is only meaningful where
   * `memberMutable` is true and no category is: a category the member cannot
   * mute has no preference row to be absent, so its default is never consulted.
   * `approvals` and `announcements` are `true` to say what they do, not because
   * anything acts on it.
   *
   * KEPT, not deleted, and the reason is mechanical. Every reader of a
   * preference - `defaultMuted()`, `isPushMuted()`, `getMutedCategories()` -
   * resolves the default from THIS field rather than from a hardcoded list, so
   * the day a category becomes member-mutable again it gets a correct default by
   * setting one boolean here. Deleting the field would mean re-deriving the
   * whole resolved-default rule at the moment it is needed, which is the worst
   * possible time to rediscover that an explicit choice must survive a later
   * change to the default (which is why `notification_prefs.muted` is a column
   * rather than the old row-means-muted convention).
   */
  defaultOn: boolean
  /**
   * Shown when a switch is locked, so the reason is visible rather than implied.
   *
   * **Currently unread.** Its one consumer was the member settings screen's
   * disabled-row caption, and that screen renders no category rows at all now;
   * the admin switchboard's equivalent path is unreachable too, because no
   * category is workspace-locked.
   *
   * KEPT for the same mechanical reason as `defaultOn`: both screens resolve the
   * caption from this field rather than hardcoding a string per key, so a
   * category locked again in future gets its reason back by setting it here and
   * adding one entry to the copy table. Note the copy table is a plain
   * `Record<string, string>` lookup - a stale key here typechecks and goes
   * missing at runtime, so a value set here must be paired with a locale entry.
   */
  lockedReason?: string
}

/**
 * A category is what the ORGANISATION broadcasts - and that sentence is now the
 * whole partition, not half of it.
 *
 * | category        | workspaceSwitchable | memberMutable | default | configured on     |
 * |-----------------|---------------------|---------------|---------|-------------------|
 * | `approvals`     | yes                 | no            | on      | `/ws/../settings` |
 * | `announcements` | yes                 | no            | on      | `/ws/../settings` |
 *
 * Both remaining categories are workspace-switchable and member-immutable, so
 * the ENTIRE catalogue is configured on `/ws/[slug]/settings` and **nothing
 * appears on `/me/settings` as a category at all**. There is no second column to
 * keep in sync and no diagonal to maintain: one screen owns the whole table.
 *
 * `approvals` covers both halves of an approval - the request reaching an
 * approver and the outcome reaching the person who filed it. Member-immutable
 * because a person is entitled to be told what happened to a request they filed;
 * a member muting it and then not learning their leave was rejected is a worse
 * outcome than any amount of noise.
 *
 * `announcements` is locked because it is the one message class that cannot
 * afford to be missed - a policy change, a closure, an office day. Handing out a
 * switch for it rebuilds the exact problem the feature exists to solve.
 *
 * ## Why `reminders` and `presence` are no longer here
 *
 * They used to be, as member-mutable, opt-in (`defaultOn: false`) categories:
 * `reminders` for the daily check-in / check-out nudge, `presence` for the
 * 5h / 10h / auto-checkout ladder. They are gone because **they are schedules,
 * not categories.**
 *
 * A category is a class of MESSAGE; a schedule is a TIME. A member who wants a
 * check-in nudge has to say when, and that answer is the interesting one - the
 * two reminder times now live in `member_reminder_prefs` and the four ladder
 * hours in `member_presence_prefs`. **Having a value set IS the opt-in.**
 *
 * Which is precisely what a category could not express without a second source
 * of truth for one fact. A boolean "and also, on" beside a stored time means a
 * member with `muted = 0` and no time set is ON by the switch and OFF by the
 * schedule, and a member with a time set and `muted = 1` is the reverse. Nothing
 * in the system can arbitrate that, because neither representation is wrong -
 * they answer different questions and were only ever assumed to agree. Two
 * representations of the same fact do not stay in step; they drift, and then no
 * code can say which one is the truth. Deleting the boolean leaves exactly one
 * place to look.
 *
 * The consequence is that both paths are now **push-only**: they write no
 * `notifications` row, have no `NotificationType`, and never reach `notify()`.
 * That was already true of the ladder and is now true of the reminder too. The
 * MECHANIC is untouched either way - `autoCheckoutEvent()` runs regardless of
 * whether anybody is told - and a workspace still owns the working days, the
 * holiday calendar and the timezone that gate a reminder. It just no longer owns
 * an on/off switch for one.
 *
 * Nothing is rendered locked on either screen. Both used to render their
 * opposite half disabled, captioned with the reason, on the argument that
 * somebody should see the decision was made rather than wonder where the switch
 * went. That was the wrong trade: a switch nobody may throw still reads as a
 * switch.
 */
export const CATEGORY_DEFS: Record<NotificationCategory, CategoryDef> = {
  /**
   * Both halves of an approval, in one switch.
   *
   * This was two categories - `approvals_inbox` (a request reaching an
   * approver) and `approvals_outcome` (the answer reaching the person who
   * filed it). They are merged because they are one subject to the admin
   * configuring them, and two near-identical rows are harder to tell apart
   * than one row is to understand.
   *
   * `memberMutable: false` is the merge's one real cost, and it is the
   * deliberate half: the inbox side used to be mutable and no longer is, so an
   * approver can no longer silence "a request is waiting for you". The outcome
   * side could not be made mutable in exchange - a person not learning their
   * leave was rejected is the failure this whole field exists to prevent - and
   * one category can only hold one answer.
   *
   * The consequence for the workspace switch is worth stating where it is set:
   * switching `approvals` off silences BOTH audiences at once, so a workspace
   * quieting its approvers also stops every employee being told the outcome of
   * their own request. The admin-side copy says this outright.
   */
  approvals: {
    key: 'approvals',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: false,
    // Declarative only: `memberMutable: false` means no member ever holds a
    // preference row for this, so nothing consults the default. It says what the
    // category does rather than deciding it.
    defaultOn: true,
    lockedReason: 'always_on_approvals',
  },
  /**
   * The workspace-wide notice - a policy change, a closure, an office day.
   *
   * `memberMutable: false` for the reason the feature exists: this is the one
   * message class that cannot afford to be missed, and a per-member off switch
   * rebuilds the problem it was built to solve. `workspaceSwitchable: true`
   * because an organisation that never broadcasts is entitled to say so.
   */
  announcements: {
    key: 'announcements',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: false,
    // Declarative only, exactly as above - nothing reads it.
    defaultOn: true,
    lockedReason: 'always_on_announcement',
  },
}

export const ALL_CATEGORIES = Object.keys(CATEGORY_DEFS) as NotificationCategory[]

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && value in CATEGORY_DEFS
}

/**
 * Parse `workspaces.notification_categories_off`.
 *
 * Stores the **disabled** set, not the enabled one, so an empty array means
 * everything is on and a category added to this file later is on everywhere
 * with no migration and no backfill. Defensive in the same way `working_days`
 * is: a malformed column must not take the notification system down with it.
 *
 * It filters on `workspaceSwitchable` as well as on the catalogue, and that
 * pair of filters is what made first revoking a workspace switch, and then
 * retiring two categories outright, a change to this file rather than a
 * migration. `serialiseCategoriesOff()` has always refused to WRITE a
 * non-switchable key, but the column is historical data: workspaces that
 * switched `reminders` or `presence` off while they still could have those words
 * sitting in it today, and now that the keys are not in the catalogue at all
 * `isNotificationCategory()` drops them on the way in. That is deliberate, and
 * for the same reason as before - honouring a stored key would leave exactly the
 * bug this pair of filters exists to prevent: a category nobody can see a switch
 * for, silenced forever, with no screen in the product able to explain why.
 * Reading through the catalogue means such rows go quiet the moment the key
 * leaves it, and would come back if it returned - nothing is rewritten either
 * way, so no backfill was needed to retire them.
 *
 * Every consumer of the column goes through here (`notify()`, the announcement
 * fan-out, the admin switchboard), so this is the single place that has to be
 * right.
 */
export function parseCategoriesOff(raw: string | null | undefined): Set<NotificationCategory> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter(
        (c): c is NotificationCategory =>
          isNotificationCategory(c) && CATEGORY_DEFS[c].workspaceSwitchable,
      ),
    )
  } catch {
    return new Set()
  }
}

/**
 * Serialise back, keeping only categories a workspace is actually allowed to
 * switch off. The route validates too; doing it here as well means a stored
 * value can never claim a retired or locked category is disabled, whatever wrote
 * it - a client posting an old four-key payload gets the two it may set and
 * silent removal of the two it may not, rather than a 500 or a honoured write.
 */
export function serialiseCategoriesOff(categories: Iterable<NotificationCategory>): string {
  const kept = ALL_CATEGORIES.filter(
    (c) => CATEGORY_DEFS[c].workspaceSwitchable && [...categories].includes(c),
  )
  return JSON.stringify(kept)
}
