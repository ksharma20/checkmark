import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { softDeleteNote, updateNote, type NotePatch } from '@/lib/db/queries/notes'
import { MAX_NOTE_CONTENT_LEN, MAX_NOTE_TITLE_LEN, isNoteColor } from '@/lib/space'
import {
  bad,
  notFound,
  readJsonObject,
  readOptionalBoolean,
  readOptionalString,
  unauthorized,
} from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * One note: `PATCH` to change it, `DELETE` to soft-delete it.
 *
 * The id comes from the URL and the user id from the session, and the two are
 * only ever used TOGETHER - `updateNote` and `softDeleteNote` both carry
 * `AND user_id = ?`, so an id belonging to somebody else matches nothing and is
 * answered 404 rather than 403. See `notFound()` in `src/lib/space-api.ts` for
 * why the weaker-looking status is the right one.
 */

interface Props {
  params: Promise<{ id: string }>
}

const t = meSpace.notes

export async function PATCH(request: Request, { params }: Props) {
  const user = await getServerUser()
  if (!user) return unauthorized()
  const { id } = await params

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const patch: NotePatch = {}

  const title = readOptionalString(body.title, MAX_NOTE_TITLE_LEN)
  if (!title.ok) return bad(t.errorTitleTooLong(MAX_NOTE_TITLE_LEN), 'TITLE_TOO_LONG')
  if (title.present) patch.title = title.value

  const content = readOptionalString(body.content, MAX_NOTE_CONTENT_LEN, { nullable: false })
  if (!content.ok) return bad(t.errorContentTooLong(MAX_NOTE_CONTENT_LEN), 'CONTENT_TOO_LONG')
  if (content.present && content.value !== null) patch.content = content.value

  const pinned = readOptionalBoolean(body.pinned)
  if (!pinned.ok) return bad(meSpace.saveFailed, 'INVALID_BODY')
  if (pinned.present) patch.pinned = pinned.value

  if (body.color !== undefined) {
    if (!isNoteColor(body.color)) return bad(t.errorBadColour, 'INVALID_COLOR')
    patch.color = body.color
  }

  const note = await updateNote(id, user.userId, patch)
  if (!note) return notFound()

  return NextResponse.json({ note })
}

export async function DELETE(_request: Request, { params }: Props) {
  const user = await getServerUser()
  if (!user) return unauthorized()
  const { id } = await params

  // Soft delete (invariant 5). `false` means the UPDATE matched nothing -
  // already deleted, never existed, or not this member's - and all three are
  // the same answer here.
  const deleted = await softDeleteNote(id, user.userId)
  if (!deleted) return notFound()

  return NextResponse.json({ ok: true })
}
