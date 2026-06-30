import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { findEmployeeByUserId, updateEmployee } from '@/lib/db/queries/employees'
import { validateEmployeeFields } from '@/app/api/ws/[slug]/employees/_validate'

interface Props { params: Promise<{ slug: string }> }

// Fields a user may self-edit — work/employment fields are admin-only
const ALLOWED_SELF_EDIT = new Set([
  'first_name', 'last_name',
  'phone', 'alternate_phone', 'personal_email',
  'date_of_birth', 'gender', 'marital_status', 'number_of_children', 'blood_group',
  'current_address', 'permanent_address',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
  'pan', 'aadhaar', 'uan', 'passport_number',
  'bank_account', 'bank_ifsc', 'bank_name',
])

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const employee = await findEmployeeByUserId(ctx.workspace.id, ctx.userId)
  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const existing = await findEmployeeByUserId(ctx.workspace.id, ctx.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Employee profile not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  // Strip any fields the user is not allowed to self-edit
  const allowed: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (ALLOWED_SELF_EDIT.has(key)) allowed[key] = body[key]
  }

  const fieldErrors = validateEmployeeFields(allowed)
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  const employee = await updateEmployee(existing.id, ctx.workspace.id, allowed as Parameters<typeof updateEmployee>[2])
  return NextResponse.json({ employee })
}
