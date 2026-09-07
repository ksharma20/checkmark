/**
 * The notification category catalogue.
 *
 * Every notification this product can send belongs to exactly one category, and
 * a category is the unit both settings surfaces operate on: a workspace switches
 * categories on or off for everybody, a member mutes the push for the ones they
 * are allowed to. Nothing in the system may invent a category outside this file.
 *
 * Why categories and not `NotificationType` directly: there are eleven types and
 * a member does not want eleven switches. "Leave approved" and "Document
 * verified" are the same thing to a person - the outcome of something they asked
 * for - and the day a twelfth type lands it should inherit an existing switch
 * rather than silently arrive unswitchable.
 *
 * `CATEGORY_OF` is a total `Record` over `NotificationType` on purpose. A new
 * type added to that union without a category here is a **compile error**, which
 * is the same trick `RESOURCE_DEFS` uses in the permission catalogue. A
 * `Partial` here would mean a new notification quietly bypassing every
 * preference the user has set.
 */

import type { NotificationType } from '@/lib/db/queries/notifications'

export type NotificationCategory =
  | 'reminders'
  | 'approvals_inbox'
  | 'approvals_outcome'
  | 'announcements'
  | 'presence'

/**
 * Which category each notification type belongs to.
 *
 * Note `presence` has no entry here: the 5h / 10h / 12h pushes are the only
 * messages with no `notifications` row and therefore no `NotificationType` at
 * all. They reach their category through `notifyPresence()` instead.
 */
export const CATEGORY_OF: Record<NotificationType, NotificationCategory> = {
  checkin_reminder: 'reminders',
  checkout_reminder: 'reminders',

  leave_submitted: 'approvals_inbox',
  regularization_submitted: 'approvals_inbox',

  leave_approved: 'approvals_outcome',
  leave_rejected: 'approvals_outcome',
  regularization_approved: 'approvals_outcome',
  regularization_rejected: 'approvals_outcome',
  document_verified: 'approvals_outcome',
  document_rejected: 'approvals_outcome',

  announcement: 'announcements',
}

export interface CategoryDef {
  key: NotificationCategory
  /**
   * `workspace` - the preference is keyed on (workspace, member), because the
   * notification is produced by a workspace and a member may want it from one
   * workspace and not another.
   *
   * `account` - keyed on the member alone. `presence` is the only one, and it
   * has to be: `presence_events` carries no `workspace_id` (deliberately - see
   * CLAUDE.md), so there is no workspace to key a check-in session on.
   */
  scope: 'workspace' | 'account'
  /** May a workspace admin switch this off for everybody? */
  workspaceSwitchable: boolean
  /** May a member mute the push for this? */
  memberMutable: boolean
  /** Shown when a switch is locked, so the reason is visible rather than implied. */
  lockedReason?: string
}

/**
 * Two categories are deliberately locked in both directions.
 *
 * `announcements` because it is the one message class that cannot afford to be
 * missed - a policy change, a closure, an office day - and the whole reason the
 * member-facing mute exists is so somebody escaping a daily reminder does not
 * lose this as collateral. Handing them a switch for it rebuilds the problem.
 *
 * `approvals_outcome` because a person is entitled to be told what happened to
 * a request they filed. An admin switching that off workspace-wide, or a member
 * muting it and then not knowing their leave was rejected, is a worse outcome
 * than any amount of noise.
 *
 * They are still rendered in both settings screens, disabled, with the reason
 * attached. An admin should be able to see that they cannot be switched off.
 */
export const CATEGORY_DEFS: Record<NotificationCategory, CategoryDef> = {
  reminders: {
    key: 'reminders',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: true,
  },
  approvals_inbox: {
    key: 'approvals_inbox',
    scope: 'workspace',
    workspaceSwitchable: true,
    memberMutable: true,
  },
  approvals_outcome: {
    key: 'approvals_outcome',
    scope: 'workspace',
    workspaceSwitchable: false,
    memberMutable: false,
    lockedReason: 'always_on_outcome',
  },
  announcements: {
    key: 'announcements',
    scope: 'workspace',
    workspaceSwitchable: false,
    memberMutable: false,
    lockedReason: 'always_on_announcement',
  },
  presence: {
    key: 'presence',
    scope: 'account',
    workspaceSwitchable: false,
    memberMutable: true,
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
 */
export function parseCategoriesOff(raw: string | null | undefined): Set<NotificationCategory> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter(isNotificationCategory))
  } catch {
    return new Set()
  }
}

/**
 * Serialise back, keeping only categories a workspace is actually allowed to
 * switch off. The route validates too; doing it here as well means a stored
 * value can never claim `announcements` is disabled, whatever wrote it.
 */
export function serialiseCategoriesOff(categories: Iterable<NotificationCategory>): string {
  const kept = ALL_CATEGORIES.filter(
    (c) => CATEGORY_DEFS[c].workspaceSwitchable && [...categories].includes(c),
  )
  return JSON.stringify(kept)
}
