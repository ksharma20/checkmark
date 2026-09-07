import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  getDocument,
  setDocumentReview,
  updateDocumentMeta,
  deleteDocument,
} from '@/lib/db/queries/documents'
import { documentStore } from '@/lib/storage'
import { getEmployee } from '@/lib/db/queries/employees'
import { notify } from '@/lib/notify'
import { documentNotifications } from '@/locales/en/notifications'

interface Props { params: Promise<{ slug: string; id: string; docId: string }> }

function notFound() {
  return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
}

// ─── PATCH /api/ws/[slug]/employees/[id]/documents/[docId] ────────────────────
// Body: { status: 'verified' | 'rejected', reject_reason? } and/or { name }
//
// The verification decision and the label are the only mutable parts of a
// document. Replacing the FILE is a POST to the collection, which re-uses the
// slot - so the bytes and the review state can never disagree about which
// upload was approved.

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id, docId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Write)
  if (!ctx) return forbidden()

  const existing = await getDocument(docId, ctx.workspace.id)
  // The employee id in the path is part of the resource identity, so a docId
  // that belongs to a different employee is a 404, not a silent success.
  if (!existing || existing.employee_id !== id) return notFound()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const hasStatus = 'status' in body
  const hasName = 'name' in body

  if (!hasStatus && !hasName) {
    return NextResponse.json(
      { error: 'At least one of status or name is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  let document = existing

  if (hasName) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json(
        { error: 'name must be a non-empty string', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    const updated = await updateDocumentMeta(docId, ctx.workspace.id, { name })
    if (!updated) return notFound()
    document = updated
  }

  if (hasStatus) {
    // Only the two review verdicts are settable here. 'missing', 'pending' and
    // 'issued' are consequences of upload, not decisions an admin makes.
    if (body.status !== 'verified' && body.status !== 'rejected') {
      return NextResponse.json(
        { error: 'status must be "verified" or "rejected"', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }

    if (!existing.file_name) {
      return NextResponse.json(
        { error: 'Cannot review a document with no file', code: 'NO_FILE' },
        { status: 409 },
      )
    }

    const rejectReason =
      body.status === 'rejected'
        ? typeof body.reject_reason === 'string' ? body.reject_reason.trim() : ''
        : null

    if (body.status === 'rejected' && !rejectReason) {
      return NextResponse.json(
        { error: 'reject_reason is required when rejecting', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }

    const updated = await setDocumentReview(docId, ctx.workspace.id, {
      status: body.status,
      reject_reason: rejectReason,
      verifiedBy: ctx.userId,
    })
    if (!updated) return notFound()
    document = updated

    await notifyEmployeeOfReview(ctx.workspace.id, slug, id, updated)
  }

  return NextResponse.json({ document })
}

/**
 * Tell the employee what happened to their document.
 *
 * The verdict used to be written to the row and announced to nobody: an
 * employee could have their ID proof rejected and only find out by opening
 * `/me/documents` and noticing the slot had gone red - which, for a rejection
 * with a reason attached, is the one case where silence is most expensive.
 *
 * Two ways this legitimately sends nothing, both silent by design:
 *   - the employee record has no `user_id` yet (a document can be filed for
 *     somebody who has not accepted their invitation), so there is no account
 *     to notify;
 *   - the notification or the push fails.
 * Neither may fail the request - the review decision is already committed, and
 * a 500 here would invite the admin to press the button again.
 */
async function notifyEmployeeOfReview(
  workspaceId: string,
  slug: string,
  employeeId: string,
  document: { id: string; name: string; status: string; reject_reason: string | null },
): Promise<void> {
  try {
    const employee = await getEmployee(employeeId, workspaceId)
    const userId = employee?.user_id
    if (!userId) return

    const isVerified = document.status === 'verified'
    const type = isVerified ? ('document_verified' as const) : ('document_rejected' as const)
    const title = isVerified
      ? documentNotifications.verifiedTitle
      : documentNotifications.rejectedTitle
    const body = isVerified
      ? documentNotifications.verifiedBody(document.name)
      : document.reject_reason
        ? documentNotifications.rejectedBody(document.name, document.reject_reason)
        : documentNotifications.rejectedBodyNoReason(document.name)
    await notify({
      userIds: [userId],
      workspaceId,
      workspaceSlug: slug,
      type,
      title,
      body,
      refId: document.id,
      refType: 'employee_document',
      push: { tag: `document-${type}-${document.id}` },
    })
  } catch { /* notification failure must not fail the review */ }
}

// ─── DELETE /api/ws/[slug]/employees/[id]/documents/[docId] ───────────────────
// Soft-deletes the metadata, then hard-deletes the bytes through the storage
// seam - the only thing that knows where bytes actually live. In that order:
// once the row is soft-deleted nothing can serve the file (getDocumentBlob
// filters deleted_at), so a failed byte delete leaves unreachable orphans
// rather than a live row with a shredded file.

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id, docId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Delete)
  if (!ctx) return forbidden()

  const existing = await getDocument(docId, ctx.workspace.id)
  if (!existing || existing.employee_id !== id) return notFound()

  const deleted = await deleteDocument(docId, ctx.workspace.id)
  if (!deleted) return notFound()

  await documentStore.delete(ctx.workspace.id, docId)

  return NextResponse.json({ success: true })
}
