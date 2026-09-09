/**
 * Copy for the pending-approvals queue.
 *
 * One set of strings, three surfaces: the Overview widget, the Approvals page
 * at /ws/:slug/approvals, and the regularization rows on the Attendance screen.
 * They share `ApprovalRow`, so they must share its labels - an "Approve" that
 * reads differently in two places is two components, not one.
 *
 * MOVED out of `src/locales/en.ts`, where it was one of the original inline
 * groups. `en.wsApprovals.x` still resolves to this object; `en.ts` spreads it
 * on, so no call site changed.
 *
 *   import { wsApprovals } from '@/locales/en/ws-approvals'
 *
 * NOT the same key as `wsAdmin.approvals` in ./ws-overview.ts, which holds the
 * later additions (document filter, counts). Keep the two disjoint.
 */

export const wsApprovals = {
  pageTitle: 'Pending Approvals',
  pageSubtitle:
    'Leave, extension and attendance correction requests waiting on your review.',
  filterAll: 'All',
  filterLeave: 'Leave',
  filterRegularization: 'Regularization',
  /** Unpaid parental-leave extensions. Filed by the member, actioned here. */
  filterExtension: 'Extensions',
  searchPlaceholder: 'Search by employee name',
  declineReasonPlaceholder: 'Reason for declining…',
  cancel: 'Cancel',
  confirmDecline: 'Confirm decline',
  decline: 'Decline',
  approve: 'Approve',
  emptyTitle: 'Inbox zero 🎉',
  emptyBody: 'Every request has been actioned.',
  markWfo: 'Mark WFO',
  markWfh: 'Mark WFH',

  /** Errors the extension branch of the PATCH route can return. */
  extensionNotFound: 'Leave extension request not found',
  extensionAlreadyActioned: 'This extension request has already been actioned',
  /**
   * The case's end date moved past the request while it sat in the queue, so
   * approving would take days off rather than add them.
   */
  extensionNotAnExtension:
    'The case already runs to or beyond the requested date — decline this request instead.',
  extensionCaseMissing: 'The leave case this request belongs to no longer exists',
} as const
