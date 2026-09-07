/**
 * Copy for the `/me` notification surfaces.
 *
 * `en.notifications` in `src/locales/en.ts` holds the remaining push bodies for
 * the leave and regularization families. This module holds the UI copy for the
 * notification screens plus the presence ladder, and is imported directly
 * (`@/locales/en/notifications`) rather than through `en`.
 */
export const notificationsUi = {
  /** Unified view - every workspace, badged. */
  titleAll: 'All notifications',
  /** Scoped view - one workspace, no badges (the header already says which). */
  titleWorkspace: 'Notifications',
  markAllRead: 'Mark all read',
  empty: 'No notifications yet',
  emptyWorkspace: 'No notifications in this workspace yet',
  /** Badge for an account-level notification that belongs to no workspace. */
  personalBadge: 'Personal',
}

/**
 * Copy for the document review notifications.
 *
 * Kept in this module rather than the inline `en.notifications` group because
 * that group is the original single-file copy and is closed to additions - new
 * strings go in a per-area module (invariant 16).
 *
 * These fire when an admin verifies or rejects an employee-supplied document.
 * Until they existed an admin could reject somebody's ID proof and the employee
 * was told nothing at all - the slot just silently went red the next time they
 * happened to open `/me/documents`.
 */
export const documentNotifications = {
  verifiedTitle: 'Document verified',
  verifiedBody: (documentName: string) => `Your ${documentName} has been verified.`,
  rejectedTitle: 'Document rejected',
  /**
   * The reason is the whole point of the notification - without it the employee
   * knows only that they must do something again, not what.
   */
  rejectedBody: (documentName: string, reason: string) =>
    `Your ${documentName} was rejected: ${reason}`,
  /** Defensive: `reject_reason` is required by the route, but the column is nullable. */
  rejectedBodyNoReason: (documentName: string) =>
    `Your ${documentName} was rejected. Please upload it again.`,
}

/**
 * The presence ladder - the only three pushes anchored on an open check-in.
 *
 * Three steps, not seven. The old ladder fired at 4/8/12/16/18/20/22h and every
 * rung said the same thing, so it read as nagging rather than as a signal; worse,
 * auto-checkout lands at 12h, so the 16h and later rungs could never fire at all.
 * Each step now has a distinct job and its own destination:
 *
 *   5h   a nudge with no urgency  - you may be on a half day
 *   10h  the last chance to act   - links to the extension picker, because from
 *                                   here the only two honest answers are "check
 *                                   out" and "tell us you are still working"
 *   12h  a statement of fact      - the session is already closed; asking for an
 *                                   action would be asking for one that no longer
 *                                   exists
 *
 * These are push-only (see `notifyPresence` in `src/lib/notify.ts`), so the body
 * has to carry the whole message - there is no feed row to open for the detail.
 */
export const presenceLadder = {
  fiveHour: {
    title: "That's half a day",
    body: "Five hours since you checked in. Heading off?",
  },
  tenHour: {
    title: 'Your day is complete',
    body: 'Ten hours in. Check out and go home, or extend if you are still working.',
  },
  /** Fires after the fact, so it reports rather than asks. */
  autoCheckout: {
    title: "You've been checked out",
    body: 'Your session reached its scheduled end, so we closed it for you.',
  },
}

/**
 * The extension picker, and the one error its endpoint can return.
 *
 * Lives beside the ladder rather than in `me.ts` because it is the same feature:
 * the 10h push is the only reason a member ever lands on `/me?extend=1`, and the
 * offer it makes ("extend if you are still working") is only true because this
 * dialog exists. Splitting the two across modules is how the promise and the
 * screen drift apart.
 */
export const extendSession = {
  trigger: 'Extend session',
  title: 'Still working?',
  intro: 'Push your auto-checkout back. Your check-in time does not change.',
  option: (hours: number) => `${hours} hours`,
  cancel: 'Not now',
  confirm: 'Extend',
  confirming: 'Extending…',
  /** The clamp is silent by design, so the toast states the time we actually set. */
  toastExtended: (until: string) => `Extended — auto checkout now ${until}`,
  toastFailed: 'Could not extend your session',
  toastNetworkError: 'Network error. Please try again.',
  /** Server-side. The allow-list is closed, so naming it is the useful half. */
  errorInvalidExtension: 'Extension must be 2, 4, 6, 8 or 12 hours',
}
