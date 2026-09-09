/**
 * Copy for parental leave - the maternity and paternity cases at
 * /ws/:slug/leaves, and the unpaid-extension request the member files against
 * one of them from /me/leave.
 *
 * MOVED out of `wsLeaveScreen` in ./ws-people.ts, along with the tab label that
 * opens it. It was sharing a const with the ordinary leave-request queue, which
 * put two unrelated screens in one place; a case with stages and a
 * balance-consuming request have nothing to say to each other.
 *
 *   import { wsParental } from '@/locales/en/ws-parental'
 *
 * `en.wsParental.x` resolves to the same object; `src/locales/en.ts` spreads it
 * on. The `stage*` keys are keyed by `MaternityStatus`, so a stage added to that
 * union needs a label here.
 *
 * ONE SET OF STRINGS FOR BOTH CASE TYPES. The maternity and paternity tabs are
 * one component (`ParentalCasesTab`), so anything that names the entitlement is
 * a function of `ParentalCaseType` rather than a `maternityX` / `paternityX`
 * pair. Two parallel key families is how the two tabs drift apart in wording
 * while claiming to be one screen. The `maternity*` keys that carry no
 * type-specific wording kept their names so no call site had to churn.
 *
 * `parentalExtension` and `parentalExtensionNotifications` below are the
 * member-facing halves. They live here rather than in a `/me` module because
 * they are the same feature seen from the other side, and splitting a feature's
 * copy across two modules is how the promise and the screen drift apart. They
 * are exported directly rather than spread onto `en` - `src/locales/en.ts` is a
 * shared-write file and this needed no line in it.
 */

import type { ParentalCaseType } from '@/lib/db/queries/maternity'

/** "maternity" / "paternity", for mid-sentence use. */
const NOUN: Record<ParentalCaseType, string> = {
  maternity: 'maternity',
  paternity: 'paternity',
}

/** "Maternity" / "Paternity", for the start of a sentence or a label. */
const TITLE: Record<ParentalCaseType, string> = {
  maternity: 'Maternity',
  paternity: 'Paternity',
}

export const wsParental = {
  tabMaternity: 'Maternity',
  tabPaternity: 'Paternity',

  /** The one line under the tab heading. The entitlement differs, so the law cited does too. */
  intro: (type: ParentalCaseType) =>
    type === 'maternity'
      ? '26-week paid entitlement (Maternity Benefit Act). Track each case from request through return to work.'
      : 'Short paid entitlement, 2 weeks by default. Track each case from request through return to work.',
  caseTypeLabel: (type: ParentalCaseType) => TITLE[type],
  start: (type: ParentalCaseType) => `Start ${NOUN[type]} leave`,
  formTitle: (type: ParentalCaseType) => `New ${NOUN[type]} leave`,
  formHint: (type: ParentalCaseType) =>
    type === 'maternity'
      ? 'Leave starts ~4 weeks before the due date; expected return is calculated from the entitlement.'
      : 'Leave starts on the due date; expected return is calculated from the entitlement. Paternity leave is short — the default is 2 weeks.',
  created: (type: ParentalCaseType) => `${TITLE[type]} leave case created`,
  emptyTitle: (type: ParentalCaseType) => `No ${NOUN[type]} leave cases`,
  emptyHint: (type: ParentalCaseType) => `Start one when someone files for ${NOUN[type]} leave.`,
  loadFailed: (type: ParentalCaseType) => `Could not load ${NOUN[type]} cases.`,
  /** The due date means different things: expected birth, and the date leave is taken from. */
  dueLabel: (type: ParentalCaseType) =>
    type === 'maternity' ? 'Expected due date' : 'Date of birth / due date',

  maternityEmployee: 'Employee',
  maternityEmployeePlaceholder: 'Select employee',
  maternityWeeks: 'Weeks',
  maternityAdd: 'Add',
  maternityCancel: 'Cancel',
  maternityEmployeeRequired: 'Select an employee and a due date.',
  maternityCreateFailed: 'Could not create the case.',

  maternityStatRequested: 'Awaiting approval',
  maternityStatApproved: 'Approved · upcoming',
  maternityStatOnLeave: 'Currently on leave',
  maternityStatReturned: 'Returned',

  maternityDueDate: 'Due date',
  maternityLeaveStart: 'Leave start',
  maternityExpectedReturn: 'Expected return',
  maternityEntitlement: 'Entitlement',
  maternityWeeksValue: (weeks: number) => `${weeks} weeks`,

  stageRequested: 'Requested',
  stageApproved: 'Approved',
  stageOnLeave: 'On leave',
  stageReturned: 'Returned',

  maternityApprove: 'Approve leave',
  maternityRevoke: 'Revoke approval',
  maternityMarkOnLeave: 'Mark on leave',
  maternityMarkReturned: 'Mark returned',
  maternityReturnedOn: (date: string) => `Returned ${date}`,
  maternityUpdated: 'Case updated',
  maternityUpdateFailed: 'Could not move the case.',

  // ── Edit ────────────────────────────────────────────────────────────────
  edit: 'Edit',
  editTitle: 'Edit case',
  editSave: 'Save changes',
  editSaving: 'Saving…',
  editNotes: 'Notes',
  editNotesPlaceholder: 'Anything an approver should know',
  editSaved: 'Case updated',
  editFailed: 'Could not save the case.',

  // ── Delete ──────────────────────────────────────────────────────────────
  delete: 'Delete',
  deleteTitle: 'Delete case',
  deleteBody: (name: string) => `Delete the leave case for ${name}?`,
  /** Soft delete, and the reminder gate stops seeing it - both worth stating. */
  deleteNote:
    'The case is archived, not erased. Check-in reminders will start again for the dates it covered.',
  deleteConfirm: 'Delete case',
  deleteBusy: 'Deleting…',
  deleteCancel: 'Cancel',
  deleted: 'Case deleted',
  deleteFailed: 'Could not delete the case.',

  // ── Extensions, admin side ──────────────────────────────────────────────
  extensionLabel: (type: ParentalCaseType) => `Unpaid extension · ${TITLE[type]}`,
  extensionDetail: (days: number, until: string) =>
    `${days} unpaid working ${days === 1 ? 'day' : 'days'} · until ${until}`,
} as const

/**
 * The member-facing extension request on `/me/leave`.
 *
 * Only rendered when the member has an OPEN parental case, because that is the
 * only thing an extension can be filed against.
 */
export const parentalExtension = {
  tab: 'Extend leave',
  heading: 'Extend your parental leave',
  intro:
    'Ask for more time at the end of your current leave. These days are UNPAID — they do not come out of any leave balance.',
  caseLabel: 'Leave case',
  casePlaceholder: 'Select a case',
  caseOption: (type: ParentalCaseType, end: string) => `${TITLE[type]} leave · ends ${end}`,
  fieldNewEnd: 'New return date',
  fieldReason: 'Reason',
  fieldReasonPlaceholder: 'Why you need the extra time',
  currentEnd: (date: string) => `Currently ends ${date}`,
  /** Shown live, before submit, so the cost is never a surprise after the fact. */
  unpaidCount: (days: number) =>
    `${days} unpaid working ${days === 1 ? 'day' : 'days'} — weekends and company holidays are not counted.`,
  unpaidCounting: 'Counting unpaid days…',
  submit: 'Request extension',
  submitting: 'Sending…',
  submitted: 'Extension request sent for approval',
  submitErrorGeneric: 'Could not send the request. Please try again.',
  noCaseTitle: 'No parental leave in progress',
  noCaseHint: 'An extension can only be requested against an open maternity or paternity case.',
  historyHeading: 'Extension requests',
  historyRow: (days: number, until: string) =>
    `${days} unpaid ${days === 1 ? 'day' : 'days'} · until ${until}`,
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Rejected',

  /** Server-side refusals, one per rule, rendered verbatim by the form. */
  errors: {
    rateLimited: 'Too many extension requests. Try again later.',
    missingFields: 'Pick a case and a new return date.',
    badDate: 'The new return date is not a valid date.',
    caseNotFound: 'No open leave case with that id.',
    noEndDate: 'This case has no end date to extend from. Ask an admin to set one.',
    notAnExtension: 'The new return date must be after your current one.',
    duplicate: 'You already have an extension request awaiting a decision.',
    noWorkingDays: 'Those dates are all weekends or company holidays — there is nothing to extend.',
  },
} as const

/**
 * Push and feed copy for the three `extension_*` notification types.
 *
 * Kept beside the feature rather than in the inline `en.notifications` group,
 * which is the original single-file copy and closed to additions (invariant 16).
 */
export const parentalExtensionNotifications = {
  submittedTitle: 'New leave extension request',
  submittedBody: (name: string, days: number) =>
    `${name} asked to extend their parental leave by ${days} unpaid ${days === 1 ? 'day' : 'days'}.`,
  approvedTitle: 'Leave extension approved',
  approvedBody: (until: string) => `Your parental leave now runs until ${until}.`,
  rejectedTitle: 'Leave extension declined',
  rejectedBody: (reason: string) => `Your leave extension request was declined: ${reason}`,
} as const
