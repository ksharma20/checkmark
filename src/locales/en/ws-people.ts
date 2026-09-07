/**
 * Copy for the workforce half of the `/ws` admin surface: Employees, Assets,
 * Leave (requests / applied / maternity) and the People membership screen.
 *
 * Kept out of `src/locales/en.ts` on purpose - that file is edited by every
 * other surface at once, and these four screens change together. Import the
 * export you need directly:
 *
 *   import { wsEmployees } from '@/locales/en/ws-people'
 *
 * Anything a user can read belongs here rather than inline in a component.
 */

// ─── Employees ────────────────────────────────────────────────────────────────

export const wsEmployees = {
  title: 'Employees',
  /**
   * Counts PEOPLE, not records. The directory lists every active member, so a
   * count of `employees` rows would under-report the workforce by whatever HR
   * has not filled in yet - which is the whole reason the second number is
   * there rather than being quietly folded into the first.
   */
  subtitle: (total: number, withRecord: number) => {
    const people = `${total} ${total === 1 ? 'person' : 'people'}`
    if (total === 0) return people
    if (withRecord === total) return `${people} · all with HR details`
    return `${people} · ${withRecord} with HR details`
  },
  addButton: 'Add employee',
  editButton: 'Edit profile',
  backToDirectory: 'Back to directory',
  backToStep: 'Back',

  searchPlaceholder: 'Search name, job title or email',
  departmentAll: 'All departments',
  departmentLabel: 'Department filter',
  statusAll: 'All statuses',
  statusLabel: 'Status filter',
  loadMore: 'Load more',
  loadingMore: 'Loading…',

  // People without an HR record
  noRecordLabel: 'No HR details',
  addDetails: 'Add details',
  addDetailsFor: (name: string) => `Add HR details for ${name}`,
  /**
   * Department and status are columns on the HR record, so filtering by one
   * can only ever match people who have a record. Said out loud, because a
   * directory that silently drops two thirds of the workforce reads as a bug.
   */
  recordOnlyFilterNote:
    'Department and status come from the HR record, so people without one are hidden while these filters are on.',

  colEmployee: 'Employee',
  colJobTitle: 'Job title',
  colRole: 'Role',
  colDepartment: 'Department',
  colType: 'Type',
  colJoined: 'Joined',
  colStatus: 'Status',

  emptyTitle: 'Nobody matches your filters',
  emptyHint: 'Clear the search or pick a different department.',
  emptyDirectoryTitle: 'No people in this workspace yet',
  emptyDirectoryHint: 'Invite someone from the People screen to start the directory.',

  loadFailed: 'Could not load the directory.',
  notFound: 'That employee record no longer exists.',

  // Detail view
  sectionLeaveBalance: 'Leave balance',
  leaveBalanceEmpty: 'No leave types configured for this workspace.',
  leaveBalanceRemaining: (available: number, total: number) =>
    `${available} of ${total} left`,
  joinedOn: (date: string) => `joined ${date}`,
  noValue: '—',
  maskedHint: 'Aadhaar and bank account are masked. Open the Bank & IDs tab to change them.',

  // Record form (one tab of the HR record at a time - there is no wizard)
  formSave: 'Save changes',
  formSaving: 'Saving…',
  formCancel: 'Cancel',
  formSaved: 'Saved',
  formGenericError: 'Something went wrong. Please try again.',
  /**
   * The load failed, so the values on screen would be component defaults. Said
   * plainly, because the alternative - painting an empty form - invites a save
   * that overwrites a real record with blanks.
   */
  formLoadFailedTitle: 'Could not load this section',
  formLoadFailedBody: 'Nothing has been changed. Try again in a moment.',
  formLoadFailedRetry: 'Try again',
  formReadOnly: 'You can read these details but not change them.',
  reveal: 'Show value',
  hide: 'Hide value',

  // Minimal create - the record starts with the three NOT NULL columns and is
  // finished tab by tab afterwards.
  createTitle: 'Add employee',
  createSubtitle:
    'Just enough to open the record. Their job, bank details and documents are filled in on their profile afterwards.',
  createSubmit: 'Create record',
  createSaving: 'Creating…',
  createdToast: 'Employee record created',

  stepBasic: 'Basic details',
  stepBasicSub: 'Personal and contact information',
  stepEmployment: 'Employment',
  stepEmploymentSub: 'Job and employment details',
  stepBank: 'Bank & IDs',
  stepBankSub: 'Financial and statutory identifiers',
  stepEmergency: 'Emergency',
  stepEmergencySub: 'Emergency contact information',
  stepReview: 'Review',
  stepReviewSub: 'Review and submit',

  // Documents panel
  documentsTitle: 'Documents',
  documentsEmpty: 'No document slots yet',
  documentsEmptyHint: 'Upload a file to open the first slot.',
  documentsLoadFailed: 'Could not load documents.',
  documentByCompany: 'provided by company',
  documentByEmployee: 'uploaded by employee',
  documentUpload: 'Upload for employee',
  documentReplace: 'Replace file',
  documentDownload: 'Download',
  documentVerify: 'Verify',
  documentReject: 'Reject',
  documentRejectReasonLabel: 'Reason for rejecting',
  documentRejectReasonPlaceholder: 'Tell them what to fix',
  documentRejectConfirm: 'Confirm reject',
  documentRejectCancel: 'Cancel',
  documentRejectReasonRequired: 'A reason is required to reject a document.',
  documentRejectedNote: (reason: string) => `Rejected — ${reason}`,
  documentUploaded: 'File uploaded',
  documentVerified: 'Document verified',
  documentRejected: 'Document rejected',
  documentUploadFailed: 'Upload failed. Please try again.',
  documentActionFailed: 'Could not update the document.',
  documentAddSlotTitle: 'Add a document slot',
  documentSlotNameLabel: 'Document name',
  documentSlotNamePlaceholder: 'e.g. Offer letter',
  documentSlotOwnerLabel: 'Provided by',
  documentSlotOwnerAdmin: 'The company',
  documentSlotOwnerEmployee: 'The employee',
  documentSlotFileLabel: 'Choose a file',
  documentSlotSubmit: 'Upload',
  documentSlotNameRequired: 'Name the document before uploading.',

  statusActive: 'Active',
  statusTerminated: 'Terminated',
  statusSuspended: 'Suspended',
  statusOnLeave: 'On leave',
  statusNoticePeriod: 'Notice period',
} as const

// ─── Assets ───────────────────────────────────────────────────────────────────

export const wsAssets = {
  title: 'Assets',
  subtitle: 'Company equipment issued to employees — laptops, ID cards, peripherals.',
  exportButton: 'Export CSV',
  addButton: 'Add asset',
  cancelButton: 'Cancel',

  statTotal: 'Total assets',
  statTotalHint: (value: string) => `${value} in service`,
  statAssigned: 'Assigned',
  statAssignedHint: 'held by employees',
  statAvailable: 'Available',
  statAvailableHint: 'ready to issue',
  statRepair: 'In repair',
  statRepairHint: 'out of circulation',

  addFormTitle: 'Add an asset',
  fieldName: 'Asset name',
  fieldNamePlaceholder: 'e.g. MacBook Pro 14"',
  fieldCategory: 'Category',
  fieldCategoryPlaceholder: 'e.g. Laptop',
  fieldSerial: 'Serial number',
  fieldSerialPlaceholder: 'Serial number',
  fieldCondition: 'Condition',
  fieldValue: 'Purchase value',
  fieldValuePlaceholder: 'Value',
  fieldNotes: 'Notes',
  addSubmit: 'Add',
  addHint: 'New assets enter the register as Available. Assign them from the table below.',
  addNameRequired: 'An asset name is required.',
  added: 'Asset added to the register',

  categoryAll: 'All',
  registerTitle: 'Register',

  colAsset: 'Asset',
  colTagSerial: 'Serial',
  colAssignedTo: 'Assigned to',
  colIssued: 'Issued',
  colCondition: 'Condition',
  colStatus: 'Status',
  colAction: 'Action',

  statusAssigned: 'Assigned',
  statusAvailable: 'Available',
  statusRepair: 'In repair',
  statusRetired: 'Retired',

  conditionGood: 'good',
  conditionFair: 'fair',
  conditionPoor: 'poor',
  conditionUnset: 'unset',

  actionAssign: 'Assign',
  actionReturn: 'Mark returned',
  actionRepair: 'Send to repair',
  actionBackInService: 'Back in service',
  actionRetire: 'Retire',

  assignTitle: 'Assign asset',
  assignEmployeeLabel: 'Employee',
  assignEmployeePlaceholder: 'Select employee',
  assignSubmit: 'Assign',
  assignCancel: 'Cancel',
  assignEmployeeRequired: 'Pick an employee first.',
  assigned: (name: string) => `Assigned to ${name}`,
  returned: 'Asset returned to the pool',
  sentToRepair: 'Asset sent for repair',
  backInService: 'Asset is back in service',
  retired: 'Asset retired',
  conditionUpdated: 'Condition updated',
  actionFailed: 'Could not update the asset.',

  emptyTitle: 'No assets in this category',
  emptyHint: 'Add one to start the register.',
  loadFailed: 'Could not load assets.',
  noEmployees: 'Add an employee record before assigning equipment.',
} as const

// ─── Leave (admin) ────────────────────────────────────────────────────────────

export const wsLeaveScreen = {
  title: 'Leave',
  tabRequests: 'Requests',
  tabApplied: 'Applied leaves',
  tabMaternity: 'Maternity',

  // Requests
  pendingTitle: 'Pending requests',
  pendingEmptyTitle: 'All caught up',
  pendingEmptyHint: 'No leave requests waiting on you.',
  approve: 'Approve',
  approving: 'Approving…',
  decline: 'Decline',
  declineReasonLabel: 'Reason for declining',
  declineReasonPlaceholder: 'Tell them why',
  declineConfirm: 'Confirm decline',
  declineCancel: 'Cancel',
  declineReasonRequired: 'A reason is required to decline.',
  approved: 'Leave request approved',
  declined: 'Leave request declined',
  requestActionFailed: 'Could not update the request.',

  // Applied
  filterAll: 'All',
  filterPending: 'Pending',
  filterApproved: 'Approved',
  filterRejected: 'Declined',
  colEmployee: 'Employee',
  colType: 'Type',
  colDates: 'Dates',
  colDays: 'Days',
  colStatus: 'Status',
  appliedEmptyTitle: 'Nothing in this filter',
  appliedEmptyHint: 'Try another status.',
  statusPending: 'Pending',
  statusApproved: 'Approved',
  statusRejected: 'Declined',
  loadFailed: 'Could not load leave requests.',


  // Maternity
  maternityIntro:
    '26-week paid entitlement (Maternity Benefit Act). Track each case from request through return to work.',
  maternityStart: 'Start maternity leave',
  maternityFormTitle: 'New maternity leave',
  maternityEmployee: 'Employee',
  maternityEmployeePlaceholder: 'Select employee',
  maternityDue: 'Expected due date',
  maternityWeeks: 'Weeks',
  maternityAdd: 'Add',
  maternityCancel: 'Cancel',
  maternityFormHint:
    'Leave starts ~4 weeks before the due date; expected return is calculated from the entitlement.',
  maternityEmployeeRequired: 'Select an employee and a due date.',
  maternityCreated: 'Maternity leave case created',
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
  maternityEmptyTitle: 'No maternity leave cases',
  maternityEmptyHint: 'Start one when someone files for maternity leave.',
  maternityLoadFailed: 'Could not load maternity cases.',
} as const

// ─── People (membership) ──────────────────────────────────────────────────────

export const wsPeopleUi = {
  subtitle: 'Everyone in this workspace - their record, their access, and how they leave.',
  membersTitle: 'Members',
  searchButton: 'Search',
  employeeProfile: 'Employee profile',
  actionsLabel: 'Actions',
  roleLocked: 'Locked',

  /** Directory filter bar */
  addEmployee: 'Add employee',
  searchPlaceholder: 'Search name, job title or email',
  departmentAll: 'All departments',
  departmentLabel: 'Department filter',
  statusAll: 'All statuses',
  statusLabel: 'Status filter',
  recordOnlyFilterNote:
    'Department filters read a field only an HR record carries, so people without one are hidden while it is on.',
  emptyFilteredTitle: 'Nobody matches your filters',
  emptyFilteredHint: 'Clear the search or pick a different department.',

  /** One status control over two tables - see DirectoryStatusFilter. */
  statusInvited: 'Invited',
  statusDeclined: 'Declined',
  /**
   * `workspace_members.status = 'no_access'` - an HR record whose person has
   * never been invited and cannot sign in.
   *
   * A membership row is written for them anyway, because the person screen is
   * keyed on `workspace_members.id`: an employee row with no membership has no
   * URL and disappears from the directory entirely, which is how two records
   * went missing in the live data. "No access" is the honest word - they exist,
   * they are just not a user yet.
   */
  statusNoAccess: 'No access',
  statusNoAccessHint: 'Has a record, not invited yet',
  statusEmployed: 'Active',
  statusTerminated: 'Terminated',
  statusSuspended: 'Suspended',
  statusOnLeave: 'On leave',
  statusNoticePeriod: 'Notice period',

  /** Row actions - one button now; role and status live on the details page. */
  editAction: 'Edit',
  editActionAria: (name: string) => `Open ${name}'s profile`,

  /** Details page - one tab per part of the record, each saved on its own. */
  detailsBack: 'People',
  tabBasic: 'Basic',
  tabEmployment: 'Employment',
  tabBank: 'Bank & IDs',
  tabEmergency: 'Emergency',
  tabDocuments: 'Documents',
  tabLeave: 'Leave',
  tabActivity: 'Activity',
  tabAccess: 'Access',

  /**
   * A tab whose subject does not exist yet. NOT a permission message: the
   * viewer may read this, there is simply nobody with an account behind it.
   * Attendance and leave are both keyed on a user id, and an invitation that
   * has not been accepted has none.
   */
  noSubjectTitle: 'Nothing here until they join',
  noSubjectHint:
    'Attendance and leave start once this person accepts their invitation and signs in.',

  accessTitle: 'Access and reporting',
  accessHint: 'Role, reporting line and removal. Changing any of these takes effect immediately.',
  accessRoleLabel: 'Workspace role',
  accessManagerLabel: 'Reporting manager',
  accessManagerNone: 'No manager (reports to the owner)',
  accessManagerHint: 'People with no manager roll up to the workspace owner.',
  accessManagerPendingHint:
    'A reporting line can be set once they accept the invitation and have an account.',
  accessManagerSaved: 'Reporting manager updated',
  accessManagerFailed: 'Could not set the reporting manager.',
  accessRemoveTitle: 'Remove from workspace',
  accessRemoveHint: 'Their presence history stays; they lose access immediately.',
  accessRemoveButton: 'Remove member',
  accessRemoveFailed: 'Could not remove this member.',
  noRecordTitle: 'No HR record yet',
  noRecordHint:
    'Add their details to open the record tabs - employment, bank, emergency contact and documents.',
  createRecordButton: 'Create employee record',

  /**
   * The invitation offer, on the Access tab.
   *
   * It follows the record rather than preceding it: the record is the artefact
   * worth keeping, and asking about workspace access before anything is saved
   * meant a cancelled dialog threw the form away. Declining costs nothing -
   * the button is still here tomorrow.
   */
  inviteTitle: 'No workspace access yet',
  inviteBody: (email: string) =>
    `${email} has an HR record but has not been invited to CheckMark. Sending an invitation lets them sign in, check in and see their own timeline.`,
  inviteNote: 'Their record is safe either way. Nothing is lost by waiting.',
  inviteSend: 'Send invite',
  inviteSending: 'Sending…',
  statusNotInvited: 'Not invited',
  inviteSent: (email: string) => `Invitation sent to ${email}`,
  inviteAutoEnrol:
    'No invite needed - their email domain is verified, so they join automatically when they sign up.',
  inviteFailed: 'Could not send the invitation.',
} as const

// ─── Organisation (reporting tree) ────────────────────────────────────────────

export const wsOrg = {
  subtitle: 'Who reports to whom. People with no manager roll up to the workspace owner.',
  searchPlaceholder: 'Find someone in the chart',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  expandAll: 'Expand all',
  collapse: 'Collapse',
  expand: (n: number) => `${n} ${n === 1 ? 'report' : 'reports'}`,
  reportCount: (n: number) => `${n} direct ${n === 1 ? 'report' : 'reports'}`,
  youSuffix: '(you)',
  openPerson: (name: string) => `Find ${name} in the directory`,
  emptyTitle: 'Nobody to chart yet',
  emptyHint: 'Once people accept their invitations they appear here, under the owner.',
  loadFailed: 'Could not load the reporting structure',
  loadFailedHint: 'Refresh the page to try again.',
} as const
