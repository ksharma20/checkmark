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
 * Render an hour count for a push body or a settings summary.
 *
 * The values are REAL numbers now - `half_day_after_h` and friends are stored as
 * REAL so a member can ask for four and a half hours - and `String(5)` gives
 * "5" while `(5).toFixed(1)` gives "5.0". A push that says "5.0 hours since you
 * checked in" reads like a machine reporting a float, so whole numbers print
 * whole and fractional ones keep one decimal.
 *
 * Lives here, beside the bodies that consume it, rather than in
 * `src/lib/presence-ladder.ts`: it is a decision about how copy reads, not about
 * how the ladder works.
 */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 10) / 10)
}

/**
 * The presence ladder - the pushes anchored on an open check-in session.
 *
 * No longer three fixed steps. The hours were hardcoded at 5h / 10h / 12h and
 * every member in the product got the same three, which is wrong in both
 * directions at once: a warehouse shift and a consultant's day are not the same
 * day, and a member who wanted none of it had only the blunt instrument of
 * revoking push permission entirely. The schedule is now four numbers the member
 * sets in `/me/settings`, stored in `member_presence_prefs` and expanded by
 * `resolveLadder()` in `src/lib/presence-ladder.ts`.
 *
 * So the TIMINGS are the member's and the COPY stays ours: these bodies take the
 * hour as an argument and must never restate a number as a word. The old copy
 * read "Five hours since you checked in" and "Ten hours in", which would now be
 * a straightforward lie to anybody who moved the rung.
 *
 * Four rungs, each with a distinct job - which is the whole reason they are
 * separate rungs rather than one message repeated:
 *
 *   halfDay       a nudge, no urgency. Opens the check-in screen. Nothing is
 *                 being asked of the member; they are being told where they are.
 *   fullDay       the last chance to act, so it names the choice and opens the
 *                 extension picker, because from here the only two honest
 *                 answers are "check out" and "I am still working".
 *   overtime      past the day they themselves defined, still checked in.
 *                 Repeats, so it has to stay short and stay free of alarm.
 *   autoCheckout  fires AFTER the fact, so it reports rather than asks. There is
 *                 no action left to offer - the session is already closed - and
 *                 it takes no hour count because the hour is not the point.
 *
 * These are push-only (see `notifyPresence` in `src/lib/notify.ts`): no feed row
 * is written for any of them, so the body carries the entire message and there
 * is nothing to open later for the detail.
 */
export const presenceLadder = {
  halfDay: {
    title: "That's half a day",
    body: (hours: number) =>
      `${formatHours(hours)} hours since you checked in. Check out whenever you are done.`,
  },
  fullDay: {
    title: 'Your day is complete',
    body: (hours: number) =>
      `${formatHours(hours)} hours in. Check out to close the day, or extend if you are still working.`,
  },
  /** Repeats until auto-checkout, so it stays short and states the fact. */
  overtime: {
    title: 'Still checked in',
    body: (hours: number) =>
      `${formatHours(hours)} hours in, past the day you set. Check out, or extend to keep the session open.`,
  },
  /** Fires after the fact, so it reports rather than asks. */
  autoCheckout: {
    title: "You've been checked out",
    body: 'Your session reached the time you set for it, so we closed it for you.',
  },
}

/**
 * The extension picker, and the one error its endpoint can return.
 *
 * Lives beside the ladder rather than in `me.ts` because it is the same feature:
 * the full-day and overtime rungs are the only reason a member ever lands on
 * `/me?extend=1`, and the offer they make ("extend if you are still working") is
 * only true because this dialog exists. Splitting the two across modules is how
 * the promise and the screen drift apart.
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
  /**
   * Server-side, and deliberately a function of the ceiling rather than a
   * sentence with `24` written into it. The number is `MAX_AUTO_CHECKOUT_H` in
   * `src/lib/presence-ladder.ts`, which the check-in route, the extend route and
   * the member's own settings form all now read from one definition; a literal
   * here would be a fourth copy, and the one most likely to be missed when the
   * ceiling moves, because it is the only one a compiler cannot find.
   */
  errorMaxDuration: (maxHours: number) =>
    `A session cannot be extended past ${maxHours} hours from check-in`,
}
