import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { deleteAdminOverride } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string; eventId: string }> }

/**
 * DELETE /api/ws/[slug]/disputes/[eventId]
 * Removes the admin override for an event (reverts to "not counted").
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, eventId } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const deleted = await deleteAdminOverride(ctx.workspace.id, eventId)
  if (!deleted) {
    return NextResponse.json({ error: 'Override not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
