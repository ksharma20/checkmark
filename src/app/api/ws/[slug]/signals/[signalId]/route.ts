import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { deleteSignalConfig } from '@/lib/db/queries/workspaces'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; signalId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, signalId } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Signals, Action.Delete)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await deleteSignalConfig(signalId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
