import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { updateWorkspace } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  return NextResponse.json({
    name: ctx.workspace.name,
    display_timezone: ctx.workspace.display_timezone,
    archived_at: ctx.workspace.archived_at,
    allow_remote: !!ctx.workspace.allow_remote,
  })
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { name?: string; displayTimezone?: string; allowRemote?: boolean }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const updates: { name?: string; display_timezone?: string; allow_remote?: number } = {}
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.displayTimezone?.trim()) updates.display_timezone = body.displayTimezone.trim()
  if (body.allowRemote !== undefined) updates.allow_remote = body.allowRemote ? 1 : 0

  if (Object.keys(updates).length > 0) {
    await updateWorkspace(ctx.workspace.id, updates)
  }

  return NextResponse.json({ success: true })
}
