/**
 * Where a notification takes you when you tap it.
 *
 * One resolver, three consumers: the `/ws` bell panel, the `/me` notification
 * list, and the push payloads themselves (`data.url`, honoured by the service
 * worker's `notificationclick`). Before this existed each of them had its own
 * guess - the bell panel sent *every* row to `/ws/:slug/leaves`, and a `/me`
 * row went to `/me/ws/:slug` whatever it was about - so a rejected document
 * and a check-in reminder opened the same screen.
 *
 * Deliberately pure: no React, no `next/navigation`, no DB types. That is what
 * lets a route handler build the `data.url` for a push using the exact same
 * function the browser uses for the in-app row, so the two can never disagree.
 *
 * The `type` is the discriminator, not `ref_type`. `ref_type`/`ref_id` name the
 * row a notification points at (`leave_request`, `employee_document`, …) and are
 * accepted here so a future deep link (`…/approvals?focus=<id>`) needs no new
 * signature, but today the destination is decided by family alone.
 */

export interface NotificationTarget {
  type: string
  ref_type: string | null
  ref_id: string | null
  /**
   * The workspace the notification belongs to. Nullable because
   * `notifications.workspace_id` is nullable (account-level rows), and because
   * the join that supplies the slug is a LEFT JOIN. Every branch below must
   * cope with it being absent - navigating to the literal `/me/ws/null` is the
   * bug this parameter's nullability is here to prevent.
   */
  workspace_slug?: string | null
}

/**
 * Which shell is asking. The same notification has two homes: an admin tapping
 * "New leave request" in the `/ws` bell wants the approvals queue, while the
 * employee tapping "Leave approved" in `/me` wants their own leave screen.
 */
export type NotificationSurface = 'me' | 'ws'

export function notificationHref(n: NotificationTarget, surface: NotificationSurface): string {
  const slug = n.workspace_slug ?? null

  // The last-resort destination. On `/ws` we can at least land on the
  // workspace home; with no slug there is nothing workspace-shaped to open, so
  // both surfaces fall back to the personal home rather than an invalid URL.
  const fallback = surface === 'ws' && slug ? `/ws/${slug}` : '/me'

  // Admin-facing destinations need a slug in the path. Without one the only
  // honest answer is the fallback.
  const wsApprovals = slug ? `/ws/${slug}/approvals` : fallback

  const type = n.type

  if (type.startsWith('leave_')) {
    return surface === 'ws' ? wsApprovals : '/me/leave'
  }

  if (type.startsWith('regularization_')) {
    // A correction is *about* a past day, so on `/me` the timeline - which is
    // already scoped to the active workspace - is where the outcome is visible.
    return surface === 'ws' ? wsApprovals : '/me/timeline'
  }

  if (type === 'checkin_reminder' || type === 'checkout_reminder') {
    // Both reminders exist to get somebody to the check-in button.
    return '/me'
  }

  if (type === 'presence_extend') {
    // The 10h rung of the presence ladder. It is the last push before
    // auto-checkout, so it opens the extension picker directly rather than
    // dropping the member on `/me` to find it - `CheckinButtons` reads this
    // query param and mounts the dialog. Resolved here so the cron route never
    // writes the literal, which is exactly how the announcement fan-out drifted.
    return '/me?extend=1'
  }

  if (type.startsWith('document_')) {
    return '/me/documents'
  }

  if (type === 'announcement') {
    // An announcement has no screen of its own - the notification body *is* the
    // content - so it reopens the scoped notification list it came from.
    return slug ? `/me/notifications?ws=${encodeURIComponent(slug)}` : '/me/notifications'
  }

  return fallback
}
