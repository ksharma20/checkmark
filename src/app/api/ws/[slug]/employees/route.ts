import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  createEmployee,
  findEmployeeByEmployeeId,
  findEmployeeByWorkEmail,
} from '@/lib/db/queries/employees'
import { listEmployeesPaged } from '@/lib/db/queries/employees-list'
import type { CreateEmployeeInput } from '@/lib/types/employees'
import { EmployeeStatus } from '@/lib/constants/employees'
import { validateEmployeeFields } from './_validate'

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/employees ─────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const limit = Math.min(parseInt(sp.get('limit') ?? '25', 10) || 25, 100)
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const department = sp.get('department') ?? undefined
  const location   = sp.get('location') ?? undefined
  const statusParam = sp.get('status')
  const status = statusParam && (Object.values(EmployeeStatus) as string[]).includes(statusParam)
    ? (statusParam as EmployeeStatus)
    : undefined
  const include_archived = sp.get('include_archived') === 'true'

  const { employees, total } = await listEmployeesPaged(ctx.workspace.id, {
    limit, offset, department, status, location, include_archived,
  })

  return NextResponse.json({
    employees,
    total,
    pagination: {
      offset,
      limit,
      nextOffset: offset + employees.length < total ? offset + employees.length : null,
    },
  })
}

// ─── POST /api/ws/[slug]/employees ────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  // Required fields + optional field validation combined
  const fieldErrors: Record<string, string> = {}

  if (!body.first_name || typeof body.first_name !== 'string' || !(body.first_name as string).trim()) {
    fieldErrors.first_name = 'REQUIRED'
  }
  if (!body.last_name || typeof body.last_name !== 'string' || !(body.last_name as string).trim()) {
    fieldErrors.last_name = 'REQUIRED'
  }
  if (!body.work_email || typeof body.work_email !== 'string' || !(body.work_email as string).trim()) {
    fieldErrors.work_email = 'REQUIRED'
  }

  const optErrors = validateEmployeeFields(body)
  Object.assign(fieldErrors, optErrors)

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  // Duplicate checks
  const employeeIdVal = body.employee_id && typeof body.employee_id === 'string'
    ? (body.employee_id as string).trim()
    : null
  if (employeeIdVal) {
    const dup = await findEmployeeByEmployeeId(ctx.workspace.id, employeeIdVal)
    if (dup) {
      return NextResponse.json(
        { error: 'An employee with this employee ID already exists', code: 'DUPLICATE' },
        { status: 409 },
      )
    }
  }

  const workEmail = (body.work_email as string).trim().toLowerCase()
  const emailDup = await findEmployeeByWorkEmail(ctx.workspace.id, workEmail)
  if (emailDup) {
    return NextResponse.json(
      { error: 'An employee with this work email already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  const input: CreateEmployeeInput = {
    workspace_id: ctx.workspace.id,
    first_name: (body.first_name as string).trim(),
    last_name: (body.last_name as string).trim(),
    work_email: workEmail,
    ...buildOptionalFields(body),
  }

  const employee = await createEmployee(input)
  return NextResponse.json({ employee }, { status: 201 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(body: Record<string, unknown>, key: string): T | undefined {
  return key in body ? (body[key] as T) : undefined
}

function buildOptionalFields(body: Record<string, unknown>): Partial<CreateEmployeeInput> {
  return {
    user_id:               pick(body, 'user_id'),
    employee_id:           pick(body, 'employee_id'),
    employee_status:       pick(body, 'employee_status'),
    gender:                pick(body, 'gender'),
    date_of_birth:         pick(body, 'date_of_birth'),
    marital_status:        pick(body, 'marital_status'),
    number_of_children:    pick(body, 'number_of_children'),
    blood_group:           pick(body, 'blood_group'),
    photo_url:             pick(body, 'photo_url'),
    personal_email:        pick(body, 'personal_email'),
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
