import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  getHoliday,
  updateHoliday,
  deleteHoliday,
  findHolidayByNameAndDate,
} from '@/lib/db/queries/holidays'

interface Props { params: Promise<{ slug: string; id: string }> }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── PATCH /api/ws/[slug]/holidays/[id] ───────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const existing = await getHoliday(id, ctx.workspace.id)
  if (!existing) {
    return NextResponse.json({ error: 'Holiday not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const hasName = 'name' in body
  const hasDate = 'date' in body
  const hasDescription = 'description' in body

  if (!hasName && !hasDate && !hasDescription) {
    return NextResponse.json(
      { error: 'At least one of name, date, or description is required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const name = hasName
    ? typeof body.name === 'string' ? body.name.trim() : null
    : undefined

  if (hasName && !name) {
    return NextResponse.json(
      { error: 'name must be a non-empty string', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const date = hasDate
    ? typeof body.date === 'string' ? body.date.trim() : null
    : undefined

  if (hasDate && (!date || !DATE_RE.test(date))) {
    return NextResponse.json(
      { error: 'date must be in YYYY-MM-DD format', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const description = hasDescription
    ? body.description === null ? null
      : typeof body.description === 'string' ? body.description.trim() || null
      : null
    : undefined

  if (hasName || hasDate) {
    const duplicate = await findHolidayByNameAndDate(
      ctx.workspace.id,
      name ?? existing.name,
      date ?? existing.date,
      id,
    )
    if (duplicate) {
      return NextResponse.json(
        { error: 'A holiday with this name and date already exists', code: 'DUPLICATE' },
        { status: 409 },
      )
    }
  }

  const updated = await updateHoliday(id, ctx.workspace.id, {
    ...(hasName ? { name: name! } : {}),
    ...(hasDate ? { date: date! } : {}),
    ...(hasDescription ? { description } : {}),
  })

  return NextResponse.json({ holiday: updated })
}

// ─── DELETE /api/ws/[slug]/holidays/[id] ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug, id } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const existing = await getHoliday(id, ctx.workspace.id)
  if (!existing) {
    return NextResponse.json({ error: 'Holiday not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  await deleteHoliday(id, ctx.workspace.id)
  return NextResponse.json({ success: true })
}
