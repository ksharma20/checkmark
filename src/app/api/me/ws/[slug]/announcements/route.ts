/**
 * The member's read of workspace announcements.
 *
 * Read-only and membership-gated: an announcement is addressed to everyone in
 * the workspace, so `requireWsMember` is the whole entitlement - there is no
 * per-person scoping to apply and no permission to consult. Posting and
 * retracting stay on the admin surface behind `Resource.Announcements`.
 *
 * Attachments come back as METADATA ONLY. The bytes are reachable exclusively
 * through `.../attachments/[attachmentId]/file`, which returns a real body with
 * a Content-Type; nothing in this JSON ever carries a payload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { listAnnouncementsWithAttachments } from '@/lib/db/queries/announcements'

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/me/ws/[slug]/announcements ─────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Newest first, and two queries for the whole feed rather than one per row.
  const announcements = await listAnnouncementsWithAttachments(ctx.workspace.id)
  return NextResponse.json({ announcements })
}
