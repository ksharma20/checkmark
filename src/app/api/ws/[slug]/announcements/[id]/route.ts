import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  softDeleteAnnouncement,
  softDeleteAttachmentsForAnnouncement,
} from '@/lib/db/queries/announcements'
import { announcementStore } from '@/lib/storage'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── DELETE /api/ws/[slug]/announcements/[id] ────────────────────────────────

/**
 * Retract an announcement. SOFT delete only - the row stays as the record of
 * what was posted, and the notifications already fanned out are untouched.
 * Deleting hides it from the admin list; it does not unsend what people
 * already have in their feed and on their phone, which is what the confirm
 * dialog says in so many words.
 *
 * Attachments go with it, and the ORDER is the mirror of the upload order:
 * metadata first, bytes second. Once the attachment row is soft-deleted
 * nothing can serve the file - the blob read joins that row and filters
 * `deleted_at IS NULL` - so a failure while clearing bytes leaves unreachable
 * orphans rather than a live row pointing at shredded bytes. The reverse order
 * would leave a downloadable URL on a notice that has been retracted, which is
 * not a retraction at all.
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Delete)
  if (!ctx) return forbidden()

  const deleted = await softDeleteAnnouncement(id, ctx.workspace.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Announcement not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const attachmentIds = await softDeleteAttachmentsForAnnouncement(ctx.workspace.id, id)
  for (const attachmentId of attachmentIds) {
    await announcementStore.delete(ctx.workspace.id, attachmentId)
  }

  return NextResponse.json({ ok: true })
}
