import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import {
  getMaternityCase,
  updateMaternityCase,
  deleteMaternityCase,
  canTransition,
  isMaternityStatus,
  type UpdateMaternityCaseInput,
} from '@/lib/db/queries/maternity'
import { maternity as maternityCopy } from '@/locales/en/documents'

interface Props { params: Promise<{ slug: string; id: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const RESOURCE = Resource.Leaves

function notFound() {
  return NextResponse.json({ error: 'Maternity case not found', code: 'NOT_FOUND' }, { status: 404 })
}

function parseDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !DATE_RE.test(value.trim())) return undefined
  return value.trim()
}

// ─── PATCH /api/ws/[slug]/maternity/[id] ──────────────────────────────────────
// Edits dates/notes and/or moves the case one stage forward.

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Write)
  if (!ctx) return forbidden()

  const existing = await getMaternityCase(id, ctx.workspace.id)
  if (!existing) return notFound()

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fields: Record<string, string> = {}
  const input: UpdateMaternityCaseInput = {}

  for (const key of ['due_date', 'start_date', 'end_date', 'returned_on'] as const) {
    if (!(key in body)) continue
    const parsed = parseDate(body[key])
    if (parsed === undefined) fields[key] = 'INVALID'
    else input[key] = parsed
  }

  if ('weeks' in body) {
    const num = typeof body.weeks === 'number' ? body.weeks : Number(body.weeks)
    if (!Number.isInteger(num) || num <= 0 || num > 104) fields.weeks = 'INVALID'
    else input.weeks = num
  }

  if ('notes' in body) {
    input.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
  }

  if ('status' in body) {
    if (!isMaternityStatus(body.status)) {
      fields.status = 'INVALID'
    } else if (body.status !== existing.status && !canTransition(existing.status, body.status)) {
      // The stage machine lives in the query file so the API and any future
      // job runner agree on what a legal move is.
      return NextResponse.json(
        {
          error: `Cannot move a case from "${existing.status}" to "${body.status}"`,
          code: 'INVALID_TRANSITION',
        },
        { status: 409 },
      )
    } else {
      input.status = body.status
      // Entering 'returned' without a return date leaves the case looking open
      // in every date-based report, so default it to today.
      if (body.status === 'returned' && !('returned_on' in body) && !existing.returned_on) {
        input.returned_on = new Date().toISOString().slice(0, 10)
      }
    }
  }

  const start = input.start_date !== undefined ? input.start_date : existing.start_date
  const end = input.end_date !== undefined ? input.end_date : existing.end_date
  if (start && end && end < start) fields.end_date = 'BEFORE_START'

  // An open case's DATES are the reminder gate, not its status:
  // getActiveMaternityUserIds matches `start_date <= today <= end_date`, so a
  // case that keeps its status but loses a date drops silently out of the gate
  // and the daily check-in reminder starts nagging someone who is on maternity
  // leave. Dates may be moved while a case is open; they may not be cleared.
  // Only 'returned' - where the case is history and the gate no longer looks
  // at it - may hold nulls.
  const nextStatus = input.status ?? existing.status
  if (nextStatus !== 'returned') {
    const cleared = (['start_date', 'end_date'] as const).filter((k) => input[k] === null)
    if (cleared.length > 0) {
      return NextResponse.json(
        {
          error: maternityCopy.errors.datesRequiredWhileOpen,
          code: 'VALIDATION_ERROR',
          fields: Object.fromEntries(cleared.map((k) => [k, 'REQUIRED_WHILE_OPEN'])),
        },
        { status: 422 },
      )
    }
  }

  if (Object.keys(fields).length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 422 },
    )
  }

  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: 'At least one field is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const updated = await updateMaternityCase(id, ctx.workspace.id, input)
  return NextResponse.json({ case: updated })
}

// ─── DELETE /api/ws/[slug]/maternity/[id] ─────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAccess(req, slug, RESOURCE, Action.Delete)
  if (!ctx) return forbidden()

  const deleted = await deleteMaternityCase(id, ctx.workspace.id)
  if (!deleted) return notFound()

  return NextResponse.json({ success: true })
}
