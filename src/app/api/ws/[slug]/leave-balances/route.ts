import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getAllOpeningBalances } from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/leave-balances ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const balances = await getAllOpeningBalances(ctx.workspace.id)
  return NextResponse.json({ balances })
}
