import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getEmployee } from '@/lib/db/queries/employees'
import {
  listEmployeeDocuments,
  findDocumentByKey,
  createDocument,
  clearDocumentFile,
  markDocumentUploaded,
  DuplicateDocumentSlotError,
} from '@/lib/db/queries/documents'
import { parseDocumentUpload } from '@/lib/api/documents-upload'
import { documentStore } from '@/lib/storage'
import { documents as docCopy } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string; id: string }> }

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

// ─── GET /api/ws/[slug]/employees/[id]/documents ──────────────────────────────
// Metadata only. Bytes are served by .../[docId]/file.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Read)
  if (!ctx) return forbidden()

  const employee = await getEmployee(id, ctx.workspace.id)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const documents = await listEmployeeDocuments(ctx.workspace.id, id)
  return NextResponse.json({ documents })
}

// ─── POST /api/ws/[slug]/employees/[id]/documents ─────────────────────────────
// multipart: file, doc_key, name?, owner?
//
// Uploading into an occupied slot REPLACES the file on the existing row rather
// than inserting a second one - the partial unique index on
// (workspace_id, employee_id, doc_key) would reject the insert anyway, and a
// slot is a slot: "PAN card" has one current version. Two uploads racing for
// the same new slot are answered 409, not 500: the index, not the lookup, is
// what actually decides the winner.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Write)
  if (!ctx) return forbidden()

  const employee = await getEmployee(id, ctx.workspace.id)
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const parsed = await parseDocumentUpload(req)
  if (!parsed.ok) {
    const { status, code, error } = parsed.failure
    return NextResponse.json({ error: UPLOAD_ERROR_COPY[code] ?? error, code }, { status })
  }
  const upload = parsed.upload

  // Default 'admin': a file uploaded through the admin surface is one the
  // company is issuing, so there is nothing for an admin to verify about it.
  // An explicit owner=employee marks a slot an admin filled in on someone's
  // behalf, which still needs verifying.
  const owner = upload.owner ?? 'admin'
  const status = owner === 'admin' ? 'issued' : 'pending'

  const existing = await findDocumentByKey(ctx.workspace.id, id, upload.docKey)

  // ── The write order is the correctness argument here ────────────────────────
  //
  // Three writes cannot be one transaction: the blob write and the metadata
  // write are separate statements today, and under an S3 store they would be
  // separate systems - `db.transaction()` could never cover the PUT. (It would
  // not even cover these two: the SQLite path in lib/db/index.ts runs BEGIN on
  // one shared connection and awaits inside it, and insertDocumentBlob already
  // opens its own transaction, so nesting either interleaves or throws.)
  //
  // So the sequence is ordered instead: a row NEVER names bytes that are not
  // stored. Empty the slot's claim, write the bytes, then claim them. A crash
  // at any point leaves either an empty slot or the truth - never a download
  // that 404s, and never yesterday's rejected file wearing today's name.
  let slotId: string
  if (existing) {
    const cleared = await clearDocumentFile(existing.id, ctx.workspace.id)
    if (!cleared) {
      return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    slotId = cleared.id
  } else {
    try {
      // Deliberately created EMPTY: file_name stays NULL and the status is
      // 'missing' until the bytes land, so a failed put leaves an honest empty
      // slot the next upload reuses.
      const created = await createDocument({
        workspaceId: ctx.workspace.id,
        employeeId: id,
        doc_key: upload.docKey,
        name: upload.name,
        owner,
        status: 'missing',
      })
      slotId = created.id
    } catch (err) {
      // Lost the race against a concurrent upload into the same slot.
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
    status,
  )
  if (!document) {
    return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ document }, { status: existing ? 200 : 201 })
}
