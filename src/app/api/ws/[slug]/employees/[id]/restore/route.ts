import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { restoreEmployee } from '@/lib/db/queries/employees'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; id: string }> }

// ─── POST /api/ws/[slug]/employees/[id]/restore ───────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Employees, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const ok = await restoreEmployee(id, ctx.workspace.id)
  if (!ok) return NextResponse.json({ error: 'Not found or not archived', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ success: true })
}
