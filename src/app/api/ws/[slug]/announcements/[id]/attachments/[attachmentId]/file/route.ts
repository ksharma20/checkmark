import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getAttachment } from '@/lib/db/queries/announcements'
import { announcementStore } from '@/lib/storage'
import { contentDispositionFilename } from '@/lib/api/documents-upload'

interface Props { params: Promise<{ slug: string; id: string; attachmentId: string }> }

// ─── GET /api/ws/[slug]/announcements/[id]/attachments/[attachmentId]/file ────
//
// One of the two routes that emit announcement-attachment bytes, and it emits
// them as a body, never inside JSON. Base64 in a JSON field would be logged by
// anything that logs response bodies, would sit in the browser's memory as a
// string, and would invite the frontend to build data: URLs out of it.
//
// Always `attachment`: an inline PDF or image renders in the tab, and a
// same-origin render of user-supplied content is the start of every stored-XSS
// story.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, id, attachmentId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Read)
  if (!ctx) return forbidden()

  // Both halves of the check matter. `getAttachment` scopes by workspace, so an
  // id from another workspace matches nothing; the `announcement_id` comparison
  // is what stops a valid id being served under the WRONG announcement in the
  // URL. A 404 rather than a 403 - a 403 would confirm the id is real.
  const attachment = await getAttachment(attachmentId, ctx.workspace.id)
  if (!attachment || attachment.announcement_id !== id) {
    return NextResponse.json({ error: 'Attachment not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const file = await announcementStore.get(ctx.workspace.id, attachmentId)
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded', code: 'NO_FILE' }, { status: 404 })
  }

  const filename = contentDispositionFilename(attachment.file_name)

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Workspace-private data; no shared cache should ever hold a copy.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
