/**
 * Leave-type configuration, on the Settings > Leave tab.
 *
 * Moved out of the inline group in ../en.ts when the screen gained edit and
 * delete, per the AGENTS.md rule that a copy group migrates into its own module
 * as its screens are touched.
 */

export const wsLeaveTypes = {
  sectionTitle: 'Leave Types',
  sectionDescription:
    "Define leave types and how credits are accrued for team members. Credits accrue from each member's join date.",
  addType: 'Add type',
  labelName: 'Type name',
  labelFrequency: 'Accrual',
  labelCredits: 'Credits',
  labelCreditTiming: 'Apply',
  optionTimingStart: 'Start of period',
  optionTimingEnd: 'End of period',
  optionMonthly: 'Monthly',
  optionQuarterly: 'Quarterly',
  optionHalfYearly: 'Half Yearly',
  optionYearly: 'Yearly',
  placeholderName: 'e.g. Sick Leave',
  emptyNoTypes: 'No leave types yet. Add one below.',

  // Row summary
  timingStartShort: 'credited up front',
  timingEndShort: 'credited at period end',

  // Edit
  editAction: 'Edit',
  editTitle: 'Edit leave type',
  saveSubmit: 'Save changes',
  savingSubmit: 'Saving…',
  editCancel: 'Cancel',
  updated: 'Leave type updated',
  updateFailed: 'Could not update the leave type.',
  nameRequired: 'A name is required.',
  duplicateName: 'A leave type with this name already exists.',

  /**
   * The consequential bit. No balance is stored anywhere - every read
   * recomputes it from these three fields - so changing them rewrites history
   * for everyone at once. Renaming is safe and is called out separately so the
   * warning does not cry wolf on the harmless edit.
   */
  accrualChangeWarning:
    'Changing the accrual, credits or timing recalculates every member’s balance for this type, including leave already taken. Renaming is safe.',

  // Delete
  deleteAction: 'Remove',
  deleteTitle: 'Remove leave type',
  deleteBody: (name: string) =>
    `Remove “${name}”? It disappears from the list and nobody can request it again.`,
  deleteNote: 'Leave already requested or approved against it is not affected.',
  deleteConfirm: 'Remove',
  deletingConfirm: 'Removing…',
  deleteCancel: 'Cancel',
  deleted: 'Leave type removed',
  deleteFailed: 'Could not remove the leave type.',
} as const
