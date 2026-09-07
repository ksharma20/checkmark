/**
 * Copy for the four self-service `/me` screens: Leave, Profile, Documents and
 * the workspace roster.
 *
 * Kept apart from `src/locales/en/me.ts` (the shell + home screen) and from
 * `src/locales/en.ts` (the long-lived product string table) so these screens
 * can churn without colliding with either. Import it directly:
 *
 *   import { meScreens } from '@/locales/en/me-screens'
 *
 * Anything already spoken by an API response - the leave route's balance and
 * overlap errors, for instance - is rendered as the server sent it and only
 * falls back to a string here, so the two never drift.
 */

export const meScreens = {
  // ── shared across the four screens ────────────────────────────────────────
  common: {
    back: 'Back',
    noWorkspaceTitle: 'No workspace yet',
    noWorkspaceBody: 'Join or create a workspace and this page fills in.',
    loadFailed: 'Could not load this. Please try again.',
    retry: 'Try again',
    empty: '—',
    saving: 'Saving…',
    save: 'Save changes',
    saved: 'Saved',
  },

  // ── /me/leave ─────────────────────────────────────────────────────────────
  leave: {
    title: 'Leave',
    tabBalance: 'Balance',
    tabApply: 'Apply',
    tabHistory: 'History',
    tabHolidays: 'Holidays',

    // Balance
    balanceEmpty: 'No leave types yet',
    balanceEmptyHint: 'Your workspace admin has not set up any leave types.',
    available: 'available',
    openingBalance: 'Opening',
    accrued: 'Accrued',
    used: 'Used',
    daysUnit: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    accrualLine: (frequency: string, credits: number) =>
      `${frequency} accrual · ${credits} per period`,
    frequency: {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      'half-yearly': 'Half-yearly',
      yearly: 'Yearly',
    } as Record<string, string>,
    usedOfAccrued: (used: number, total: number) => `${used} of ${total} used`,

    // Apply
    applyHeading: 'Request leave',
    applyNoTypes: 'No leave types are configured in this workspace yet.',
    fieldType: 'Leave type',
    fieldTypePlaceholder: 'Select a leave type',
    typeOption: (name: string, days: number) => `${name} · ${days} left`,
    fieldStart: 'Start date',
    fieldEnd: 'End date',
    fieldReason: 'Reason (optional)',
    fieldReasonPlaceholder: 'e.g. Family function',
    chipDaysLeft: (name: string, days: number) => `${name}: ${days} left`,
    submit: 'Submit request',
    submitting: 'Submitting…',
    submitSuccess: 'Leave request submitted.',
    submitFailed: 'Could not submit your request. Please try again.',
    holidayWarning: (names: string) =>
      `These dates include a company holiday (${names}). Shorten the range before submitting.`,

    // History
    historyLeaveHeading: 'Your leave requests',
    historyCorrectionHeading: 'Your correction requests',
    historyLeaveEmpty: 'No leave requests yet',
    historyLeaveEmptyHint: 'Requests you submit show up here with their status.',
    historyCorrectionEmpty: 'No correction requests yet',
    historyCorrectionEmptyHint:
      'Ask for a correction from a day on your timeline and it appears here.',
    status: {
      approved: 'Approved',
      pending: 'Pending',
      rejected: 'Rejected',
    } as Record<string, string>,
    rejectedPrefix: 'Declined:',
    correctionType: {
      office: 'Mark as office',
      remote: 'Mark as remote',
    } as Record<string, string>,

    // Holidays
    holidaysHeading: 'Upcoming holidays',
    holidaysPastHeading: 'Earlier this year',
    holidaysEmpty: (year: number) => `No holidays published for ${year}`,
    holidaysEmptyHint: 'Your workspace admin publishes the holiday calendar.',
    badgeToday: 'Today',
  },

  // ── /me/profile ───────────────────────────────────────────────────────────
  profile: {
    title: 'My profile',
    subtitle:
      'Keep your personal and financial details up to date. Employment details are managed by your admin.',
    noRecordTitle: 'No employee record here',
    noRecordBody:
      'Your admin has not created an employee record for you in this workspace yet.',

    employmentHeading: 'Employment details',
    employmentManagedBy: 'managed by admin',
    employmentField: {
      employee_id: 'Employee ID',
      designation: 'Designation',
      department: 'Department',
      employment_type: 'Employment type',
      work_mode: 'Work mode',
      work_location: 'Work location',
      date_of_joining: 'Date of joining',
      work_email: 'Work email',
    },

    sectionPersonal: 'Personal',
    sectionContact: 'Contact',
    sectionEmergency: 'Emergency contact',
    sectionIds: 'Government IDs',
    sectionBank: 'Bank details',
    sensitiveHint: 'Stored encrypted. Only you and your workspace admin can see this.',

    field: {
      first_name: 'First name',
      last_name: 'Last name',
      date_of_birth: 'Date of birth',
      gender: 'Gender',
      marital_status: 'Marital status',
      blood_group: 'Blood group',
      number_of_children: 'Number of children',
      personal_email: 'Personal email',
      phone: 'Phone',
      alternate_phone: 'Alternate phone',
      current_address: 'Current address',
      permanent_address: 'Permanent address',
      emergency_contact_name: 'Contact name',
      emergency_contact_relationship: 'Relationship',
      emergency_contact_phone: 'Contact phone',
      pan: 'PAN',
      aadhaar: 'Aadhaar',
      uan: 'UAN',
      passport_number: 'Passport number',
      bank_account: 'Bank account number',
      bank_ifsc: 'IFSC',
      bank_name: 'Bank name',
    },

    placeholder: {
      phone: '10-digit mobile number',
      address: 'Street, city, state, PIN',
      relationship: 'e.g. Spouse, Parent',
      pan: 'ABCDE1234F',
      aadhaar: '12-digit number',
      uan: '12-digit number',
      passport_number: 'A1234567',
      bank_account: 'Account number',
      bank_ifsc: 'e.g. HDFC0001234',
      bank_name: 'e.g. HDFC Bank',
    },

    select: {
      none: 'Not set',
      gender: {
        male: 'Male',
        female: 'Female',
        non_binary: 'Non-binary',
        prefer_not_to_say: 'Prefer not to say',
      } as Record<string, string>,
      marital_status: {
        single: 'Single',
        married: 'Married',
        divorced: 'Divorced',
        widowed: 'Widowed',
        separated: 'Separated',
      } as Record<string, string>,
    },

    /** Maps `FieldErrorCode` from the server's 422 body onto a readable line. */
    fieldError: {
      REQUIRED: 'This is required.',
      INVALID_FORMAT: 'That format is not valid.',
      INVALID_EMAIL: 'Enter a valid email address.',
      INVALID_ENUM: 'Pick one of the listed options.',
      INVALID_NAME: 'Use letters and spaces only.',
      INVALID_PHONE: 'Enter a 10-digit number starting 6-9.',
      MUST_BE_BEFORE_TODAY: 'This must be in the past.',
      MUST_BE_18_OR_OLDER: 'You must be 18 or older.',
      MUST_BE_NON_NEGATIVE: 'This cannot be negative.',
    } as Record<string, string>,
    fieldErrorFallback: 'Check this value.',
    saveFailed: 'Could not save your changes. Please try again.',
    validationFailed: 'Some fields need attention.',
    savedToast: 'Profile updated.',
    noChanges: 'Nothing to save yet.',
  },

  // ── /me/documents ─────────────────────────────────────────────────────────
  documents: {
    title: 'My documents',
    subtitle: 'Upload what needs verifying. Your company provides the rest.',
    noRecordTitle: 'No employee record here',
    noRecordBody:
      'Your admin has not created an employee record for you in this workspace yet.',

    yoursHeading: 'Your documents',
    companyHeading: 'Provided by company',
    yoursEmpty: 'Nothing requested yet',
    yoursEmptyHint: 'When your admin asks for a document it appears here to upload.',
    companyEmpty: 'Nothing issued yet',
    companyEmptyHint: 'Offer letters and contracts your company issues show up here.',

    upload: 'Tap or drop a file to upload',
    replace: 'Replace file',
    uploading: 'Uploading…',
    download: 'Download',
    awaitingHr: 'Awaiting HR upload',
    rejectedPrefix: 'Rejected:',
    rejectedReupload: 'Please upload a corrected file.',
    verifiedLocked: 'Verified documents cannot be replaced.',

    /** The constraints the API enforces, stated once so people see them upfront. */
    constraints: 'PDF, PNG or JPEG · up to 2 MB',
    uploadedAt: (when: string) => `Uploaded ${when}`,
    fileSize: (kb: number) => `${kb} KB`,
    uploadFailed: 'Upload failed. Please try again.',
    uploadSuccess: 'Uploaded. Awaiting verification.',
  },

  // ── /me/workspace ─────────────────────────────────────────────────────────
  roster: {
    title: 'Workspace',
    subtitle: "Who's in right now",
    statPresent: 'Present',
    statRemote: 'Remote',
    statLeave: 'Leave',
    groupPresent: 'Present',
    groupRemote: 'Remote',
    groupLeave: 'On leave',
    groupCount: (label: string, n: number) => `${label} · ${n}`,
    empty: 'Nobody has checked in yet',
    emptyHint: 'Check-ins for today show up here as they happen.',
    checkedOut: 'Checked out',
  },
} as const
