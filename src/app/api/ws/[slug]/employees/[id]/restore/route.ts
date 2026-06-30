import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { restoreEmployee } from '@/lib/db/queries/employees'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── POST /api/ws/[slug]/employees/[id]/restore ───────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const ok = await restoreEmployee(id, ctx.workspace.id)
  if (!ok) return NextResponse.json({ error: 'Not found or not archived', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ success: true })
}
