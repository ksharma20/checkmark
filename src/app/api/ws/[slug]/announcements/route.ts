import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { createAnnouncement, listAnnouncements } from '@/lib/db/queries/announcements'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { notify } from '@/lib/notify'

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

  const announcements = await listAnnouncements(ctx.workspace.id)
  return NextResponse.json({ announcements })
}

// ─── POST /api/ws/[slug]/announcements ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Write)
  if (!ctx) return forbidden()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fields: FieldErrors = {}
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.body === 'string' ? body.body.trim() : ''

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

  // ── Order matters: the record FIRST, then the fan-out. ────────────────────
  //
  // A notification's `ref_id` points at the announcement row, so writing the
  // row first is the only order in which that pointer is ever valid. Crash
  // mid-fan-out and the announcement exists with some people notified and some
  // not: recoverable, and visible to the admin in the Posted list. The reverse
  // order would push a notification whose `ref_id` names a row that does not
  // exist - unrecoverable, and invisible until a member taps it.
  const announcement = await createAnnouncement({
    workspaceId: ctx.workspace.id,
    title,
    body: message,
    createdBy: ctx.userId,
  })

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

  // `delivered` is the size of the fan-out, not a count of confirmed writes -
  // `notify()` deliberately does not report per-recipient outcomes. It stays
  // exact for this type: `announcements` is locked on in `CATEGORY_DEFS`, so
  // neither the workspace switchboard nor a member mute can drop a row, and the
  // in-app write is unconditional. Only a database failure would make the two
  // disagree, and that is already invisible to the admin.
  return NextResponse.json({ announcement, delivered: recipients.length }, { status: 201 })
}
