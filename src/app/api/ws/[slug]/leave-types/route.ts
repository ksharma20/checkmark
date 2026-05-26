import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceLeaveTypes, createLeaveType } from '@/lib/db/queries/leaves'

type AcrrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
const VALID_FREQUENCIES: AcrrualFrequency[] = ['monthly', 'quarterly', 'half-yearly', 'yearly']

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const leaveTypes = await getWorkspaceLeaveTypes(ctx.workspace.id)
  return NextResponse.json({ leaveTypes })
}

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { name?: unknown; accrual_frequency?: unknown; accrual_credits?: unknown; credit_timing?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json(
      { error: 'name is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const freq = typeof body.accrual_frequency === 'string' && VALID_FREQUENCIES.includes(body.accrual_frequency as AcrrualFrequency)
    ? body.accrual_frequency as AcrrualFrequency
    : 'monthly'
  const creditTiming = body.credit_timing === 'end' ? 'end' : 'start'
  const credits =
    typeof body.accrual_credits === 'number' && body.accrual_credits >= 1
      ? Math.floor(body.accrual_credits)
      : 1

  const existing = await getWorkspaceLeaveTypes(ctx.workspace.id)
  if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: 'A leave type with this name already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  try {
    const leaveType = await createLeaveType({
      workspaceId: ctx.workspace.id,
      name,
      accrualFrequency: freq,
      creditTiming,
      accrualCredits: credits,
    })
    return NextResponse.json({ leaveType }, { status: 201 })
  } catch (err) {
    console.error('[leave-types POST]', err)
    return NextResponse.json({ error: 'Failed to create leave type', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
