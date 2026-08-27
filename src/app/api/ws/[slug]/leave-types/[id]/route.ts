import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { softDeleteLeaveType } from '@/lib/db/queries/leaves'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; id: string }> }

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Leaves, Action.Delete)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const deleted = await softDeleteLeaveType(id, ctx.workspace.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Leave type not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
