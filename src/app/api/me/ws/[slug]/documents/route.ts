/**
 * The employee's own document folder.
 *
 * Invariant #14: /me is self-only for every role, and the scope is decided by
 * the session user id with no role lookup at all. So there is no employee id
 * in this path and none is accepted from the body - the employee record is
 * resolved from `ctx.userId` via findEmployeeByUserId, and every query is
 * scoped to the record that comes back. A member can therefore never reach
 * another person's documents through this surface, whatever they send.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { findEmployeeByUserId } from '@/lib/db/queries/employees'
import {
  listEmployeeDocuments,
  findDocumentByKey,
  createDocument,
  clearDocumentFile,
  markDocumentUploaded,
  countEmployeeDocuments,
  DuplicateDocumentSlotError,
} from '@/lib/db/queries/documents'
import { getRateLimitCount, recordRateLimitHit } from '@/lib/db/queries/users'
import { parseDocumentUpload } from '@/lib/api/documents-upload'
import { documentStore } from '@/lib/storage'
import { documents as docCopy } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string }> }

/**
 * Upload budget for one member, per hour.
 *
 * 20 rather than the 10 the regularizations route uses: a new joiner filling
 * their folder in one sitting (ID, address, education, past payslips) is
 * normal traffic, and each retry after a rejection costs another hit. It still
 * caps a member at 40 MB/hour of writes.
 */
const UPLOAD_RATE_LIMIT = 20
const UPLOAD_RATE_WINDOW_MINUTES = 60

/**
 * Live slots one employee may hold.
 *
 * `doc_key` is member-chosen and every unseen key opens a new row, so without
 * a ceiling a member can mint slots until the workspace's storage is gone.
 * 40 is several times a realistic folder (ID proofs, address, education, past
 * employment, tax) and bounds one person at 40 x 2 MB = 80 MB. Replacing the
 * file in a slot they already own is never blocked by this.
 */
const MAX_DOCUMENT_SLOTS = 40

/**
 * Product copy for the two rejections a user can actually cause.
 *
 * parseDocumentUpload returns its own English so it stays free of the locale
 * table; the route is the layer that speaks to a person, so it swaps in the
 * strings the UI shows everywhere else and leaves the machine `code` alone.
 */
const UPLOAD_ERROR_COPY: Record<string, string> = {
  FILE_TOO_LARGE: docCopy.errors.tooLarge,
  UNSUPPORTED_MEDIA_TYPE: docCopy.errors.unsupportedType,
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
}

function noProfile() {
  return NextResponse.json(
    { error: 'Employee profile not found', code: 'NOT_FOUND' },
    { status: 404 },
  )
}

// ─── GET /api/me/ws/[slug]/documents ──────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return unauthorized()

  const employee = await findEmployeeByUserId(ctx.workspace.id, ctx.userId)
  if (!employee) return noProfile()

  const documents = await listEmployeeDocuments(ctx.workspace.id, employee.id)
  return NextResponse.json({ documents })
}

// ─── POST /api/me/ws/[slug]/documents ─────────────────────────────────────────
// multipart: file, doc_key, name?
//
// Always owner='employee', status='pending'. The `owner` form field is ignored
// here on purpose: letting a member self-declare a document 'admin'/'issued'
// would let them mark their own upload as company-issued and skip verification
// entirely.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) return unauthorized()

  const employee = await findEmployeeByUserId(ctx.workspace.id, ctx.userId)
  if (!employee) return noProfile()

  // Checked BEFORE the body is read: a rate-limited caller should not get to
  // push 2 MB through the server first. Same mechanism as the regularizations
  // route - the shared rate_limit_log, keyed by user.
  const rateKey = `documents:${ctx.userId}`
  if (
    await getRateLimitCount(rateKey, 'document_upload', UPLOAD_RATE_WINDOW_MINUTES) >=
    UPLOAD_RATE_LIMIT
  ) {
    return NextResponse.json(
      { error: docCopy.errors.rateLimited, code: 'RATE_LIMITED' },
      { status: 429 },
    )
  }
  await recordRateLimitHit(rateKey, 'document_upload')

  const parsed = await parseDocumentUpload(req)
  if (!parsed.ok) {
    const { status, code, error } = parsed.failure
    return NextResponse.json({ error: UPLOAD_ERROR_COPY[code] ?? error, code }, { status })
  }
  const upload = parsed.upload

  const existing = await findDocumentByKey(ctx.workspace.id, employee.id, upload.docKey)

  // A verified document is settled: re-uploading over it would silently
  // invalidate a decision an admin already made, with no trace. The admin
  // deletes the slot if it genuinely needs replacing.
  if (existing?.status === 'verified') {
    return NextResponse.json(
      { error: docCopy.errors.alreadyVerified, code: 'ALREADY_VERIFIED' },
      { status: 409 },
    )
  }

  // ── Write order, as on the admin route ──────────────────────────────────────
  //
  // Bytes before the claim, never the reverse: metadata written first would
  // survive a failed blob write and leave the row advertising a download that
  // 404s, or - on a re-upload over a rejection - point the new file name at the
  // OLD bytes an admin already refused. See lib/db/queries/documents.ts for why
  // the two writes cannot simply share a transaction.
  let slotId: string
  if (existing) {
    const cleared = await clearDocumentFile(existing.id, ctx.workspace.id)
    if (!cleared) return noProfile()
    slotId = cleared.id
  } else {
    const slots = await countEmployeeDocuments(ctx.workspace.id, employee.id)
    if (slots >= MAX_DOCUMENT_SLOTS) {
      return NextResponse.json(
        { error: docCopy.errors.slotLimit(MAX_DOCUMENT_SLOTS), code: 'SLOT_LIMIT' },
        { status: 409 },
      )
    }

    try {
      const created = await createDocument({
        workspaceId: ctx.workspace.id,
        employeeId: employee.id,
        doc_key: upload.docKey,
        name: upload.name,
        owner: 'employee',
        status: 'missing',
      })
      slotId = created.id
    } catch (err) {
      if (err instanceof DuplicateDocumentSlotError) {
        return NextResponse.json(
          { error: docCopy.errors.duplicateSlot, code: 'DUPLICATE_SLOT' },
          { status: 409 },
        )
      }
      throw err
    }
  }

  await documentStore.put(ctx.workspace.id, slotId, upload.bytes, upload.mime)

  const document = await markDocumentUploaded(
    slotId,
    ctx.workspace.id,
    { file_name: upload.fileName, mime_type: upload.mime, size_bytes: upload.size },
    ctx.userId,
    'pending',
  )
  if (!document) return noProfile()

  return NextResponse.json({ document }, { status: existing ? 200 : 201 })
}
