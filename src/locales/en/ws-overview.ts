/**
 * Copy for the workspace admin shell, the Overview dashboard and the
 * Attendance screen (src/components/ws/*, src/app/ws/[slug]/**).
 *
 * A separate module from `src/locales/en.ts` for the same reason as `./me` and
 * `./documents`: that file is the long-lived product string table and these
 * screens churn together. Import it directly:
 *
 *   import { wsAdmin } from '@/locales/en/ws-overview'
 *
 * The strings that do NOT live here are the sidebar tab labels - the sidebar
 * reads `en.wsNav.screens` as a `Record<Screen, string>`, so a screen's label
 * has to be in that record or the build fails.
 */

export const wsAdmin = {
  /** Sidebar + topbar chrome. */
  shell: {
    navLabel: 'Workspace sections',
    switchWorkspace: 'Switch workspace',
    accountMenu: 'Account menu',
    /** Rendered as a chip beside the role badge, e.g. "growth plan". */
    planChip: (plan: string) => `${plan} plan`,
    menuSettings: 'Settings',
    menuWorkspaces: 'All workspaces',
    menuProfile: 'My profile',
    menuSignOut: 'Sign out',
  },

  /** /ws/:slug - the Overview dashboard. */
  overview: {
    exportReport: 'Export report',
    exporting: 'Exporting…',
    exportFailed: 'Export failed',

    /**
     * The tile counts active workspace members, not `employees` rows - HR
     * records are optional, so "employees" would name the wrong set.
     */
    headcountTitle: 'Total headcount',
    headcountHint: 'Active workspace members',
    inOfficeTitle: 'In office',
    inOfficeHint: 'currently in office',
    remoteTitle: 'Remote',
    remoteHint: 'working remotely',

    officePresenceTitle: 'Office presence',
    officePresenceHint: 'people in office by hour · today',
    officePresenceChartLabel: 'People in office by hour today',

    activeMembersTitle: 'Current active members',
    locationColumn: 'Location',
    membersColumn: 'Members',
    noActivity: 'No activity yet today.',

    viewAll: (count: number) => `View all ${count} ›`,

    planLimitReached: (used: number, max: number, plan: string) =>
      `Member limit reached - ${used}/${max} on the ${plan} plan. Upgrade to add more members.`,
    planLimitNear: (used: number, max: number, plan: string) =>
      `Approaching member limit - ${used}/${max} on the ${plan} plan.`,
    departmentChartLabel: 'Headcount by department',
    /** The bar covering members with no department on file. */
    departmentUnknown: 'No HR details',
    departmentCoverage: (withDept: number, total: number) =>
      `${withDept} of ${total} member(s) have a department on file`,
    departmentEmpty: 'No departments on file yet',
    departmentEmptyHint: 'Departments come from HR details, which are optional.',
    departmentEmptyAction: 'Add HR details ›',

    /**
     * Celebrations read birthdays and joining dates off HR records, so an empty
     * fortnight and "nobody has HR details" look identical. Say which.
     */
    celebrationsEmptyHint: 'Birthdays and work anniversaries come from HR details.',
  },

  /** /ws/:slug/attendance - today's roster and the regularization queue. */
  attendance: {
    pageTitle: 'Attendance',
    pageSubtitle: 'Today',
    showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,

    verifiedWfoTitle: 'Verified WFO',
    onLeaveTitle: 'On leave',
    partialTitle: 'Partial / unverified',
    regularizationsTitle: 'Regularizations',

    colName: 'Name',
    colRole: 'Role',
    colToday: 'Today',
    colTime: 'Time',
    rosterEmptyTitle: 'Nobody on the roster yet',
    rosterEmptyHint: 'Members appear here as soon as they join the workspace.',

    queueTitle: 'Regularization requests',
    queueEmptyTitle: 'No pending regularizations',
    queueEmptyHint: 'Requests raised from a member timeline land here.',

    /** Drill-down slide-over. */
    statusEyebrow: "Today's status",
    signalsEyebrow: 'Signals matched',
    detailsEyebrow: 'Check-in detail',
    signalGps: 'GPS',
    signalWifi: 'Wi-Fi',
    signalIp: 'IP',
    signalMatched: 'matched',
    signalUnmatched: 'not matched',
    checkedInAt: 'Checked in',
    checkedOutAt: 'Checked out',
    stillIn: 'Still checked in',
    locationLabel: 'Location',
    noEventToday: 'No check-in recorded today.',
    trustFlags: 'Trust flags',
    statusOverride: 'Override',
    statusSuspicious: 'Suspicious',
    viewTimeline: 'Open full timeline',
    close: 'Close',

    overrideEyebrow: 'Override to present',
    overrideAction: 'Mark as present',
    overrideNote:
      'This never modifies the original event — it is stored as a separate, additive override.',
    overrideDone: 'Marked as present — override recorded.',
    overrideFailed: 'Could not record the override.',
    overrideUnavailable:
      'An admin override is recorded by approving this person’s regularization request. There is no pending request for them today.',
    alreadyVerified: 'This day is already counted as in-office.',

    declineDone: 'Regularization declined.',
    declineFailed: 'Could not decline the request.',
  },

  /** /ws/:slug/approvals - additions to the existing en.wsApprovals block. */
  approvals: {
    filterDocuments: 'Documents',
    countOf: (shown: number, total: number) => `${shown} of ${total} item(s)`,
    reviewDocument: 'Review ›',
    loadFailed: 'Could not load approvals.',
    actionFailed: 'Could not action that request.',
  },

  /**
   * /ws/:slug/attendance - the bulk office day, beside the regularization queue
   * it generalises. One regularization corrects one person's day; an office day
   * corrects everybody's at once.
   */
  officeDay: {
    cardTitle: 'Bulk office day',
    cardHint:
      'Declare a date an office day and everyone who was working that day — but whose signals did not verify — is counted as in-office. Nobody loses their attendance allowance. People with no check-in that day are left untouched.',

    dateLabel: 'Date',
    noteLabel: 'Note (optional)',
    notePlaceholder: 'e.g. All-hands at the office',
    declareAction: 'Declare office day',
    checking: 'Checking…',

    confirmTitle: 'Mark as in-office',
    confirmBody: (count: number, date: string) =>
      `Mark ${count} ${count === 1 ? 'person' : 'people'} as in-office on ${date}?`,
    confirmDetail: (alreadyOffice: number, skipped: number) =>
      `${alreadyOffice} already counted as in-office · ${skipped} with no check-in stay unchanged.`,
    confirmNobody: (date: string) =>
      `Nobody on ${date} needs converting. Everyone with a check-in is already counted as in-office.`,
    confirmNote:
      'This never modifies the original events — it is stored as separate, additive overrides, and can be undone.',
    confirmCancel: 'Cancel',
    confirmAction: 'Mark as in-office',

    declaredTitle: 'Declared office days',
    declaredEmptyTitle: 'No office days declared',
    declaredEmptyHint: 'Declaring one converts that day’s remote check-ins to in-office.',
    declaredCount: (people: number) =>
      `${people} ${people === 1 ? 'person' : 'people'} counted as in-office`,
    colDate: 'Date',
    colPeople: 'Converted',
    colNote: 'Note',
    undo: 'Undo',
    undoing: 'Undoing…',

    doneToast: (count: number) =>
      count === 1 ? '1 person marked as in-office.' : `${count} people marked as in-office.`,
    nothingToast: 'Nothing to convert — that day was already counted as in-office.',
    failedToast: 'Could not declare that office day.',
    undoneToast: 'Office day undone.',
    undoFailedToast: 'Could not undo that office day.',
    loadFailed: 'Could not load declared office days.',

    /** Server-side refusals. The codes match the single-day regularization path. */
    errBadBody: 'Invalid JSON body',
    errDateFormat: 'date must be in YYYY-MM-DD format',
    errFutureDate: 'Cannot declare a future date an office day.',
    errOutsideHistory: 'This date is outside your plan’s history window.',
    errWeekOff:
      'That date is not a working day, so an office day on it would count for nothing.',
    errHoliday: (date: string, name: string) =>
      `${date} is a company holiday (${name}), so an office day on it would count for nothing.`,

    /** Written into admin_overrides.note. */
    notePrefix: 'Office day: ',
    noteDefault: 'Office day',
  },
} as const
