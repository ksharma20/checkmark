import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { removeWorkspaceDomain } from '@/lib/db/queries/workspaces'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; domainId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const { slug, domainId } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Domains, Action.Delete)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await removeWorkspaceDomain(domainId, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
