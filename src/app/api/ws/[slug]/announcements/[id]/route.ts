import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { softDeleteAnnouncement } from '@/lib/db/queries/announcements'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── DELETE /api/ws/[slug]/announcements/[id] ────────────────────────────────

/**
 * Retract an announcement. SOFT delete only - the row stays as the record of
 * what was posted, and the notifications already fanned out are untouched.
 * Deleting hides it from the admin list; it does not unsend what people
 * already have in their feed and on their phone, which is what the confirm
 * dialog says in so many words.
 */
export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Announcements, Action.Delete)
  if (!ctx) return forbidden()

  const deleted = await softDeleteAnnouncement(id, ctx.workspace.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Announcement not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
