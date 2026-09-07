import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import {
  createEmployee,
  findEmployeeByEmployeeId,
  findEmployeeByWorkEmail,
} from '@/lib/db/queries/employees'
import { listDirectoryPeople } from '@/lib/db/queries/employees-list'
import {
  addWorkspaceMember,
  getWorkspaceMemberByEmail,
  MEMBER_STATUS_NO_ACCESS,
} from '@/lib/db/queries/workspaces'
import type { CreateEmployeeInput } from '@/lib/types/employees'
import { EmployeeStatus } from '@/lib/constants/employees'
import { validateEmployeeFields } from './_validate'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { can } from '@/lib/permissions/can'

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/employees ─────────────────────────────────────────────

/**
 * The workforce directory: every active MEMBER, with the HR record overlaid
 * where one exists. It is not a list of `employees` rows - see
 * `listDirectoryPeople` for why a table that only an admin ever writes to
 * cannot be the source of truth for who works here.
 *
 * `employees` stays in the response as the subset of `people` that do have a
 * record. The asset and maternity screens fetch this endpoint purely to fill an
 * "assign to…" picker, and a picker may only offer people who have a record to
 * attach the asset or the case to.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Employees, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const limit = Math.min(parseInt(sp.get('limit') ?? '25', 10) || 25, 100)
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const search = sp.get('search') ?? undefined
  const department = sp.get('department') ?? undefined
  const location   = sp.get('location') ?? undefined
  const statusParam = sp.get('status')
  const status = statusParam && (Object.values(EmployeeStatus) as string[]).includes(statusParam)
    ? (statusParam as EmployeeStatus)
    : undefined
  const include_archived = sp.get('include_archived') === 'true'

  const { people, total, withRecord } = await listDirectoryPeople(ctx.workspace.id, {
    limit, offset, search, department, status, location, include_archived,
  })

  // The org role is membership data, not HR data. A role that may read
  // employees but not members has never been shown it, and the directory
  // carrying it in the same payload must not become the hole that leaks it -
  // so it is stripped server-side rather than merely hidden by the client.
  const showRole = can(ctx.role.permissions, Resource.Members, Action.Read)

  return NextResponse.json({
    people: showRole ? people : people.map(p => ({ ...p, role: '' })),
    employees: people.map(p => p.employee).filter((e): e is NonNullable<typeof e> => e !== null),
    total,
    withRecord,
    pagination: {
      offset,
      limit,
      nextOffset: offset + people.length < total ? offset + people.length : null,
    },
  })
}

// ─── POST /api/ws/[slug]/employees ────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Employees, Action.Write)
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

  /**
   * Every employee record gets a membership row, even when nobody is invited.
   *
   * The directory reads `FROM workspace_members`, and the person details page is
   * keyed on `workspace_members.id`. So a record created without one is
   * invisible in People AND has no URL - two of those orphans already existed in
   * the live data before this. Writing the membership here makes an orphan
   * structurally impossible rather than something the read path has to paper
   * over with a UNION.
   *
   * `status: 'no_access'` is the honest answer: they have an HR record, they
   * have never been invited, and they cannot sign in. `pending_consent` would
   * claim an invitation was sent. `user_id` stays NULL - linking an existing
   * account here would hand someone a workspace they never accepted; the accept
   * paths in `src/lib/membership.ts` own that link.
   *
   * Where a membership already exists for this address - HR filling in the
   * record of somebody already in the workspace - it is reused untouched. Its
   * status is theirs, not ours to downgrade.
   */
  const existing = await getWorkspaceMemberByEmail(ctx.workspace.id, workEmail)
  const member = existing ?? await addWorkspaceMember({
    workspaceId: ctx.workspace.id,
    email: workEmail,
    role: 'member',
    status: MEMBER_STATUS_NO_ACCESS,
  })

  return NextResponse.json({ employee, member_id: member.id }, { status: 201 })
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
