import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { ensureEmployeeForMember, findEmployeeByUserId } from '@/lib/db/queries/employees'
import {
  listMaternityCases,
  createMaternityCase,
  findOpenCaseForEmployee,
  isMaternityStatus,
  isParentalCaseType,
  MaternityCaseOpenError,
  type ParentalCaseType,
} from '@/lib/db/queries/maternity'
import { hrRecord, maternity as maternityCopy } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Maternity is filed under the Leaves resource rather than getting one of its
 * own. It is leave administration by any reading, and a workspace that has
 * given someone leave:write has already decided they handle absence.
 */
const RESOURCE = Resource.Leaves

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return undefined
  return value.trim()
}

// ─── GET /api/ws/[slug]/maternity ─────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Read)
  if (!ctx) return forbidden()

  const sp = req.nextUrl.searchParams
  const statusParam = sp.get('status')
  const status = isMaternityStatus(statusParam) ? statusParam : undefined
  const employeeId = sp.get('employee_id') ?? undefined
  // Omitted (or unrecognised) means BOTH types. An unknown value is dropped
  // rather than 400'd, for the same reason the assets list drops an unknown
  // status: a stale bookmark should not become an error page.
  const caseTypeParam = sp.get('case_type')
  const caseType = isParentalCaseType(caseTypeParam) ? caseTypeParam : undefined

  const cases = await listMaternityCases(ctx.workspace.id, { status, employeeId, caseType })
  return NextResponse.json({ cases })
}

// ─── POST /api/ws/[slug]/maternity ────────────────────────────────────────────
// Body: { user_id, case_type?, due_date?, start_date?, end_date?, weeks?, notes? }
//
// `case_type` defaults to 'maternity' so every caller written before paternity
// existed keeps its meaning, and is run through isParentalCaseType() because
// the column has no CHECK constraint behind it - see the guard's doc comment.
//
// `user_id` is a workspace MEMBER. Most members have no HR record - `employees`
// is written only when an admin fills in the directory form - so a body keyed
// by employee id could name barely anyone in a real workspace. The record is
// found, or created, once the request is known to be good.

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Write)
  if (!ctx) return forbidden()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return NextResponse.json(
      { error: hrRecord.errors.memberRequired, code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const fields: Record<string, string> = {}

  let caseType: ParentalCaseType = 'maternity'
  if (body.case_type !== undefined && body.case_type !== null) {
    if (!isParentalCaseType(body.case_type)) fields.case_type = 'INVALID'
    else caseType = body.case_type
  }

  const dueDate = parseDate(body.due_date)
  const startDate = parseDate(body.start_date)
  const endDate = parseDate(body.end_date)
  if (dueDate === undefined && body.due_date !== undefined) fields.due_date = 'INVALID'
  if (startDate === undefined && body.start_date !== undefined) fields.start_date = 'INVALID'
  if (endDate === undefined && body.end_date !== undefined) fields.end_date = 'INVALID'

  let weeks: number | undefined
  if (body.weeks !== undefined && body.weeks !== null) {
    const num = typeof body.weeks === 'number' ? body.weeks : Number(body.weeks)
    if (!Number.isInteger(num) || num <= 0 || num > 104) fields.weeks = 'INVALID'
    else weeks = num
  }

  if (startDate && endDate && endDate < startDate) fields.end_date = 'BEFORE_START'

  if (Object.keys(fields).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 422 },
    )
  }

  // One running case per employee PER TYPE. Closed ('returned') cases are
  // history and do not block a later one, and an open maternity case does not
  // block a paternity case - the index covers case_type, and this read passes
  // it so the two agree.
  //
  // This read is a courtesy - it turns the common case into a clean 409 with
  // no failed INSERT behind it. The GUARANTEE is the partial unique index
  // idx_parental_cases_one_open, because this check and the insert below are
  // two statements and two simultaneous requests can both pass it.
  //
  // Read with findEmployeeByUserId, not ensure: a member with no HR record
  // cannot have a case, and a request about to 409 must not leave a record
  // behind it.
  const existing = await findEmployeeByUserId(ctx.workspace.id, userId)
  if (existing) {
    const open = await findOpenCaseForEmployee(ctx.workspace.id, existing.id, caseType)
    if (open) {
      return NextResponse.json(
        { error: maternityCopy.errors.caseOpen, code: 'CASE_OPEN' },
        { status: 409 },
      )
    }
  }

  // Resolved against this workspace: the id came from the client, and an
  // active membership here is the only thing that authorises a record.
  const resolved = await ensureEmployeeForMember(ctx.workspace.id, userId)
  if (!resolved.ok) {
    return resolved.reason === 'NOT_A_MEMBER'
      ? NextResponse.json({ error: hrRecord.errors.notAMember, code: 'MEMBER_NOT_FOUND' }, { status: 404 })
      : NextResponse.json({ error: hrRecord.errors.workEmailTaken, code: 'WORK_EMAIL_TAKEN' }, { status: 409 })
  }

  let maternityCase
  try {
    maternityCase = await createMaternityCase({
      workspaceId: ctx.workspace.id,
      employeeId: resolved.employee.id,
      case_type: caseType,
      due_date: dueDate ?? null,
      start_date: startDate ?? null,
      end_date: endDate ?? null,
      weeks,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    })
  } catch (err) {
    // Lost the race against a concurrent POST. Same answer as the pre-check
    // above - the caller does not need to know it was a photo finish.
    if (err instanceof MaternityCaseOpenError) {
      return NextResponse.json(
        { error: maternityCopy.errors.caseOpen, code: 'CASE_OPEN' },
        { status: 409 },
      )
    }
    throw err
  }

  return NextResponse.json({ case: maternityCase }, { status: 201 })
}
