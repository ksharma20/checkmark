import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  createEmployee,
  updateEmployee,
  findEmployeeByWorkEmail,
  findEmployeeByUserId,
  findEmployeeByEmployeeId,
} from '@/lib/db/queries/employees'
import { getWorkspaceMember } from '@/lib/db/queries/workspaces'
import type { CreateEmployeeInput } from '@/lib/types/employees'
import { validateEmployeeFields } from '../../../employees/_validate'

interface Props { params: Promise<{ slug: string; memberId: string }> }

// ─── GET /api/ws/[slug]/members/[memberId]/employee ───────────────────────────
// Returns the employee record linked to this workspace member (by user_id).

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId: userId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const employee = await findEmployeeByUserId(ctx.workspace.id, userId)
  return NextResponse.json({ employee })
}

// ─── POST /api/ws/[slug]/members/[memberId]/employee ─────────────────────────
// Creates an employee record linked to this workspace member.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug, memberId: userId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  // Verify the user is an active member of this workspace
  const member = await getWorkspaceMember(ctx.workspace.id, userId)
  if (!member || member.status !== 'active') {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  // Block if already has an employee record
  const existingEmployee = await findEmployeeByUserId(ctx.workspace.id, userId)
  if (existingEmployee) {
    return NextResponse.json({ error: 'Employee profile already exists', code: 'DUPLICATE' }, { status: 409 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fieldErrors: Record<string, string> = {}
  if (!body.first_name || typeof body.first_name !== 'string' || !(body.first_name as string).trim()) {
    fieldErrors.first_name = 'REQUIRED'
  }
  if (!body.last_name || typeof body.last_name !== 'string' || !(body.last_name as string).trim()) {
    fieldErrors.last_name = 'REQUIRED'
  }

  const optErrors = validateEmployeeFields(body)
  Object.assign(fieldErrors, optErrors)

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields: fieldErrors },
      { status: 422 },
    )
  }

  const workEmail = body.work_email
    ? (body.work_email as string).trim().toLowerCase()
    : member.email.toLowerCase()

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

  const emailDup = await findEmployeeByWorkEmail(ctx.workspace.id, workEmail)
  if (emailDup) {
    return NextResponse.json(
      { error: 'An employee with this work email already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  const input: CreateEmployeeInput = {
    workspace_id: ctx.workspace.id,
    user_id: userId,
    first_name: (body.first_name as string).trim(),
    last_name: (body.last_name as string).trim(),
    work_email: workEmail,
    designation: body.designation as string | undefined,
    department: body.department as string | undefined,
    employment_type: body.employment_type as unknown as CreateEmployeeInput['employment_type'],
    date_of_joining: body.date_of_joining as string | undefined,
    work_location: body.work_location as string | undefined,
    work_mode: body.work_mode as unknown as CreateEmployeeInput['work_mode'],
    employee_id: employeeIdVal ?? undefined,
    phone: body.phone as string | undefined,
  }

  const employee = await createEmployee(input)
  return NextResponse.json({ employee }, { status: 201 })
}

// ─── PATCH /api/ws/[slug]/members/[memberId]/employee ────────────────────────
// Updates the employee record linked to this workspace member.

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, memberId: userId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const existing = await findEmployeeByUserId(ctx.workspace.id, userId)
  if (!existing) {
    return NextResponse.json({ error: 'Employee profile not found', code: 'NOT_FOUND' }, { status: 404 })
  }

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

  if (body.employee_id !== undefined && body.employee_id !== existing.employee_id) {
    const eid = typeof body.employee_id === 'string' ? body.employee_id.trim() : null
    if (eid) {
      const dup = await findEmployeeByEmployeeId(ctx.workspace.id, eid)
      if (dup && dup.id !== existing.id) {
        return NextResponse.json(
          { error: 'An employee with this employee ID already exists', code: 'DUPLICATE' },
          { status: 409 },
        )
      }
    }
  }

  if (body.work_email) {
    const normalizedEmail = (body.work_email as string).trim().toLowerCase()
    if (normalizedEmail !== existing.work_email) {
      const dup = await findEmployeeByWorkEmail(ctx.workspace.id, normalizedEmail)
      if (dup && dup.id !== existing.id) {
        return NextResponse.json(
          { error: 'An employee with this work email already exists', code: 'DUPLICATE' },
          { status: 409 },
        )
      }
    }
    body.work_email = (body.work_email as string).trim().toLowerCase()
  }

  const employee = await updateEmployee(existing.id, ctx.workspace.id, body as Parameters<typeof updateEmployee>[2])
  if (!employee) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ employee })
}
