import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { softDeleteLeaveType } from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string; id: string }> }

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const deleted = await softDeleteLeaveType(id, ctx.workspace.id)
  if (!deleted) {
    return NextResponse.json({ error: 'Leave type not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
