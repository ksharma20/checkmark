import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import {
  getLeaveTypeById,
  getWorkspaceLeaveTypes,
  softDeleteLeaveType,
  updateLeaveType,
} from '@/lib/db/queries/leaves'
import { Action, Resource } from '@/lib/permissions/catalogue'

type AccrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
const VALID_FREQUENCIES: AccrualFrequency[] = ['monthly', 'quarterly', 'half-yearly', 'yearly']

interface Props { params: Promise<{ slug: string; id: string }> }

/**
 * Partial update of one leave type.
 *
 * Validation deliberately MIRRORS the POST route rather than sharing a helper
 * with it: POST coerces a missing/invalid field to a default, which is right
 * when creating, but wrong when patching - a caller who omits `accrual_credits`
 * means "leave it alone", not "reset it to 1". So each field is only touched
 * when it is actually present in the body.
 */
export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Leaves, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: {
    name?: unknown
    accrual_frequency?: unknown
    accrual_credits?: unknown
    credit_timing?: unknown
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const existing = await getLeaveTypeById(id, ctx.workspace.id)
  if (!existing) {
    return NextResponse.json({ error: 'Leave type not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const input: {
    name?: string
    accrual_frequency?: AccrualFrequency
    accrual_credits?: number
    credit_timing?: 'start' | 'end'
  } = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'name is required', code: 'VALIDATION_ERROR' }, { status: 422 })
    }
    input.name = name
  }

  if (body.accrual_frequency !== undefined) {
    if (typeof body.accrual_frequency !== 'string'
      || !VALID_FREQUENCIES.includes(body.accrual_frequency as AccrualFrequency)) {
      return NextResponse.json(
        { error: 'accrual_frequency is not a valid accrual period', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    input.accrual_frequency = body.accrual_frequency as AccrualFrequency
  }

  if (body.accrual_credits !== undefined) {
    if (typeof body.accrual_credits !== 'number' || !Number.isFinite(body.accrual_credits) || body.accrual_credits < 1) {
      return NextResponse.json(
        { error: 'accrual_credits must be a number of at least 1', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    input.accrual_credits = Math.floor(body.accrual_credits)
  }

  if (body.credit_timing !== undefined) {
    if (body.credit_timing !== 'start' && body.credit_timing !== 'end') {
      return NextResponse.json(
        { error: 'credit_timing must be "start" or "end"', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    input.credit_timing = body.credit_timing
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: 'At least one field must be provided', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  // Same case-insensitive uniqueness rule as POST, but EXCLUDING this row -
  // otherwise saving a type without renaming it would 409 against itself.
  if (input.name) {
    const all = await getWorkspaceLeaveTypes(ctx.workspace.id)
    const clash = all.some(
      (t) => t.id !== id && t.name.toLowerCase() === input.name!.toLowerCase(),
    )
    if (clash) {
      return NextResponse.json(
        { error: 'A leave type with this name already exists', code: 'DUPLICATE' },
        { status: 409 },
      )
    }
  }

  try {
    const leaveType = await updateLeaveType(id, ctx.workspace.id, input)
    if (!leaveType) {
      return NextResponse.json({ error: 'Leave type not found', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ leaveType })
  } catch (err) {
    console.error('[leave-types PATCH]', err)
    return NextResponse.json({ error: 'Failed to update leave type', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

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
