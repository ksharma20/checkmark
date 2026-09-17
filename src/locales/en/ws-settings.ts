/**
 * Copy for the `/ws` admin screens re-skinned onto the app design system:
 * Reports, Settings (tabs incl. Leave policies, Balances and Ownership),
 * Holidays, Roles, Monthly activity, the Insights member table and the
 * workspace picker.
 *
 * Kept in its own module rather than folded into `src/locales/en.ts` so these
 * screens can be edited without touching the shared file. Strings that already
 * existed before the re-skin stay in `en.wsSettings` / `en.wsRoles` and are
 * imported from there - this file holds only what the new layout added.
 *
 *   import { wsAdmin } from '@/locales/en/ws-settings'
 */
import type { NotificationCategory } from '@/lib/notifications/categories'

export const wsAdmin = {
  // ── /ws/[slug]/reports ─────────────────────────────────────────────────────
  reports: {
    pageTitle: 'Reports',

    exportIntro: 'Generate and export HR reports as a spreadsheet.',

    attendanceTitle: 'Attendance summary',
    attendanceBody: 'Daily presence per employee for one month, with WFO / WFH / leave colouring and a legend sheet.',
    leaveTitle: 'Leave balance',
    leaveBody: 'Opening balance, days taken and the remainder, per employee and leave type.',
    headcountTitle: 'Headcount & attrition',
    headcountBody: 'Every member with the role they hold, their status and their join date.',
    expenseTitle: 'Expense & claims',
    expenseBody: 'Travel and reimbursement claims by status.',
    comingSoon: 'Coming soon',

    generateBtn: 'Generate',
    generatingBtn: 'Generating…',
    monthLabel: 'Month',
    monthFieldId: 'report-month',

    trendTitle: 'WFO trend · last 14 days',
    trendHint: 'Distinct people present per working day. Non-working days are not plotted.',
    trendAria: 'People present per working day over the last 14 days',
    trendEmpty: 'No presence recorded in the last 14 days.',
    trendUnavailable: 'The trend needs analytics access, which this role does not hold.',
    trendTitleFor: (label: string, value: number) =>
      `${label}: ${value} ${value === 1 ? 'person' : 'people'}`,

    // Plan / permission responses from GET /api/ws/[slug]/export. Every plan is
    // unlimited by default (src/lib/plans.ts), so the two plan codes only fire
    // on an instance whose operator has reintroduced caps.
    planGate: 'Spreadsheet export is not enabled for this workspace.',
    planHistoryGate: 'That month is outside this workspace’s history window. Pick a more recent month.',
    exportForbidden: 'You do not have permission to export this workspace.',
    exportFailed: 'The report could not be generated. Please try again.',
    exportDone: 'Report downloaded.',
    viewPricing: 'View pricing',
  },

  // ── /ws/[slug]/settings ────────────────────────────────────────────────────
  settings: {
    tabOrg: 'Org details',
    tabLeave: 'Leave policies',
    tabBalances: 'Balances',
    tabNotifications: 'Notifications',
    tabSignals: 'Signals',
    tabDomains: 'Domains',
    tabOwnership: 'Ownership',

    orgSectionTitle: 'Organisation details',
    leaveReadOnlyNote: 'Your role can view this configuration but not change it.',

    // Shown instead of the org form when GET /api/ws/[slug] fails. The form is
    // withheld on purpose: its initial state is a set of defaults, and saving
    // those would overwrite the workspace's real timezone and working days with
    // values nobody chose. The reminder times it also used to guard are no
    // longer edited anywhere on /ws - they are each member's own now.
    orgLoadFailedTitle: 'Settings could not be loaded',
    orgLoadFailedBody:
      'Nothing has been changed. This form stays hidden until the saved configuration is on screen — editing it now would overwrite your timezone and working days with defaults.',
    orgLoadFailedRetry: 'Try again',
    signalsAndTitle: 'Verification uses AND logic — every configured signal must match for a check-in to count as verified.',

    fieldIds: {
      name: 'ws-name',
      timezone: 'ws-timezone',
    },

    // ── Settings › Notifications ─────────────────────────────────────────────
    notifPageTitle: 'What this workspace sends',
    /**
     * This screen is now one half of a split, and the hint's main job is to
     * name the OTHER half. An admin who remembers four switches and a pair of
     * reminder times needs to be told those moved rather than broke, and told
     * exactly where - otherwise the first assumption is that reminders were
     * removed from the product, and the second is to file a bug.
     *
     * "Cannot be switched off from here" is stated rather than implied. An
     * admin who believes they still hold the reminder schedule will promise a
     * member they can stop a nudge, and then cannot.
     */
    notifPageHint:
      'This screen covers what the ORGANISATION sends. Switching one off stops it for everybody here — the in-app notification and the push both, so nothing is recorded either, and members cannot mute what is left on. A member’s own check-in reminders and check-in session nudges are not here at all: each person sets those in their own notification settings, and they cannot be switched on or off from this screen.',

    // The same tri-state withholding as the org form, and for the same reason:
    // the switchboard's initial state is "everything on", so saving it after a
    // failed load would silently re-enable categories the workspace turned off.
    notifLoadFailedTitle: 'Notification settings could not be loaded',
    notifLoadFailedBody:
      'Nothing has been changed. The switches stay hidden until the saved configuration is on screen — saving now would turn every category back on.',
    notifLoadFailedRetry: 'Try again',

    /**
     * One entry per category in `CATEGORY_DEFS`. `satisfies Record<...>` makes a
     * category added to that catalogue without copy here a compile error, which
     * is the point: an unlabelled switch is worse than no switch.
     *
     * Two entries left, and that is now the whole catalogue this screen is
     * responsible for. `reminders` and `presence` were here as unrendered copy
     * for switches the workspace no longer owns; they are gone rather than kept
     * disabled, because a string nothing renders is a string nobody updates, and
     * both of those had already drifted into describing a vote no admin can cast.
     * The member's half of the split has its own copy under
     * `meSettings.settings.notifications`, written for the person being nudged.
     */
    notifCategories: {
      /**
       * One switch over both halves of an approval - the request reaching an
       * approver and the answer reaching whoever filed it. These were two
       * categories and two near-identical rows.
       *
       * The hint has to carry BOTH consequences, because one switch now has two
       * audiences and an admin will almost certainly only be thinking about the
       * first. Switching it off silences the inbox side AND the outcome side at
       * once: approvers stop being told a request is waiting, and every employee
       * stops being told what was decided about a request they filed. The second
       * is the severe one and is spelled out rather than summarised - it is not
       * "fewer pushes", it is no notification and no in-app record at all, so
       * somebody whose leave was rejected finds out only by going to look.
       */
      approvals: {
        label: 'Approvals',
        hint: 'Covers both halves of an approval, and switching it off silences both audiences at once. Approvers stop being told that a leave request, regularization or document is waiting for them — they must watch the queue themselves. And every employee stops being told the outcome of their own request: no notification, no in-app record, so someone whose leave was approved or rejected only finds out by going to look. Members can never mute this one.',
      },
      announcements: {
        label: 'Announcements',
        /**
         * Off means silent, NOT unposted. The `workspace_announcements` row is
         * written before the fan-out, so the notice still reaches the member
         * archive at /me/announcements with its attachments - it just arrives
         * without a bell or a push. Saying so here is the only way an admin
         * learns it before relying on it.
         */
        hint: 'Workspace-wide notices posted from this Settings screen. Switched off, a notice is still posted and still readable in each member’s announcements list — it just arrives silently, with no notification and no push. Members can never mute this one.',
      },
    } as const satisfies Record<NotificationCategory, { label: string; hint: string }>,

    /**
     * Keyed on `CategoryDef.lockedReason`, so the refusal is stated, not implied.
     *
     * **No longer read by this screen.** The switchboard used to render a
     * locked category as a disabled row captioned from here; it now filters
     * those rows out entirely, so there is no lock left to caption and
     * `lockedReasonFor()` has gone with it. Kept against the flag being
     * flipped back, and because a lock reintroduced with no reason beside it is
     * worse than no lock.
     *
     * `satisfies Record<string, string>` cannot check these keys against the
     * catalogue the way `notifCategories` is checked against
     * `NotificationCategory` — the index type is `string`. So a renamed
     * `lockedReason` goes stale here silently and typechecks: `always_on_outcome`
     * survived the approvals merge by exactly that route and had to be caught by
     * grep. If you rename one in `CATEGORY_DEFS`, rename it in both locale
     * modules by hand.
     */
    notifLockedReasons: {
      always_on_approvals:
        'Always on for members. Someone who filed a request is entitled to be told what happened to it, and an approver needs to know one is waiting.',
      always_on_announcement:
        'Always on. An announcement is the one notice that cannot afford to be missed — a closure, an office day, a policy change.',
    } as const satisfies Record<string, string>,

    // Only malformed shapes reach this: the route DROPS keys it does not
    // recognise rather than refusing them, so the message must not promise a
    // rejection for an unknown category - it would be describing behaviour the
    // route no longer has, on the one screen an admin reads it from.
    notifInvalidCategories:
      'notificationCategoriesOff must be an array of notification category keys',

    // ── Workspace logo ───────────────────────────────────────────────────────
    logoTitle: 'Workspace logo',
    logoHint:
      'Shown in the top bar for everyone in this workspace. Without one, the coloured initial is used.',
    logoCurrentAlt: 'Current workspace logo',
    logoUpload: 'Upload a logo',
    logoReplace: 'Replace logo',
    logoUploading: 'Uploading…',
    logoRemove: 'Remove logo',
    logoRemoving: 'Removing…',
    logoSaved: 'Logo updated',
    logoRemoved: 'Logo removed',
    /**
     * The constraints, said before the upload rather than after it fails. PNG
     * and JPEG only - SVG is markup and is refused deliberately, not by
     * oversight.
     */
    logoConstraints: 'PNG or JPEG, up to 512 KB.',
    logoNoFile: 'Choose an image to upload.',
    logoTooLarge: 'That image is over 512 KB. Please use a smaller one.',
    logoBadType: 'That file is not a PNG or JPEG image.',
    logoFailed: 'Could not update the logo. Please try again.',
  },

  // ── /ws/[slug]/holidays ────────────────────────────────────────────────────
  holidays: {
    pageTitle: 'Holiday calendar',
    pageSubtitle: (year: number) => `Public holidays observed by this workspace in ${year}.`,
    prevYear: 'Previous year',
    nextYear: 'Next year',

    addBtn: 'Add holiday',
    importBtn: 'Import',
    importingBtn: 'Importing…',
    importTitle: 'Import holidays',
    importDropLabel: 'Choose or drop a .csv / .xlsx file',
    importHint: 'Columns: name, date (YYYY-MM-DD) and an optional description. Maximum file size 2 MB.',
    importClose: 'Close',
    importResult: (inserted: number, updated: number, skipped: number) =>
      skipped > 0
        ? `${inserted} added, ${updated} updated, ${skipped} skipped`
        : `${inserted} added, ${updated} updated`,
    importFailed: 'Import failed',
    importRowError: (row: number, reason: string) => `Row ${row}: ${reason}`,
    dismiss: 'Dismiss',

    colName: 'Name',
    colDate: 'Date',
    colDescription: 'Description',
    colActions: 'Actions',
    selectAll: 'Select every holiday',
    selectOne: (name: string) => `Select ${name}`,
    edit: 'Edit',
    delete: 'Delete',

    formAddTitle: 'Add a holiday',
    formEditTitle: 'Edit holiday',
    fieldName: 'Name',
    fieldNamePlaceholder: 'e.g. Republic Day',
    fieldDate: 'Date',
    fieldDescription: 'Description',
    fieldDescriptionPlaceholder: 'Optional',
    saveBtn: 'Save',
    addSubmitBtn: 'Add',
    cancelBtn: 'Cancel',
    requiredError: 'A name and a date are required.',
    duplicateError: 'A holiday with this name and date already exists.',
    genericError: 'Something went wrong. Please try again.',

    emptyTitle: (year: number) => `No holidays in ${year}`,
    emptyHint: 'Add them one at a time, or import a sheet.',

    selectedCount: (n: number) => `${n} selected`,
    deselectAll: 'Deselect all',
    bulkDeleteBtn: (n: number) => `Delete ${n}`,
    bulkDeleteFailed: (n: number) => `${n} holiday${n === 1 ? '' : 's'} could not be deleted`,

    deleteTitle: 'Delete holiday',
    deleteBody: (name: string) => `Delete “${name}”? This cannot be undone.`,
    bulkDeleteTitle: (n: number) => `Delete ${n} holiday${n === 1 ? '' : 's'}`,
    bulkDeleteBody: (n: number) => `Delete the ${n} selected holiday${n === 1 ? '' : 's'}? This cannot be undone.`,
    deleteConfirm: 'Delete',
    deletingConfirm: 'Deleting…',

    footerCount: (n: number, year: number) => `${n} holiday${n === 1 ? '' : 's'} in ${year}`,
  },

  // ── /ws/[slug]/roles - additions to en.wsRoles ─────────────────────────────
  roles: {
    memberCountAria: (n: number) => `${n} member${n === 1 ? '' : 's'}`,
    systemBadge: 'Built-in',
    detailHeading: 'Permissions',
    detailHint: 'Read is ticked automatically whenever Write or Delete is on. Cells you cannot grant are the ones your own role does not hold.',
    selectPrompt: 'Select a role to see what it can do.',
    rowAllLabel: 'All',
  },

  // ── /ws/[slug]/monthly (the “Activity” nav screen) ─────────────────────────
  monthly: {
    pageTitle: 'Monthly activity',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    todayBtn: 'Today',
    exportBtn: 'Export report',
    exportingBtn: 'Exporting…',
    workingDays: (n: number) => `${n} working days`,

    legendOffice: 'Office',
    legendPresent: 'Present',
    legendRemote: 'Remote',
    legendAbsent: 'Absent',
    legendLeave: 'On leave',
    legendHoliday: 'Holiday',
    legendWeekend: 'Weekend',

    noSignalsBanner: 'No location signals configured — every check-in counts as present. Add a GPS or IP signal in Settings to tell office from remote.',
    planGatedTitle: 'That month is outside this workspace’s history window',
    planGatedHint: 'Pick a more recent month.',
    emptyTitle: 'No active members to show',
    emptyHint: 'Members appear here once they join and start checking in.',

    cellPreJoin: (date: string) => `${date}: not yet a member`,
    cellStatus: (date: string, status: string) => `${date}: ${status}`,
  },

  // ── The per-member range table under /ws/[slug]/insights ───────────────────
  analytics: {
    heading: 'By member',
    subheading: (start: string, end: string, days: number) =>
      `${start} – ${end} · ${days} working days`,
    rangeStart: 'From',
    rangeEnd: 'To',
    thisMonthBtn: 'This month',

    statMembers: 'Members',
    statMembersHint: 'in this workspace',
    statOfficeDays: 'Office days',
    statCheckins: 'Check-ins',
    statAcrossTeam: 'total across the team',
    statHours: 'Hours tracked',
    statHoursHint: 'total logged',
    statAvgDays: 'Avg days',
    statAvgDaysHint: 'attended per person',

    colMember: 'Member',
    colJoined: 'Joined',
    colOffice: 'Office',
    colRemote: 'Remote',
    colPresent: 'Present',
    colAbsent: 'Absent',
    colTotalHours: 'Total hrs',
    colAvgPerDay: 'Avg/day',

    noSignalsBanner: 'No location signals configured — every check-in is shown. Add a GPS or IP signal in Settings to tell office from remote.',
    emptyTitle: 'No presence data for this period',
    emptyHint: 'Members appear here as they check in.',
    multiLocation: (n: number) => `${n} multi-location days`,
    multiLocationNote: 'Multi-location: days where checkout was recorded more than 1 km from check-in (field force / site visits).',
    forbidden: 'You do not have permission to see per-member analytics.',
  },

  // ── /ws picker and /ws/new ─────────────────────────────────────────────────
  picker: {
    titleWithWorkspaces: 'Your workspaces',
    titleEmpty: 'No workspaces yet',
    subtitleWithWorkspaces: 'Pick a workspace, or create another one.',
    subtitleEmpty: 'Create a workspace to start tracking your team’s presence.',

    sectionActive: 'Active',
    sectionArchived: 'Archived',
    archivedBadge: 'Archived',
    newBtn: 'New workspace',

    createTitle: 'Create a workspace',
    createSubtitle: 'Organisation features are separate from your personal /me dashboard.',
    fieldOrgName: 'Organisation name',
    fieldOrgNamePlaceholder: 'Acme Corp',
    fieldOrgNameId: 'ws-org-name',
    fieldSlug: 'Workspace URL handle',
    fieldSlugPlaceholder: 'acme-corp',
    fieldSlugId: 'ws-slug',
    slugAvailable: 'Available',
    slugTaken: 'Already taken',
    slugInvalid: 'Lowercase letters, numbers and hyphens only',
    slugChecking: 'Checking…',
    slugPreview: (slug: string) => `/ws/${slug}`,
    createBtn: 'Create workspace',
    creatingBtn: 'Creating…',
    createFailed: 'The workspace could not be created.',
    cancelBtn: 'Cancel',
    backToMe: 'Back to personal dashboard',
  },
} as const
