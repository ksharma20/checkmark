/**
 * Employee document metadata, and the one place base64 is allowed to exist
 * outside lib/storage.ts.
 *
 * The split matters: `employee_documents` holds only the description of a file
 * (name, type, size, verification state) and is what every list query reads.
 * The bytes sit in `employee_document_blobs`, touched only on upload and
 * download. Routes never call the blob helpers directly - they go through
 * `documentStore` in lib/storage.ts, which is the seam an S3 backend would
 * replace.
 *
 * Both tables are scoped by `workspace_id` on every statement. The metadata is
 * soft-deleted; the blob is HARD-deleted alongside it, because leaving
 * megabytes of orphaned TEXT behind for a file nobody can reach is a storage
 * leak, not an audit trail. That hard delete is issued by the CALLER through
 * `documentStore.delete` - `deleteDocument` below retires the metadata only.
 * The bytes are the storage backend's business, and a query file reaching
 * straight into the blob table would silently leak every object once that
 * backend is S3.
 *
 * Write ordering (the invariant that keeps a row honest):
 *
 *   A metadata row must never claim a file whose bytes are not stored yet.
 *
 * Bytes and metadata live in two writes that cannot share a transaction (see
 * lib/storage.ts), so the order is: clear the row's file claim, write the
 * bytes, then claim them. Every crash point in that sequence leaves either an
 * empty slot or a row pointing at exactly the bytes it describes - never a
 * download that 404s, and never an old file wearing a new name.
 */

import { db } from '../index'

/**
 * Who is responsible for producing the document.
 *
 * `employee` - the employee uploads it (ID proof, past payslips), so it starts
 *   `missing` and moves to `pending` on upload, awaiting admin verification.
 * `admin` - the company issues it (offer letter, contract), so it goes
 *   straight to `issued`; there is nothing for an admin to verify about a file
 *   they produced themselves.
 */
export type DocumentOwner = 'admin' | 'employee'

export type DocumentStatus = 'missing' | 'pending' | 'verified' | 'rejected' | 'issued'

export const DOCUMENT_OWNERS: readonly DocumentOwner[] = ['admin', 'employee']
export const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'missing',
  'pending',
  'verified',
  'rejected',
  'issued',
]

export function isDocumentOwner(value: unknown): value is DocumentOwner {
  return typeof value === 'string' && (DOCUMENT_OWNERS as readonly string[]).includes(value)
}

export function isDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === 'string' && (DOCUMENT_STATUSES as readonly string[]).includes(value)
}

/** METADATA ONLY - this interface deliberately has no bytes field. */
export interface EmployeeDocument {
  id: string
  workspace_id: string
  employee_id: string
  /** Stable slot key, e.g. `pan_card`. Unique per employee among live rows. */
  doc_key: string
  name: string
  owner: DocumentOwner
  status: DocumentStatus
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  reject_reason: string | null
  uploaded_by: string | null
  verified_by: string | null
  uploaded_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

/** A pending document joined to the person it belongs to - for the approvals feed. */
export interface PendingDocumentSummary extends EmployeeDocument {
  employee_first_name: string
  employee_last_name: string
  employee_work_email: string
  employee_user_id: string | null
}

// ─── Metadata reads ───────────────────────────────────────────────────────────

export async function listEmployeeDocuments(
  workspaceId: string,
  employeeId: string,
): Promise<EmployeeDocument[]> {
  return db.query<EmployeeDocument>(
    `SELECT * FROM employee_documents
     WHERE workspace_id = ? AND employee_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId, employeeId],
  )
}

export async function getDocument(
  id: string,
  workspaceId: string,
): Promise<EmployeeDocument | null> {
  return db.queryOne<EmployeeDocument>(
    `SELECT * FROM employee_documents
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * Find the live document occupying a slot.
 *
 * Callers use this to decide between "replace the file on the existing row"
 * and "insert a new row", which is what keeps the partial unique index on
 * (workspace_id, employee_id, doc_key) from ever being violated.
 */
export async function findDocumentByKey(
  workspaceId: string,
  employeeId: string,
  docKey: string,
): Promise<EmployeeDocument | null> {
  return db.queryOne<EmployeeDocument>(
    `SELECT * FROM employee_documents
     WHERE workspace_id = ? AND employee_id = ? AND doc_key = ? AND deleted_at IS NULL`,
    [workspaceId, employeeId, docKey],
  )
}

/** Every document awaiting admin verification - feeds getPendingApprovalItems. */
export async function getPendingDocuments(
  workspaceId: string,
  limit?: number,
): Promise<PendingDocumentSummary[]> {
  return db.query<PendingDocumentSummary>(
    `SELECT d.*,
            e.first_name AS employee_first_name,
            e.last_name  AS employee_last_name,
            e.work_email AS employee_work_email,
            e.user_id    AS employee_user_id
     FROM employee_documents d
     JOIN employees e ON e.id = d.employee_id
     WHERE d.workspace_id = ? AND d.status = 'pending' AND d.deleted_at IS NULL
       AND e.deleted_at IS NULL
     ORDER BY d.uploaded_at ASC
     ${limit ? 'LIMIT ?' : ''}`,
    limit ? [workspaceId, limit] : [workspaceId],
  )
}

/** Live slots an employee holds - the cap the /me upload route enforces. */
export async function countEmployeeDocuments(
  workspaceId: string,
  employeeId: string,
): Promise<number> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM employee_documents
     WHERE workspace_id = ? AND employee_id = ? AND deleted_at IS NULL`,
    [workspaceId, employeeId],
  )
  return row?.cnt ?? 0
}

export async function getPendingDocumentCount(workspaceId: string): Promise<number> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM employee_documents
     WHERE workspace_id = ? AND status = 'pending' AND deleted_at IS NULL`,
    [workspaceId],
  )
  return row?.cnt ?? 0
}

// ─── Metadata writes ──────────────────────────────────────────────────────────

export interface CreateDocumentInput {
  workspaceId: string
  employeeId: string
  doc_key: string
  name: string
  owner: DocumentOwner
  status: DocumentStatus
  file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  uploaded_by?: string | null
}

/**
 * Two uploads raced for the same slot and the partial unique index
 * `idx_employee_documents_slot` rejected the loser.
 *
 * `findDocumentByKey` + `createDocument` is check-then-act: nothing stops a
 * second request slipping between the two. The index is the real guard, so the
 * violation is expected traffic - a named error lets the route answer 409
 * instead of letting a driver exception escape as a 500.
 */
export class DuplicateDocumentSlotError extends Error {
  constructor(public readonly docKey: string) {
    super(`Document slot "${docKey}" already exists`)
    this.name = 'DuplicateDocumentSlotError'
  }
}

/**
 * Is this the unique-index violation above?
 *
 * Matched on the message rather than a driver-specific `code`: better-sqlite3
 * raises `SqliteError` and libSQL raises `LibsqlError`, but both carry SQLite's
 * own "UNIQUE constraint failed: ..." text, so one check covers both backends.
 */
function isUniqueConstraintError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return /unique constraint failed/i.test(message)
}

export async function createDocument(input: CreateDocumentInput): Promise<EmployeeDocument> {
  const id = crypto.randomUUID().replace(/-/g, '')
  const hasFile = input.file_name != null

  const values = [
    id,
    input.workspaceId,
    input.employeeId,
    input.doc_key,
    input.name,
    input.owner,
    input.status,
    input.file_name ?? null,
    input.mime_type ?? null,
    input.size_bytes ?? null,
    input.uploaded_by ?? null,
  ]

  try {
    await db.execute(
      `INSERT INTO employee_documents (
         id, workspace_id, employee_id, doc_key, name, owner, status,
         file_name, mime_type, size_bytes, uploaded_by, uploaded_at
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?, ${hasFile ? `datetime('now')` : 'NULL'})`,
      values,
    )
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new DuplicateDocumentSlotError(input.doc_key)
    throw err
  }

  const created = await getDocument(id, input.workspaceId)
  if (!created) throw new Error(`createDocument: failed to re-fetch document ${id}`)
  return created
}

/**
 * Point an existing slot at a newly uploaded file.
 *
 * Clears `reject_reason` and `verified_by`: a re-upload after a rejection is a
 * fresh submission, and carrying the old refusal or the old verifier forward
 * would make the row describe a file that no longer exists.
 */
export async function markDocumentUploaded(
  id: string,
  workspaceId: string,
  file: { file_name: string; mime_type: string; size_bytes: number },
  uploadedBy: string,
  status: DocumentStatus,
): Promise<EmployeeDocument | null> {
  await db.execute(
    `UPDATE employee_documents
     SET file_name = ?, mime_type = ?, size_bytes = ?,
         uploaded_by = ?, uploaded_at = datetime('now'),
         status = ?, reject_reason = NULL, verified_by = NULL,
         updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [
      file.file_name,
      file.mime_type,
      file.size_bytes,
      uploadedBy,
      status,
      id,
      workspaceId,
    ],
  )
  return getDocument(id, workspaceId)
}

/**
 * Give up a slot's claim on a file, without retiring the slot.
 *
 * Called immediately BEFORE new bytes are written over an occupied slot. Until
 * `markDocumentUploaded` runs, the row describes no file at all: it drops out
 * of the approvals feed, the download link disappears, and PATCH refuses to
 * review it (`existing.file_name` is NULL). That is the honest description of a
 * slot whose bytes are mid-replacement - and it is what stops a crashed upload
 * leaving a verified/rejected verdict, or an old file name, attached to bytes
 * nobody has reviewed.
 *
 * `owner` and `name` survive: the slot itself is unchanged, only its contents.
 */
export async function clearDocumentFile(
  id: string,
  workspaceId: string,
): Promise<EmployeeDocument | null> {
  await db.execute(
    `UPDATE employee_documents
     SET file_name = NULL, mime_type = NULL, size_bytes = NULL,
         uploaded_at = NULL, status = 'missing',
         reject_reason = NULL, verified_by = NULL,
         updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return getDocument(id, workspaceId)
}

/**
 * Record an admin's verification decision.
 *
 * `reject_reason` is written on every call so approving a previously rejected
 * document clears the stale explanation.
 */
export async function setDocumentReview(
  id: string,
  workspaceId: string,
  params: { status: DocumentStatus; reject_reason?: string | null; verifiedBy: string },
): Promise<EmployeeDocument | null> {
  await db.execute(
    `UPDATE employee_documents
     SET status = ?, reject_reason = ?, verified_by = ?, updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [params.status, params.reject_reason ?? null, params.verifiedBy, id, workspaceId],
  )
  return getDocument(id, workspaceId)
}

/** Rename a slot / relabel a document. Never touches the file itself. */
export async function updateDocumentMeta(
  id: string,
  workspaceId: string,
  params: { name?: string },
): Promise<EmployeeDocument | null> {
  if (params.name !== undefined) {
    await db.execute(
      `UPDATE employee_documents SET name = ?, updated_at = datetime('now')
       WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      [params.name, id, workspaceId],
    )
  }
  return getDocument(id, workspaceId)
}

/**
 * Retire a document's METADATA.
 *
 * The row is SOFT-deleted, so who uploaded what, and when, stays auditable.
 * The bytes are NOT touched here: the caller finishes the job with
 * `documentStore.delete`, because only the storage backend knows where they
 * live. Issuing `DELETE FROM employee_document_blobs` from this file would
 * work exactly once - the day the store becomes S3 it would delete nothing and
 * leak every object in the bucket.
 *
 * Mark-then-reap, in that order: the soft delete lands first, so the document
 * is unreachable (`getDocumentBlob` filters `deleted_at IS NULL`) even if the
 * byte deletion then fails. The worst case is orphaned bytes nobody can serve,
 * never a live row whose file has been shredded.
 *
 * Returns false when nothing was retired - an unknown id, or a row already
 * deleted - which the route turns into a 404.
 */
export async function deleteDocument(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.execute(
    `UPDATE employee_documents
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}

// ─── Blob access (lib/storage.ts only) ────────────────────────────────────────
//
// These three are the ONLY functions in the codebase that see base64. They are
// exported for DbBase64Store and nothing else - a route that imports them is
// bypassing the storage seam and defeating the S3 swap.

export interface DocumentBlobRow {
  data_base64: string
  mime_type: string | null
}

/**
 * Write (or replace) the bytes for a document.
 *
 * DELETE-then-INSERT rather than an upsert: `document_id` is UNIQUE, and this
 * keeps the statement portable across better-sqlite3 and libSQL without
 * relying on ON CONFLICT semantics matching in both.
 */
export async function insertDocumentBlob(
  workspaceId: string,
  documentId: string,
  dataBase64: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      `DELETE FROM employee_document_blobs WHERE document_id = ? AND workspace_id = ?`,
      [documentId, workspaceId],
    )
    await tx.execute(
      `INSERT INTO employee_document_blobs (id, document_id, workspace_id, data_base64)
       VALUES (?,?,?,?)`,
      [crypto.randomUUID().replace(/-/g, ''), documentId, workspaceId, dataBase64],
    )
  })
}

/**
 * Read the bytes plus the MIME type recorded on the metadata row.
 *
 * The join is what lets the store return a complete `{ bytes, mime }` without
 * the caller making a second round trip - and the metadata row is filtered on
 * `deleted_at IS NULL`, so a soft-deleted document is undownloadable even in
 * the window before its blob is cleared.
 */
export async function getDocumentBlob(
  workspaceId: string,
  documentId: string,
): Promise<DocumentBlobRow | null> {
  return db.queryOne<DocumentBlobRow>(
    `SELECT b.data_base64, d.mime_type
     FROM employee_document_blobs b
     JOIN employee_documents d ON d.id = b.document_id
     WHERE b.document_id = ? AND b.workspace_id = ? AND d.deleted_at IS NULL`,
    [documentId, workspaceId],
  )
}

export async function deleteDocumentBlob(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  await db.execute(
    `DELETE FROM employee_document_blobs WHERE document_id = ? AND workspace_id = ?`,
    [documentId, workspaceId],
  )
}
