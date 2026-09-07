/**
 * The person screen's read-only panels: Activity and Leave.
 *
 * Kept out of `ws-people.ts` on purpose. That module owns the directory and the
 * employee record - the things an admin *edits*. These two tabs answer a
 * different question ("what has this person actually done?") and are wholly
 * read-only, so the copy is descriptive rather than instructional: no verbs, no
 * Save, and every empty state has to explain WHY it is empty rather than
 * inviting the admin to fill it, because they cannot.
 */
export const wsPerson = {
  // ── Activity tab ──────────────────────────────────────────────────────────
  activityTitle: 'Attendance',
  /** The window is fixed at 30 days and computed server-side, in the
   *  workspace's timezone - so the heading states it rather than implying the
   *  admin picked it. */
  activityRange: 'Last 30 days',
  activityOffice: 'In office',
  activityRemote: 'Remote',
  activityAbsent: 'Absent',
  activityHolidays: 'Holidays',
  /** Reads under the split bar. Working days exclude weekends and holidays, so
   *  saying so stops the four numbers looking like they should sum to 30. */
  activityWorkdays: (n: number) => `${n} working ${n === 1 ? 'day' : 'days'} in this window`,
  activityLoadFailed: 'Could not load attendance.',
  activityEmpty: 'No attendance yet',
  activityEmptyHint: 'Nothing has been recorded for this person in the last 30 days.',

  timelineTitle: 'Timeline',
  timelineLoadFailed: 'Could not load the timeline.',
  timelineEmpty: 'No check-ins yet',
  timelineEmptyHint: 'Check-ins appear here as soon as this person records one.',
  timelineMore: 'Load more',
  timelineCount: (shown: number, total: number) => `Showing ${shown} of ${total}`,
  /** An open event - checked in, never checked out. Not an error: the day may
   *  simply still be running. */
  timelineOpen: 'Still checked in',
  timelineNoLocation: 'Location unknown',
  timelineNote: 'Note',
  /** The `MatchedBy` values, spelled for a human. `'none'` is rendered as
   *  "Unverified" rather than "None": none is a fact about the signals, but
   *  what the admin is being told is that the check-in did not verify. */
  matchedVerified: 'Verified',
  matchedPartial: 'Partial',
  matchedOverride: 'Override',
  matchedNone: 'Unverified',

  // ── Leave tab ─────────────────────────────────────────────────────────────
  balancesTitle: 'Leave balances',
  balancesType: 'Type',
  balancesAvailable: 'Available',
  balancesAccrued: 'Accrued',
  balancesUsed: 'Used',
  balancesOpening: 'Opening',
  /** Days are rounded to one decimal by the accrual maths, so "1.5 days". */
  balancesDays: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
  balancesLoadFailed: 'Could not load leave balances.',
  balancesEmpty: 'No leave types configured',
  balancesEmptyHint: 'This workspace has not set up any leave types yet, so there is nothing to accrue against.',

  requestsTitle: 'Leave requests',
  requestsDates: 'Dates',
  requestsType: 'Type',
  requestsStatus: 'Status',
  requestsReason: 'Reason',
  requestsLoadFailed: 'Could not load leave requests.',
  requestsEmpty: 'No leave requests',
  requestsEmptyHint: 'Nothing has been submitted by this person.',
  /** A rejection is only half a story without the reason the admin gave. */
  requestsRejectedFor: (reason: string) => `Rejected: ${reason}`,
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Rejected',

  // ── Shared ────────────────────────────────────────────────────────────────
  /** Both tabs need a user id to have anything to say. `person-tabs.ts` already
   *  keeps them mounted-but-empty in that case rather than hiding them, so this
   *  string is what an admin actually reads on an open invitation. */
  pendingTitle: 'Not accepted yet',
  pendingHint: 'This person has not accepted their invitation, so there is nothing recorded against them.',
}
