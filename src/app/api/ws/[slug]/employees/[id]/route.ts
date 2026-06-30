import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin, requireWsMember } from '@/lib/ws-admin'
import {
  getEmployee,
  updateEmployee,
  archiveEmployee,
  findEmployeeByEmployeeId,
  findEmployeeByWorkEmail,
} from '@/lib/db/queries/employees'
import type { UpdateEmployeeInput } from '@/lib/types/employees'
import { validateEmployeeFields, FieldErrorCode } from '../_validate'

interface Props { params: Promise<{ slug: string; id: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── GET /api/ws/[slug]/employees/[id] ────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, id } = await params

  const adminCtx = await requireWsAdmin(req, slug)
  if (adminCtx) {
    const employee = await getEmployee(id, adminCtx.workspace.id)
    if (!employee) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ employee })
  }

  // Self-access fallback — return 404 (not 403) to avoid leaking existence
  const memberCtx = await requireWsMember(req, slug)
  if (!memberCtx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const employee = await getEmployee(id, memberCtx.workspace.id)
  if (!employee || employee.user_id !== memberCtx.userId) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  return NextResponse.json({ employee })
}

// ─── PATCH /api/ws/[slug]/employees/[id] ──────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const existing = await getEmployee(id, ctx.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fieldErrors = validateEmployeeFields(body, {
    existingDoj: existing.employment.date_of_joining,
  })

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  // Duplicate checks — only when the value is actually changing
  if (body.employee_id !== undefined && body.employee_id !== existing.employee_id) {
    const eid = typeof body.employee_id === 'string' ? body.employee_id.trim() : null
    if (eid) {
      const dup = await findEmployeeByEmployeeId(ctx.workspace.id, eid)
      if (dup && dup.id !== id) {
        return NextResponse.json(
          { error: 'An employee with this employee ID already exists', code: 'DUPLICATE' },
          { status: 409 },
        )
      }
    }
  }

  if (body.work_email !== undefined) {
    const normalizedEmail = (body.work_email as string).trim().toLowerCase()
    if (normalizedEmail !== existing.work_email) {
      const dup = await findEmployeeByWorkEmail(ctx.workspace.id, normalizedEmail)
      if (dup && dup.id !== id) {
        return NextResponse.json(
          { error: 'An employee with this work email already exists', code: 'DUPLICATE' },
          { status: 409 },
        )
      }
    }
  }

  if (body.work_email !== undefined) {
    body.work_email = (body.work_email as string).trim().toLowerCase()
  }

  const input = buildUpdateFields(body)
  const employee = await updateEmployee(id, ctx.workspace.id, input)
  if (!employee) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ employee })
}

// ─── DELETE /api/ws/[slug]/employees/[id] — archive ───────────────────────────

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const existing = await getEmployee(id, ctx.workspace.id)
  if (!existing) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fieldErrors: Record<string, string> = {}
  const exitDate   = typeof body.exit_date   === 'string' ? body.exit_date.trim()   : ''
  const exitReason = typeof body.exit_reason === 'string' ? body.exit_reason.trim() : ''

  if (!exitDate) {
    fieldErrors.exit_date = FieldErrorCode.REQUIRED
  } else if (!DATE_RE.test(exitDate)) {
    fieldErrors.exit_date = FieldErrorCode.INVALID_FORMAT
  } else if (existing.employment.date_of_joining && exitDate < existing.employment.date_of_joining) {
    fieldErrors.exit_date = FieldErrorCode.MUST_BE_AFTER_DOJ
  }

  if (!exitReason) fieldErrors.exit_reason = FieldErrorCode.REQUIRED

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  const ok = await archiveEmployee(id, ctx.workspace.id, exitDate, exitReason)
  if (!ok) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(body: Record<string, unknown>, key: string): T | undefined {
  return key in body ? (body[key] as T) : undefined
}

function buildUpdateFields(body: Record<string, unknown>): UpdateEmployeeInput {
  return {
    user_id:               pick(body, 'user_id'),
    employee_id:           pick(body, 'employee_id'),
    employee_status:       pick(body, 'employee_status'),
    first_name:            pick(body, 'first_name'),
    last_name:             pick(body, 'last_name'),
    gender:                pick(body, 'gender'),
    date_of_birth:         pick(body, 'date_of_birth'),
    marital_status:        pick(body, 'marital_status'),
    number_of_children:    pick(body, 'number_of_children'),
    blood_group:           pick(body, 'blood_group'),
    photo_url:             pick(body, 'photo_url'),
    personal_email:        pick(body, 'personal_email'),
    work_email:            pick(body, 'work_email'),
    phone:                 pick(body, 'phone'),
    alternate_phone:       pick(body, 'alternate_phone'),
    current_address:       pick(body, 'current_address'),
    permanent_address:     pick(body, 'permanent_address'),
    designation:           pick(body, 'designation'),
    department:            pick(body, 'department'),
    work_location:         pick(body, 'work_location'),
    work_mode:             pick(body, 'work_mode'),
    reporting_manager_id:  pick(body, 'reporting_manager_id'),
    employment_type:       pick(body, 'employment_type'),
    source_of_hire:        pick(body, 'source_of_hire'),
    total_work_experience: pick(body, 'total_work_experience'),
    date_of_joining:       pick(body, 'date_of_joining'),
    confirmation_date:     pick(body, 'confirmation_date'),
    probation_end_date:    pick(body, 'probation_end_date'),
    exit_date:             pick(body, 'exit_date'),
    exit_reason:           pick(body, 'exit_reason'),
    pan:                   pick(body, 'pan'),
    aadhaar:               pick(body, 'aadhaar'),
    uan:                   pick(body, 'uan'),
    passport_number:       pick(body, 'passport_number'),
    bank_account:                   pick(body, 'bank_account'),
    bank_ifsc:                      pick(body, 'bank_ifsc'),
    bank_name:                      pick(body, 'bank_name'),
    emergency_contact_name:         pick(body, 'emergency_contact_name'),
    emergency_contact_relationship: pick(body, 'emergency_contact_relationship'),
    emergency_contact_phone:        pick(body, 'emergency_contact_phone'),
  }
}
