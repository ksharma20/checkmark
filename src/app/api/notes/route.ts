import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { createNote, listNotes } from '@/lib/db/queries/notes'
import {
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  isNoteColor,
} from '@/lib/space'
import {
  bad,
  readJsonObject,
  readOptionalBoolean,
  readOptionalString,
  unauthorized,
} from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * `/api/notes` - the member's own notes.
 *
 * THERE IS NO WORKSPACE IN THIS PATH and no `userId` in any contract it
 * accepts. Both absences are structural: a note belongs to the account, not to
 * an organisation, and the only user this route will ever act for is the one
 * `getServerUser()` names - i.e. the `x-user-id` header the proxy sets from the
 * verified JWT (invariant 1). There is no field to forget to ignore.
 *
 * It sits at `/api/notes` rather than `/api/me/notes` for the same reason
 * `/api/me/presence-prefs` does not take a slug: putting it under
 * `/api/me/ws/[slug]/` would invite somebody to "fix" the missing slug by
 * giving it one it cannot use.
 */

const t = meSpace.notes

export async function GET() {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const notes = await listNotes(user.userId)
  return NextResponse.json({ notes })
}

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const title = readOptionalString(body.title, MAX_NOTE_TITLE_LEN)
  if (!title.ok) return bad(t.errorTitleTooLong(MAX_NOTE_TITLE_LEN), 'TITLE_TOO_LONG')

  const content = readOptionalString(body.content, MAX_NOTE_CONTENT_LEN, { nullable: false })
  if (!content.ok) return bad(t.errorContentTooLong(MAX_NOTE_CONTENT_LEN), 'CONTENT_TOO_LONG')

  const pinned = readOptionalBoolean(body.pinned)
  if (!pinned.ok) return bad(meSpace.saveFailed, 'INVALID_BODY')

  // The colour is an enum, not free text. The column carries a CHECK as well,
  // so this is the second line of defence rather than the only one - but a
  // CHECK violation surfaces as a 500, and "purple-ish is not a colour" is a
  // 400 the member's client can act on.
  const color = body.color === undefined ? 'default' : body.color
  if (!isNoteColor(color)) return bad(t.errorBadColour, 'INVALID_COLOR')

  /**
   * A note with neither a title nor any text is refused.
   *
   * Both columns are optional on their own - a title-only note is a heading a
   * member means to fill in, and a body-only note is the common case - so the
   * constraint is on the PAIR and no column default can express it. Without it
   * the "New note" button alone mints a permanent blank card that nothing on the
   * board distinguishes from a real note.
   */
  const titleValue = title.present ? title.value : null
  const contentValue = content.present ? (content.value ?? '') : ''
  if (!titleValue?.trim() && !contentValue.trim()) return bad(t.errorEmpty, 'EMPTY_NOTE')

  const note = await createNote({
    userId: user.userId,
    title: titleValue,
    content: contentValue,
    pinned: pinned.present ? pinned.value : false,
    color,
  })

  return NextResponse.json({ note }, { status: 201 })
}
