// Single source of truth for all brand strings, user-facing copy, and
// technical identifiers. To rename the product: change `brand` below.

const brand = 'CheckMark'

export const en = {
  brand: {
    name: brand,
    shortName: brand,
    tagline: "Presence Intelligence Platform",
    taglineLong: "Know where your team is. Own where you've been.",
    domain: "checkmark.kabirinnovations.com",
    email: "noreply@kabirinnovations.com",
    description: `Presence Intelligence Platform - know where your team is, own where you've been.`,
  },

  landing: {
    heroHeadline: "Presence intelligence\nfor modern teams",
    heroSubtitle: `Know who's in the office. Plan your week with purpose. ${brand} makes hybrid work actually work - without surveillance.`,
    footerText: "Built for humans who work in offices sometimes.",
    features: [
      {
        title: "Know who's in today",
        body: "Your Today dashboard shows which team members are in the office right now, who visited earlier, and who stayed remote - updated by the second.",
      },
      {
        title: "Privacy by design",
        body: "Employees choose to participate. Every data point belongs to the person who created it. Consent can be withdrawn at any time with one click.",
      },
      {
        title: "Verified domains, zero friction",
        body: "Add your company domain and anyone who signs up with a matching email is auto-enrolled - no invite required.",
      },
      {
        title: "Multiple signals",
        body: "Wi-Fi network detection, GPS check-in, IP geofencing, and manual override. Whichever fits your team's setup.",
      },
    ],
  },

  auth: {
    welcomeHeading: `Welcome to ${brand}`,
    accountTypeHeading: `How will you use ${brand}?`,
    sessionLogoutText: `Sign out of your ${brand} account on this device.`,
  },

  consent: {
    // Used on the /consent/[token] page
    brandLogo: brand,
    declineBody: `You won't appear in that workspace's presence dashboard. You can always sign in to ${brand} to manage your own presence.`,
  },

  join: {
    // Used on the /join/[slug] page
    brandLogo: brand,
  },

  workspace: {
    // Used on /ws and /ws/:slug pages
    brandLogo: brand,
  },

  /** Member workspace Today accordion (/me/ws/[slug]) */
  meWsToday: {
    tabPeopleInOffice: "People in Office Today",
    tabPeopleRemote: "People working Remotely Today",
    tabPeopleNotCheckedIn: "People not Checked in Today",
    tabHolidayCalendar: "Holiday Calendar",
    badgeRemote: "Remote",
    errorFailedToLoad: "Failed to load",
    errorWorkspaceNotFound: "Workspace not found",
    emptyNoHolidaysConfigured: (year: number) =>
      `No holidays configured for ${year}`,
    badgeToday: "Today",
    emptyNoOneHereYet: "No one here yet",
    leaveWorkspaceButtonAria: "Leave this workspace",
    leaveWorkspaceTitle: "Leave workspace?",
    leaveWorkspaceMessage: (workspaceName: string) =>
      `Leave ${workspaceName}? You will no longer appear in their presence dashboard.`,
    leaveWorkspaceConfirm: "Leave",
    leaveWorkspaceCancel: "Cancel",
    leaveWorkspaceLoading: "Leaving…",
    leaveWorkspaceError: "Could not leave workspace. Try again.",
    leaveWorkspaceSoleAdmin:
      "You are the only workspace admin. Transfer ownership before leaving.",
    tabMyLeaves: "My Applied Leaves",
    tabPeopleOnLeave: "People on Leave Today",
    onLeaveBadgeLabel: "On Leave",
    onLeaveEmpty: "No one is on leave today",
    applyLeaveButtonAria: "Apply for leave",
    applyLeaveTitle: "Apply for Leave",
    applyLeaveFieldLeaveType: "Leave Type",
    applyLeaveFieldStartDate: "Start Date",
    applyLeaveFieldEndDate: "End Date",
    applyLeaveFieldReason: "Reason",
    applyLeaveFieldReasonPlaceholder: "Optional reason…",
    applyLeaveNoTypes: "No leave types configured. Ask your workspace admin.",
    applyLeaveSubmit: "Submit Leave",
    applyLeaveSubmitting: "Submitting…",
    applyLeaveSuccess: "Leave request submitted — pending HR approval.",
    applyLeaveCancel: "Cancel",
    applyLeaveErrorGeneric: "Could not submit leave. Try again.",
    applyLeaveErrorOverlap: "You already have a leave request covering these dates.",
    applyLeaveErrorHoliday: (names: string) =>
      `Leave cannot be applied on company holidays: ${names}.`,
    myLeavesEmpty: "No leave requests yet.",
    myLeavesActive: "Active",
    myLeavesUpcoming: "Upcoming",
    myLeavesPast: "Past",
    applyLeaveButtonText: "Apply Leave",
    applyLeaveSelectPlaceholder: "Select leave type…",
    applyLeaveTypeOption: (name: string, days: number) => {
      const formatted = Number.isInteger(days) ? days.toString() : days.toFixed(1)
      return `${name} — ${formatted} day${days !== 1 ? 's' : ''} left`
    },
    leaveDaysLabel: (days: number) => `${days} day${days !== 1 ? 's' : ''}`,
    leaveStatusPending: "Submitted",
    leaveStatusApproved: "Approved",
    leaveStatusRejected: "Rejected",
    leaveRejectedPrefix: "Rejected:",
  },

  /** Workspace admin leave requests (/ws/[slug]/leaves) */
  wsLeaves: {
    title: "Leave Requests",
    filterPending: "Pending",
    filterActive: "Active",
    filterAll: "All",
    filterUpcoming: "Upcoming",
    filterPast: "Past",
    statusPending: "Submitted",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    approveBtn: "Approve",
    rejectBtn: "Reject",
    approveConfirm: "Approve this leave request?",
    rejectReasonLabel: "Rejection reason",
    rejectReasonPlaceholder: "Why is this request being rejected?",
    confirmRejectBtn: "Confirm Rejection",
    cancelBtn: "Cancel",
    approving: "Approving…",
    rejecting: "Rejecting…",
    searchPlaceholder: "Search by name or email…",
  },

  /** Workspace admin opening balances (migration from another system) */
  wsOpeningBalances: {
    sectionTitle: "Opening Balances",
    sectionDescription: "Set the leave balances employees carried over from a previous system (e.g. Zoho). CheckMark will add these to accrual from the cutover date forward.",
    cutoverDateLabel: "Cutover date",
    cutoverDateHint: "CheckMark starts computing accrual from this date. Set this to the first day of the period (month, quarter, etc.) after your last Zoho export.",
    cutoverDateSave: "Save date",
    cutoverDateSaved: "Cutover date saved",
    cutoverDateCleared: "Cutover date cleared",
    importBtn: "Import from CSV",
    importHint: "CSV columns: email, leave_type, opening_balance",
    importSuccess: (n: number) => `${n} balance${n !== 1 ? 's' : ''} imported`,
    importErrors: (n: number) => `${n} row${n !== 1 ? 's' : ''} skipped — see details below`,
    colEmployee: "Employee",
    colLeaveType: "Leave Type",
    colBalance: "Opening Balance (days)",
    colNote: "Note",
    emptyNoBalances: "No opening balances set yet. Import a CSV or add one below.",
    addBtn: "Add balance",
    addPlaceholderNote: "Optional note",
    saveRow: "Save",
    savingRow: "Saving…",
    rowSaved: "Saved",
    deleteConfirm: "Remove this opening balance?",
    errorFetch: "Failed to load opening balances",
  },

  /** Workspace admin leave types settings (/ws/[slug]/settings) */
  wsLeaveTypes: {
    sectionTitle: "Leave Types",
    sectionDescription: "Define leave types and how credits are accrued for team members. Credits accrue from each member's join date.",
    addType: "Add type",
    labelName: "Type name",
    labelFrequency: "Accrual",
    labelCredits: "Credits",
    labelCreditTiming: "Apply",
    optionTimingStart: "Start of period",
    optionTimingEnd: "End of period",
    optionMonthly: "Monthly",
    optionQuarterly: "Quarterly",
    optionHalfYearly: "Half Yearly",
    optionYearly: "Yearly",
    placeholderName: "e.g. Sick Leave",
    emptyNoTypes: "No leave types yet. Add one below.",
    deleteConfirm: "Remove this leave type? Existing leave requests are not affected.",
  },

  /** Workspace admin settings page (/ws/[slug]/settings) */
  wsSettings: {
    pageTitle: "Settings",
    // Workspace details
    workspaceDetailsTitle: "Workspace details",
    workspaceNameLabel: "Workspace name",
    workspaceNamePlaceholder: "My Organisation",
    timezoneLabel: "Timezone",
    timezoneHint: "The Today dashboard uses this timezone to determine the current day.",
    allowRemoteLabel: "Allow remote check-ins",
    allowRemoteHint: "Count WFH days in attendance reports",
    leavesEnabledLabel: "Enable leaves & holidays",
    leavesEnabledHint: "Show Leaves and Holiday Calendar",
    workingDaysLabel: "Working days",
    workingDaysHint: "Days that count as working days for attendance and leave calculations.",
    workingDaysSaveAtLeastOne: "Select at least one working day.",
    saveButton: "Save settings",
    saveSuccess: "Settings saved",
    saveError: "Save failed",
    loading: "Loading…",
    // Signal configuration
    signalsTitle: "Signal configuration",
    signalsDescription: "Signals define what counts as “in office” for your workspace. If no signals are registered, all check-in events from your members are shown.",
    signalsEmpty: "No signals registered yet. Add a GPS location or IP context below.",
    signalRemove: "Remove",
    signalRemoveConfirm: "Remove this signal?",
    gpsFormTitle: "Register GPS location",
    gpsLocationNameLabel: "Location name",
    gpsLocationNamePlaceholder: "Head Office",
    gpsLatLabel: "Latitude",
    gpsLngLabel: "Longitude",
    gpsRadiusLabel: (r: number) => `Geofence radius: ${r}m`,
    gpsTzHint: (tz: string) => `Timezone will auto-update to ${tz}`,
    gpsGetBtn: "Use my current GPS",
    gpsGettingBtn: "Getting GPS…",
    gpsSaveBtn: "Save location",
    gpsToastAuto: "Location registered. Workspace timezone auto-updated.",
    gpsManualToast: "GPS location registered. Workspace timezone auto-updated.",
    gpsErrorNoSupport: "Geolocation not supported by this browser",
    gpsErrorDenied: (msg: string) => `GPS denied: ${msg}`,
    gpsErrorFailed: "Failed to register GPS location",
    gpsErrorInvalidCoords: "Enter valid latitude and longitude",
    gpsErrorManualFailed: "Failed to register location",
    addGpsBtn: "+ GPS location",
    addIpBtn: "+ IP context",
    ipToast: "IP context registered.",
    ipErrorFailed: "Failed to register IP context",
    cancelBtn: "Cancel",
    // Domain verification
    domainsTitle: "Email domain verification",
    domainsDescription: "Verified domains enable auto-enrolment: employees who sign up with a matching email are automatically added as members.",
    domainDnsInstructions: "Add this DNS TXT record, then click “Check verification”:",
    domainDnsNameLabel: "Name",
    domainDnsValueLabel: "Value",
    domainCopied: "Copied!",
    domainCopy: "Copy",
    domainVerified: "Verified",
    domainUnverified: "Unverified",
    domainRemove: "Remove",
    domainRemoveConfirm: "Remove this domain?",
    domainPlaceholder: "acme.com",
    domainAddBtn: "Add",
    domainAddSuccess: (d: string) => `${d} added`,
    domainAddError: "Failed to add domain",
    domainCheckBtn: "Check verification",
    domainChecking: "Checking DNS…",
    domainVerifiedMsg: "✓ Domain verified",
    domainNotFoundMsg: "Not found yet",
    // Archive / restore
    archiveTitle: "Archive workspace",
    restoreTitle: "Restore workspace",
    archiveDescription: "Archiving hides this workspace from your active list. Members and all presence data are preserved. The workspace can be restored at any time from /ws.",
    restoreDescription: "This workspace is currently archived. Restoring it will make it active again (subject to the 1 active workspace limit).",
    archiveBtn: "Archive workspace",
    restoreBtn: "Restore workspace",
    archiveConfirmText: "Archive this workspace?",
    restoreConfirmText: "Restore this workspace?",
    archiveConfirmBtn: "Confirm archive",
    restoreConfirmBtn: "Confirm restore",
    archiveError: "Archive failed",
    restoreError: "Restore failed",
    // Session
    sessionTitle: "Session",
    signOutBtn: "Sign out",
    signingOutBtn: "Signing out…",
  },

  /** /me/timeline workspace filter + per-workspace verification context */
  meTimeline: {
    workspaceLabel: "Workspace",
    workspaceAll: "All workspaces",
    transparencyHint:
      "All workspaces shows your events without org-specific verification. Pick a workspace to see how your check-ins evaluate against that workspace’s signals.",
    matchedVerified: "Verified",
    matchedPartial: "Partial match",
    matchedNone: "Unverified",
    matchedOverride: "Admin override",
    matchedSignals: "Signals matched",
    checkoutLocationNotCaptured: "Location not captured",
    viewMore: "View more",
    loadingMore: "Loading more…",
    emptyNoCheckinsTitle: "No check-ins in this date range.",
    emptyNoCheckinsBody: "Try expanding the date range above.",
  },

  wsDisputes: {
    viewMore: "View more",
    loadingMore: "Loading more…",
  },

  wsPeople: {
    viewMore: "View more",
    loadingMore: "Loading more…",
  },

  /** /ws/:slug/members/:userId member timeline */
  wsMemberTimeline: {
    viewMore: "View more",
    loadingMore: "Loading more…",
  },

  email: {
    otp: {
      subject: (code: string) => `${code} is your ${brand} verification code`,
      heading: `Your ${brand} verification code`,
      body: "Use this code to verify your email address. It expires in 10 minutes.",
      footer: "If you didn't request this, you can safely ignore this email.",
    },
    consent: {
      subject: (workspaceName: string) =>
        `${workspaceName} wants to track your work presence`,
      heading: (workspaceName: string) =>
        `You've been invited to ${workspaceName}`,
      body: (workspaceName: string) =>
        `<strong>${workspaceName}</strong> has added your email to their ${brand} workspace. This means they can see your work presence events (office check-ins, client visits, etc.) after you consent.`,
      revoke: `Your data always belongs to you. You can revoke access at any time from your ${brand} profile.`,
      footer: `${brand} is a presence intelligence platform that lets employees own their work history.`,
    },
  },

  constants: {
    // ── Auth cookies ──────────────────────────────────────────────────────────
    cookieSession: "cm_session",
    cookieOtp: "cm_otp_ok",
    cookieUI: "cm_ui",

    // ── Domain verification ───────────────────────────────────────────────────
    // DNS TXT: _checkmark-verify.{domain}  IN TXT  "checkmark-verify={token}"
    dnsVerifySubdomain: "_checkmark-verify",
    dnsVerifyValuePrefix: "checkmark-verify",

    // ── Database ──────────────────────────────────────────────────────────────
    dbFile: "checkmark.db",

    // ── HTTP ──────────────────────────────────────────────────────────────────
    geoUserAgent: "CheckMark/1.0 (presence-platform)",

    // ── Browser storage / notification tags (CheckinButtons) ─────────────────
    staleNotifKey: "cm_stale_notif_count",
    staleNotifEventKey: "cm_stale_notif_event",
    notifTagStale: "cm-stale-checkin",
    notifTagAutoCheckout: "cm-auto-checkout",
  },

  notifications: {
    // Stale check-in reminders - fired at 4h, 8h, 12h, 16h, 18h, 20h, 22h after check-in
    stale: {
      4: {
        title: `${brand} - half day?`,
        body: "You've been in for 4 hours. If you're doing a half day, now's a good time to check out and head home!",
      },
      8: {
        title: `${brand} - time to wrap up?`,
        body: "It's been 8 hours. Work-life balance matters - feel free to head out!",
      },
      12: {
        title: `${brand} - still going?`,
        body: "12 hours in! Dedication noted, but rest is important too. Time to head home.",
      },
      16: {
        title: `${brand} - seriously though`,
        body: "16 hours checked in. Even the most committed need sleep. Please check out!",
      },
      18: {
        title: `${brand} - we are worried`,
        body: "18 hours! Your productivity has left the building. Be kind to yourself - go home.",
      },
      20: {
        title: `${brand} - this is getting serious`,
        body: "20 hours and counting. We genuinely recommend a bed over your desk right now.",
      },
      22: {
        title: `${brand} - final warning`,
        body: "22 hours! Auto-checkout happens in 2 hours. This is your last chance to do it yourself.",
      },
    } as Record<number, { title: string; body: string }>,
    staleFallback: {
      title: `${brand} - still checked in?`,
      body: (hours: number) =>
        `You've been checked in for ${hours} hours. Did you forget to check out?`,
    },
    autoCheckout: {
      title: `${brand} - auto checked out`,
      body: "You were automatically checked out after 24 hours.",
    },
    bellAriaLabel: 'Notifications',
    markAllRead: 'Mark all as read',
    empty: 'No notifications yet',
    leaveSubmittedTitle: 'New leave request',
    leaveApprovedTitle: 'Leave approved',
    leaveRejectedTitle: 'Leave rejected',
    leaveSubmittedBody: (name: string, days: number, type: string) =>
      `${name} applied for ${days} day(s) of ${type}`,
    leaveApprovedBody: (type: string, start: string, end: string) =>
      `Your ${type} from ${start} to ${end} has been approved`,
    leaveRejectedBody: (type: string, start: string, end: string) =>
      `Your ${type} from ${start} to ${end} was rejected`,
  },
};
