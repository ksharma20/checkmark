/**
 * The document storage seam.
 *
 * Employee documents are small, private files (offer letters, ID scans,
 * payslips). Today they live in the database as base64 TEXT, which keeps the
 * whole product on a single Turso connection with no bucket, no signed URLs
 * and no second failure domain to operate. That is a deliberate trade for the
 * current scale, not a permanent decision - so every byte enters and leaves
 * through the `DocumentStore` interface below. Swapping in an S3-backed
 * implementation is then a config change plus one new class in this file,
 * touching no query file and no route.
 *
 * Two rules keep that seam honest:
 *
 *   1. Nothing outside this file and `db/queries/documents.ts` may see base64.
 *      Callers hand over and receive `Buffer`. If a route ever string-handles
 *      the payload, the S3 swap stops being a one-file change.
 *   2. Bytes and metadata live in separate tables. `employee_documents` is
 *      listed on every folder view; `employee_document_blobs` is read only
 *      when someone actually downloads a file. A join would drag megabytes
 *      through every list query.
 *   3. Every byte that is written OR removed goes through this interface,
 *      `delete` included. A raw `DELETE FROM employee_document_blobs` in a
 *      query file reads as harmless today and deletes nothing at all the day
 *      the store is S3 - the metadata disappears and the object leaks forever.
 *
 * Ordering, since the two halves cannot share a transaction (the DB store's
 * blob write and the metadata write are separate statements, and an S3 PUT
 * could never join a SQL transaction at all):
 *
 *   upload  put() FIRST, then let the metadata row claim the file. A row must
 *           never name bytes that are not stored yet. Replacing an occupied
 *           slot therefore drops the old claim before overwriting, so a crash
 *           leaves an empty slot rather than an old file under a new name.
 *   delete  Soft-delete the metadata FIRST, then delete(). A crash then leaves
 *           bytes nobody can reach, rather than a live row with no file.
 *
 * Both orderings fail towards "no file", which every surface already handles,
 * and away from "a file that is not what the row says it is", which nothing
 * can detect after the fact.
 *
 * Chunking: none, on purpose. A 2.79 MB base64 row (≈2 MB raw, the cap below)
 * has been verified to round-trip through Turso intact, so splitting payloads
 * across rows would add reassembly logic to buy nothing. If the cap is ever
 * raised past Turso's row/response limits, that is the moment to reach for S3
 * rather than for a chunking scheme.
 */

import {
  insertDocumentBlob,
  getDocumentBlob,
  deleteDocumentBlob,
} from './db/queries/documents'

/** Hard ceiling on a single upload, matching the holiday-import limit. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024

/**
 * The only MIME types an employee document may be.
 *
 * Enforced by sniffing magic bytes, never by trusting the browser-supplied
 * `File.type` - that string is attacker-controlled and would let an HTML or
 * SVG payload be stored and later served back under a benign Content-Type.
 */
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/**
 * Identify a buffer by its leading bytes.
 *
 * Returns null for anything not on the allowlist, which the caller turns into
 * a 415. Signatures:
 *   PDF  `%PDF`
 *   PNG  \x89 P N G \r \n \x1a \n
 *   JPEG \xFF \xD8 \xFF
 */
export function sniffMimeType(bytes: Buffer): AllowedMimeType | null {
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString('latin1') === '%PDF') {
    return 'application/pdf'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

/**
 * A workspace logo is smaller than a document and has a narrower type set.
 *
 * 512 KB rather than 2 MB: this is a mark rendered at roughly 32px in a top
 * bar, and the whole row is read on the request that serves it. A 2 MB logo
 * would be a 2 MB read every time somebody loads the app shell.
 */
export const MAX_LOGO_BYTES = 512 * 1024

export const ALLOWED_LOGO_MIME_TYPES = ['image/png', 'image/jpeg'] as const
export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number]

/**
 * Identify a logo by its leading bytes, reusing the one signature table above.
 *
 * PDF is on the document allowlist and is deliberately NOT a logo. **SVG is not
 * here and must not be added**: it is markup, and serving attacker-supplied
 * markup from our own origin is a stored-XSS primitive - the sniffing that
 * protects the document path cannot protect against a file whose danger is its
 * legitimate content. If vector logos are ever wanted, rasterise on upload or
 * serve them from a separate origin.
 */
export function sniffLogoMimeType(bytes: Buffer): AllowedLogoMimeType | null {
  const mime = sniffMimeType(bytes)
  return mime === 'image/png' || mime === 'image/jpeg' ? mime : null
}

/**
 * Where document bytes live.
 *
 * `workspaceId` is a parameter on every method rather than being implied by
 * the document id: it keeps the tenant boundary visible at the storage layer
 * (an S3 implementation would use it as a key prefix) and lets the DB
 * implementation scope its queries the way every other query in the codebase
 * does.
 */
export interface DocumentStore {
  put(workspaceId: string, documentId: string, bytes: Buffer, mime: string): Promise<{ size: number }>
  get(workspaceId: string, documentId: string): Promise<{ bytes: Buffer; mime: string } | null>
  delete(workspaceId: string, documentId: string): Promise<void>
}

/**
 * The database-backed store: base64 TEXT in `employee_document_blobs`.
 *
 * The MIME type is NOT stored here - it lives on the metadata row, which is
 * the only thing a list query reads. `get` takes it back from that row so the
 * interface can hand callers a complete answer without them needing to fetch
 * metadata separately.
 */
class DbBase64Store implements DocumentStore {
  async put(
    workspaceId: string,
    documentId: string,
    bytes: Buffer,
    // Unused by THIS implementation - the type is already on the metadata row,
    // so storing it twice would give it two places to disagree. It stays in the
    // signature because an S3 store needs it for the object's Content-Type.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mime: string,
  ): Promise<{ size: number }> {
    await insertDocumentBlob(workspaceId, documentId, bytes.toString('base64'))
    return { size: bytes.length }
  }

  async get(
    workspaceId: string,
    documentId: string,
  ): Promise<{ bytes: Buffer; mime: string } | null> {
    const row = await getDocumentBlob(workspaceId, documentId)
    if (!row) return null
    return {
      bytes: Buffer.from(row.data_base64, 'base64'),
      // Fall back to a generic type rather than guessing: the browser then
      // downloads instead of rendering, which is the safe default anyway.
      mime: row.mime_type ?? 'application/octet-stream',
    }
  }

  async delete(workspaceId: string, documentId: string): Promise<void> {
    await deleteDocumentBlob(workspaceId, documentId)
  }
}

/**
 * The process-wide store. A future S3 implementation is selected here, by
 * config, so no call site changes.
 */
export const documentStore: DocumentStore = new DbBase64Store()
