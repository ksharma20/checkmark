import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { removeWorkspaceDomain } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string; domainId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, domainId } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await removeWorkspaceDomain(domainId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
