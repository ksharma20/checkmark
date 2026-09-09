/**
 * Copy for the asset register at /ws/:slug/assets.
 *
 * MOVED out of `ws-people.ts` unchanged. That module was carrying three
 * unrelated screens — assets, leave and the People directory — so three agents
 * working on three different screens all had to edit one file. One module per
 * screen is what makes those edits disjoint.
 *
 *   import { wsAssets } from '@/locales/en/ws-assets'
 *
 * `en.wsAssets.x` still resolves to this same object; `src/locales/en.ts`
 * spreads it on.
 */

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

  addTitle: 'Add an asset',
  editTitle: 'Edit asset',
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
  saveSubmit: 'Save changes',
  addHint: 'New assets enter the register as Available. Assign them from the table below.',
  editHint: 'Status and holder are not edited here — use the row actions to assign, return, repair or retire.',
  addNameRequired: 'An asset name is required.',
  valueInvalid: 'Purchase value must be a number of 0 or more.',
  validationFailed: 'Check the highlighted fields and try again.',
  saveFailed: 'Could not save the asset.',
  added: 'Asset added to the register',
  updated: 'Asset updated',

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

  editAction: 'Edit',
  deleteAction: 'Delete',
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

  deleteTitle: 'Delete asset',
  deleteBody: (name: string) => `Remove ${name} from the register?`,
  deleteNote: 'The record is archived, not erased — who held it and when stays on file.',
  deleteConfirm: 'Delete',
  deletingConfirm: 'Deleting…',
  deleteCancel: 'Cancel',
  deleted: 'Asset removed from the register',
  deleteFailed: 'Could not delete the asset.',

  emptyTitle: 'No assets in this category',
  emptyHint: 'Add one to start the register.',
  loadFailed: 'Could not load assets.',
  noEmployees: 'Add an employee record before assigning equipment.',
} as const
