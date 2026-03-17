import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { deleteSignalConfig } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string; signalId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, signalId } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await deleteSignalConfig(signalId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
