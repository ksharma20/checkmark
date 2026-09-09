import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  createAnnouncement,
  createAttachment,
  listAnnouncementsWithAttachments,
  markAttachmentUploaded,
} from '@/lib/db/queries/announcements'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { notify } from '@/lib/notify'
import { announcementStore, MAX_FILE_BYTES, sniffMimeType } from '@/lib/storage'
import { wsAnnouncements as t } from '@/locales/en/ws-announcements'

interface Props { params: Promise<{ slug: string }> }

/** Same shape as the employees routes' 422: a per-field code map. */
type FieldErrors = Record<string, string>

const MAX_TITLE_LEN = 200
const MAX_BODY_LEN = 4000

// ─── GET /api/ws/[slug]/announcements ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Read)
  if (!ctx) return forbidden()

  // Two queries for the whole list, never one per row - see
  // `listAnnouncementsWithAttachments`. Metadata only: no bytes, no base64.
  const announcements = await listAnnouncementsWithAttachments(ctx.workspace.id)
  return NextResponse.json({ announcements })
}

// ─── POST /api/ws/[slug]/announcements ───────────────────────────────────────

/**
 * The parsed body, whichever content type it arrived as.
 *
 * JSON and multipart are the same announcement; the only difference is that
 * multipart may carry one file. The JSON path is NOT deprecated - it is what
 * every existing caller uses, and a composer with no attachment still takes it.
 */
interface ParsedPost {
  title: string
  message: string
  file: { bytes: Buffer; mime: string; fileName: string } | null
}

type PostFailure = { error: string; code: string; status: number; fields?: FieldErrors }

/**
 * Read a multipart body once and pull everything out of it.
 *
 * `parseDocumentUpload` is deliberately NOT reused here: it requires a
 * `doc_key` (a document slot key, which an announcement has no concept of) and
 * a request body can only be consumed once, so it could not hand back the
 * `title` and `body` fields this route also needs from the same FormData. The
 * checks it performs are mirrored exactly, and the two things worth keeping in
 * one place - `MAX_FILE_BYTES` and the magic-byte allowlist in
 * `sniffMimeType()` - are imported rather than restated.
 */
async function parseMultipart(req: NextRequest): Promise<ParsedPost | PostFailure> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return { error: 'Invalid form data', code: 'INVALID_BODY', status: 400 }
  }

  const titleRaw = form.get('title')
  const bodyRaw = form.get('body')
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : ''
  const message = typeof bodyRaw === 'string' ? bodyRaw.trim() : ''

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    // An attachment is optional; an absent one is not an error.
    return { title, message, file: null }
  }

  // Checked twice, exactly as the document path does: once against the
  // declared size so an oversized upload is refused without buffering it, and
  // once against the real buffer, because `File.size` is metadata like any
  // other and metadata is not evidence.
  if (file.size > MAX_FILE_BYTES) {
    return { error: t.attachmentTooLarge, code: 'FILE_TOO_LARGE', status: 413 }
  }
  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()))
  if (bytes.length > MAX_FILE_BYTES) {
    return { error: t.attachmentTooLarge, code: 'FILE_TOO_LARGE', status: 413 }
  }

  // NEVER `File.type`. That string is chosen by the client, so a .txt renamed
  // to .pdf - or an HTML payload announced as image/png - would be stored and
  // later served back under a Content-Type a browser is willing to execute.
  // The leading bytes are the only thing here that is not attacker-supplied.
  const mime = sniffMimeType(bytes)
  if (!mime) {
    return { error: t.attachmentUnsupported, code: 'UNSUPPORTED_MEDIA_TYPE', status: 415 }
  }

  return {
    title,
    message,
    file: {
      bytes,
      mime,
      // Strip any directory component: the filename is stored and later echoed
      // in Content-Disposition, and `../` in it belongs to nobody.
      fileName: file.name.split(/[\\/]/).pop()?.slice(0, 255) || `attachment.${mime.split('/')[1]}`,
    },
  }
}

async function parseJson(req: NextRequest): Promise<ParsedPost | PostFailure> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return { error: 'Invalid JSON body', code: 'INVALID_BODY', status: 400 }
  }
  return {
    title: typeof body.title === 'string' ? body.title.trim() : '',
    message: typeof body.body === 'string' ? body.body.trim() : '',
    file: null,
  }
}

function isFailure(parsed: ParsedPost | PostFailure): parsed is PostFailure {
  return 'status' in parsed
}

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Write)
  if (!ctx) return forbidden()

  // The composer posts multipart only when it has a file to send; everything
  // else - and every existing caller - keeps posting JSON.
  const contentType = req.headers.get('content-type') ?? ''
  const parsed = contentType.includes('multipart/form-data')
    ? await parseMultipart(req)
    : await parseJson(req)

  if (isFailure(parsed)) {
    const { status, ...payload } = parsed
    return NextResponse.json(payload, { status })
  }

  const { title, message, file } = parsed

  const fields: FieldErrors = {}
  if (!title) fields.title = 'REQUIRED'
  else if (title.length > MAX_TITLE_LEN) fields.title = 'TOO_LONG'
  if (!message) fields.body = 'REQUIRED'
  else if (message.length > MAX_BODY_LEN) fields.body = 'TOO_LONG'

  if (Object.keys(fields).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 422 },
    )
  }

  // ── The write order IS the correctness argument. ──────────────────────────
  //
  //   1. createAnnouncement()      the record first
  //   2. createAttachment()        an EMPTY slot - file_name still NULL
  //   3. announcementStore.put()   the bytes
  //   4. markAttachmentUploaded()  only NOW does the row claim the file
  //   5. notify()                  the fan-out, last
  //
  // Every crash point leaves either an honest empty slot or the truth. A
  // notification's `ref_id` points at the announcement row, so writing that row
  // first is the only order in which the pointer is ever valid; and notifying
  // last is the only order in which a member who taps through is guaranteed to
  // find the file the notice mentions. The reverse of either would be
  // unrecoverable and invisible until somebody tapped it.
  const announcement = await createAnnouncement({
    workspaceId: ctx.workspace.id,
    title,
    body: message,
    createdBy: ctx.userId,
  })

  if (file) {
    const attachment = await createAttachment({
      workspaceId: ctx.workspace.id,
      announcementId: announcement.id,
      name: file.fileName,
      uploadedBy: ctx.userId,
    })
    await announcementStore.put(ctx.workspace.id, attachment.id, file.bytes, file.mime)
    await markAttachmentUploaded(attachment.id, ctx.workspace.id, {
      file_name: file.fileName,
      mime_type: file.mime,
      size_bytes: file.bytes.length,
    })
  }

  const recipients = await getActiveMemberIds(ctx.workspace.id)

  // The whole roster in ONE call. `notify()` reads the workspace switchboard and
  // the mute set once per call, so fanning out member-by-member would re-read
  // both once per recipient - the difference between two queries and two
  // thousand for a large workspace.
  //
  // Delivery stays best-effort inside `notify()`: a member with no push
  // subscription, a dead endpoint or missing VAPID keys must not fail an
  // announcement that is already durably recorded.
  await notify({
    userIds: recipients,
    workspaceId: ctx.workspace.id,
    workspaceSlug: slug,
    type: 'announcement',
    title,
    body: message,
    refId: announcement.id,
    refType: 'announcement',
    push: { tag: `announcement-${announcement.id}` },
  })

  // Re-read so the response carries the byline and the attachment in exactly
  // the shape the list endpoint returns - the composer prepends this object
  // straight into its list, and a second shape there is a second renderer.
  const listed = (await listAnnouncementsWithAttachments(ctx.workspace.id))
    .find((a) => a.id === announcement.id)
  const created = listed ?? { ...announcement, author_name: null, attachments: [] }

  // `delivered` is the size of the fan-out, not a count of confirmed writes -
  // `notify()` deliberately does not report per-recipient outcomes. It stays
  // exact for this type: `announcements` is locked on in `CATEGORY_DEFS`, so
  // neither the workspace switchboard nor a member mute can drop a row, and the
  // in-app write is unconditional. Only a database failure would make the two
  // disagree, and that is already invisible to the admin.
  return NextResponse.json(
    { announcement: created, delivered: recipients.length },
    { status: 201 },
  )
}
