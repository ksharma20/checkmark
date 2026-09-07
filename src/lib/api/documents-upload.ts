/**
 * Shared multipart handling for document uploads.
 *
 * Both surfaces upload documents - an admin against any employee at
 * /api/ws/[slug]/employees/[id]/documents, an employee against themselves at
 * /api/me/ws/[slug]/documents - and both must apply exactly the same size cap
 * and magic-byte allowlist. Divergence here is the kind that gets noticed only
 * after an SVG is stored through the softer of the two paths, so the check
 * lives once and both routes call it.
 *
 * This module returns plain data, never a NextResponse, so the routes stay in
 * charge of their own error shapes.
 */

import { MAX_FILE_BYTES, sniffMimeType, type AllowedMimeType } from '@/lib/storage'
import { isDocumentOwner, type DocumentOwner } from '@/lib/db/queries/documents'

export interface ParsedUpload {
  bytes: Buffer
  mime: AllowedMimeType
  fileName: string
  size: number
  /** Slot key from the form, e.g. `pan_card`. */
  docKey: string
  /** Human label for the slot; falls back to the key. */
  name: string
  /**
   * `owner` as sent by the client, or null when absent/invalid. Each route
   * decides its own default - the /me surface ignores it entirely, since an
   * employee can only ever be uploading an employee-owned document.
   */
  owner: DocumentOwner | null
}

export type UploadError =
  | { code: 'INVALID_BODY'; status: 400; error: string }
  | { code: 'MISSING_FILE'; status: 400; error: string }
  | { code: 'VALIDATION_ERROR'; status: 422; error: string }
  | { code: 'FILE_TOO_LARGE'; status: 413; error: string }
  | { code: 'UNSUPPORTED_MEDIA_TYPE'; status: 415; error: string }

export type UploadResult =
  | { ok: true; upload: ParsedUpload }
  | { ok: false; failure: UploadError }

const DOC_KEY_RE = /^[a-z0-9_]{1,64}$/

/**
 * Pull `file`, `doc_key` and optional `name` out of a multipart body.
 *
 * The MIME type is derived from the file's leading bytes, NOT from
 * `File.type`: the browser-supplied string is attacker-controlled, so trusting
 * it would let an HTML document be stored as `image/png` and later served back
 * with a Content-Type that makes a browser execute it.
 *
 * The size is checked twice - once against `File.size` before reading, so a
 * huge upload is rejected without buffering it, and once against the actual
 * buffer length, because `File.size` is metadata like any other.
 */
export async function parseDocumentUpload(req: Request): Promise<UploadResult> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return { ok: false, failure: { code: 'INVALID_BODY', status: 400, error: 'Invalid form data' } }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { ok: false, failure: { code: 'MISSING_FILE', status: 400, error: 'No file provided' } }
  }

  const docKeyRaw = formData.get('doc_key')
  const docKey = typeof docKeyRaw === 'string' ? docKeyRaw.trim().toLowerCase() : ''
  if (!DOC_KEY_RE.test(docKey)) {
    return {
      ok: false,
      failure: {
        code: 'VALIDATION_ERROR',
        status: 422,
        error: 'doc_key is required and must be lowercase letters, digits or underscores',
      },
    }
  }

  const nameRaw = formData.get('name')
  const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : docKey

  // Read here, decided by the caller: the body can only be consumed once, so
  // every field a route might want has to come out of this single pass.
  const ownerRaw = formData.get('owner')

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      failure: { code: 'FILE_TOO_LARGE', status: 413, error: 'File exceeds the 2 MB limit' },
    }
  }

  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()))
  if (bytes.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      failure: { code: 'FILE_TOO_LARGE', status: 413, error: 'File exceeds the 2 MB limit' },
    }
  }
  if (bytes.length === 0) {
    return { ok: false, failure: { code: 'VALIDATION_ERROR', status: 422, error: 'File is empty' } }
  }

  const mime = sniffMimeType(bytes)
  if (!mime) {
    return {
      ok: false,
      failure: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        status: 415,
        error: 'Only PDF, PNG and JPEG files are accepted',
      },
    }
  }

  return {
    ok: true,
    upload: {
      bytes,
      mime,
      // Strip any directory component: a filename is stored and later echoed
      // in Content-Disposition, and `../` in it belongs to nobody.
      fileName: file.name.split(/[\\/]/).pop()?.slice(0, 255) || `upload.${mime.split('/')[1]}`,
      size: bytes.length,
      docKey,
      name,
      owner: isDocumentOwner(ownerRaw) ? ownerRaw : null,
    },
  }
}

/** Sanitise a filename for a Content-Disposition header. */
export function contentDispositionFilename(fileName: string | null): string {
  const safe = (fileName ?? 'document').replace(/[^\w.\- ]+/g, '_').slice(0, 200)
  return safe || 'document'
}
