/**
 * Copy for the employee-documents, assets and maternity modules.
 *
 * A separate module from `src/locales/en.ts` for the same reason as
 * `./marketing` and `./me`: that file is the long-lived product string table,
 * and these three modules churn together. Import it directly:
 *
 *   import { documents } from '@/locales/en/documents'
 *
 * The one string that does NOT live here is the Assets sidebar label - the
 * sidebar reads `en.wsNav.screens` as a `Record<Screen, string>`, so a new
 * screen's label has to be in that record or the build fails.
 */

export const documents = {
  /** Verification states, as shown on a document row. */
  status: {
    missing: 'Not uploaded',
    pending: 'Awaiting review',
    verified: 'Verified',
    rejected: 'Rejected',
    issued: 'Issued',
  },

  /** Who is expected to produce the file. */
  owner: {
    admin: 'Issued by company',
    employee: 'Provided by employee',
  },

  /** Shown in the approvals feed for a `kind: 'doc'` item. */
  approvals: {
    label: 'Document',
    /** Second line: which document, and the file that was uploaded. */
    detail: (docName: string, fileName: string | null) =>
      fileName ? `${docName} · ${fileName}` : docName,
  },

  errors: {
    tooLarge: 'File exceeds the 2 MB limit',
    unsupportedType: 'Only PDF, PNG and JPEG files are accepted',
    alreadyVerified: 'This document has already been verified and cannot be replaced',
    /** Two uploads raced for the same slot; the loser gets this, not a 500. */
    duplicateSlot: 'A document with this name already exists. Refresh and upload into that slot.',
    rateLimited: 'Too many uploads. Try again later.',
    slotLimit: (max: number) =>
      `You already have ${max} documents. Ask an admin to remove one before adding another.`,
  },
} as const

/**
 * Copy for the lazily-created HR record.
 *
 * Shared by the asset and maternity pickers because both now name a MEMBER and
 * let the server find or create the employee record behind them - so both can
 * fail in the same two ways.
 */
export const hrRecord = {
  errors: {
    memberRequired: 'Pick who this is for',
    notAMember: 'That person is not an active member of this workspace',
    workEmailTaken:
      'Another employee record already uses this work email. Open the Employees directory and link that record to their account first.',
  },
  /** Shown where a picker has nobody to offer. */
  noMembers: 'Invite someone to this workspace first.',
} as const

export const assets = {
  status: {
    available: 'Available',
    assigned: 'Assigned',
    repair: 'In repair',
    retired: 'Retired',
  },
  errors: {
    alreadyAssigned: 'Asset is already assigned - return it first',
    retired: 'A retired asset cannot be assigned',
    returnFirst: 'Return the asset from its holder before changing its status',
  },
} as const

export const maternity = {
  status: {
    requested: 'Requested',
    approved: 'Approved',
    onleave: 'On leave',
    returned: 'Returned',
  },
  errors: {
    caseOpen: 'This employee already has an open maternity case',
    datesRequiredWhileOpen: 'An open maternity case must keep its start and end dates',
  },
} as const
