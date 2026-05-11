import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { requireWsAdmin } from '@/lib/ws-admin'
import {
  listHolidays,
  createHoliday,
  findHolidayByNameAndDate,
  bulkUpsertHolidays,
} from '@/lib/db/queries/holidays'
import type { HolidayImportRow } from '@/lib/db/queries/holidays'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface Props { params: Promise<{ slug: string }> }

// ─── GET /api/ws/[slug]/holidays ───────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const yearParam = req.nextUrl.searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : undefined

  const holidays = await listHolidays(ctx.workspace.id, year)
  return NextResponse.json({ holidays })
}

// ─── POST /api/ws/[slug]/holidays ─────────────────────────────────────────────
// JSON body  → create single holiday
// multipart  → bulk import (CSV / XLSX)

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    return handleCreate(req, ctx.workspace.id, ctx.userId)
  }

  return handleImport(req, ctx.workspace.id, ctx.userId)
}

// ─── Single-holiday create ─────────────────────────────────────────────────────

async function handleCreate(req: NextRequest, workspaceId: string, userId: string) {
  let body: { name?: unknown; date?: unknown; description?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''

  if (!name || !date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: 'name (string) and date (YYYY-MM-DD) are required', code: 'VALIDATION_ERROR' },
      { status: 422 },
    )
  }

  const description =
    body.description === null ? null
    : typeof body.description === 'string' ? body.description.trim() || null
    : undefined

  const duplicate = await findHolidayByNameAndDate(workspaceId, name, date)
  if (duplicate) {
    return NextResponse.json(
      { error: 'A holiday with this name and date already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  const holiday = await createHoliday({
    workspaceId,
    name,
    date,
    description: description ?? undefined,
    createdBy: userId,
  })

  return NextResponse.json({ holiday }, { status: 201 })
}

// ─── Bulk file import ──────────────────────────────────────────────────────────

async function handleImport(req: NextRequest, workspaceId: string, userId: string) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data', code: 'INVALID_BODY' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided', code: 'MISSING_FILE' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'xlsx' && ext !== 'csv') {
    return NextResponse.json(
      { error: 'Only .xlsx and .csv files are supported', code: 'INVALID_FILE_TYPE' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2 MB limit', code: 'FILE_TOO_LARGE' }, { status: 413 })
  }

  const buffer = Buffer.from(new Uint8Array(await file.arrayBuffer()))
  const workbook = new ExcelJS.Workbook()

  try {
    const fileStream = new Readable({ read() {} })
    fileStream.push(buffer)
    fileStream.push(null)
    if (ext === 'xlsx') {
      await workbook.xlsx.read(fileStream)
    } else {
      await workbook.csv.read(fileStream)
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse file', code: 'PARSE_ERROR' }, { status: 422 })
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return NextResponse.json({ error: 'File has no sheets', code: 'EMPTY_FILE' }, { status: 422 })
  }

  // Extract lowercased headers from the first row
  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cellValue(cell.value) ?? '').toLowerCase().trim())
  })

  // Convert data rows to objects with normalized keys
  const rawRows: Record<string, unknown>[] = []
  sheet.eachRow((_row, rowNumber) => {
    if (rowNumber === 1) return
    const row = sheet.getRow(rowNumber)
    const obj: Record<string, unknown> = {}
    headers.forEach((header, idx) => {
      obj[header] = cellValue(row.getCell(idx + 1).value)
    })
    rawRows.push(obj)
  })

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'File contains no data rows', code: 'EMPTY_FILE' }, { status: 422 })
  }

  const valid: HolidayImportRow[] = []
  const errors: { row: number; reason: string }[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // row 1 is header
    const raw = rawRows[i]

    const name = typeof raw.name === 'string' ? raw.name.trim() : null
    if (!name) {
      errors.push({ row: rowNum, reason: 'Missing or empty "name"' })
      continue
    }

    const dateStr = parseDate(raw.date)
    if (!dateStr) {
      errors.push({ row: rowNum, reason: 'Invalid or missing "date" — expected YYYY-MM-DD' })
      continue
    }

    const description = nullableString(raw.description)
    valid.push({ name, date: dateStr, description })
  }

  const result = await bulkUpsertHolidays(workspaceId, userId, valid)

  return NextResponse.json({ inserted: result.inserted, updated: result.updated, errors })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Unwrap exceljs cell value types to plain JS values
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date || typeof v !== 'object') return v
  // Formula / shared formula — return the computed result
  if ('result' in v) return (v as { result: ExcelJS.CellValue }).result ?? null
  // Rich text — join segments
  if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
  // Hyperlink — return display text
  if ('text' in v) return (v as { text: string }).text
  // Error cells → null
  return null
}

function nullableString(value: unknown): string | null {
  if (value == null || value === '') return null
  const s = String(value).trim()
  return s || null
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return null
  }
  return null
}
