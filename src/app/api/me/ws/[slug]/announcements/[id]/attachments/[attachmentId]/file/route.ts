/**
 * Download the file attached to an announcement, as a member.
 *
 * An announcement is addressed to the whole workspace, so unlike the employee
 * document routes there is no per-person ownership to check - membership IS the
 * entitlement, and `requireWsMember` is what establishes it. What still has to
 * be checked is that the attachment belongs to the announcement AND the
 * workspace named in the URL: the ids come from the client, and a valid id
 * served under the wrong announcement would be a cross-tenant read.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getAnnouncement, getAttachment } from '@/lib/db/queries/announcements'
import { announcementStore } from '@/lib/storage'
import { contentDispositionFilename } from '@/lib/api/documents-upload'

interface Props { params: Promise<{ slug: string; id: string; attachmentId: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, id, attachmentId } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // The announcement is loaded as well as the attachment: a retracted notice
  // soft-deletes the announcement row, and without this its files would stay
  // downloadable by anyone holding the URL.
  const announcement = await getAnnouncement(id, ctx.workspace.id)
  const attachment = await getAttachment(attachmentId, ctx.workspace.id)
  if (!announcement || !attachment || attachment.announcement_id !== id) {
    return NextResponse.json({ error: 'Attachment not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const file = await announcementStore.get(ctx.workspace.id, attachmentId)
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded', code: 'NO_FILE' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `attachment; filename="${contentDispositionFilename(attachment.file_name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
