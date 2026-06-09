import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceMemberByEmail } from '@/lib/db/queries/workspaces'
import {
  getWorkspaceLeaveTypes,
  bulkUpsertOpeningBalances,
} from '@/lib/db/queries/leaves'
import { parseRawStr, parseRawNum } from '@/lib/constants'

const MAX_FILE_BYTES = 2 * 1024 * 1024

interface Props { params: Promise<{ slug: string }> }

// ─── POST /api/ws/[slug]/leave-balances/import ────────────────────────────────
// Multipart form with a `file` field (.csv or .xlsx).
// Columns (case-insensitive): email, leave_type, opening_balance
// Valid rows are upserted; invalid rows are collected in errors[].

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

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
    const stream = new Readable({ read() {} })
    stream.push(buffer)
    stream.push(null)
    if (ext === 'xlsx') {
      await workbook.xlsx.read(stream)
    } else {
      await workbook.csv.read(stream)
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse file', code: 'PARSE_ERROR' }, { status: 422 })
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    return NextResponse.json({ error: 'File has no sheets', code: 'EMPTY_FILE' }, { status: 422 })
  }

  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    headers.push(String(cellValue(cell.value) ?? '').toLowerCase().trim())
  })

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

  // Pre-fetch leave types for O(1) name → id lookup (case-insensitive)
  const leaveTypes = await getWorkspaceLeaveTypes(ctx.workspace.id)
  const leaveTypeByName = new Map(leaveTypes.map((t) => [t.name.toLowerCase(), t]))

  const errors: { row: number; reason: string }[] = []
  const items: Parameters<typeof bulkUpsertOpeningBalances>[0] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2
    const raw = rawRows[i]

    const email = parseRawStr(raw.email, true)
    if (!email) {
      errors.push({ row: rowNum, reason: 'Missing or empty "email"' })
      continue
    }

    const leaveTypeName = parseRawStr(raw.leave_type)
    if (!leaveTypeName) {
      errors.push({ row: rowNum, reason: 'Missing or empty "leave_type"' })
      continue
    }

    const leaveType = leaveTypeByName.get(leaveTypeName.toLowerCase())
    if (!leaveType) {
      errors.push({ row: rowNum, reason: `Leave type "${leaveTypeName}" not found in this workspace` })
      continue
    }

    const balanceDays = parseRawNum(raw.opening_balance)
    if (isNaN(balanceDays) || balanceDays < 0) {
      errors.push({
        row: rowNum,
        reason: `"opening_balance" must be a non-negative number (got "${raw.opening_balance}")`,
      })
      continue
    }

    const member = await getWorkspaceMemberByEmail(ctx.workspace.id, email)
    if (!member || !member.user_id) {
      errors.push({ row: rowNum, reason: `No active workspace member found for email "${email}"` })
      continue
    }

    items.push({
      workspaceId: ctx.workspace.id,
      userId: member.user_id,
      leaveTypeId: leaveType.id,
      balanceDays,
    })
  }

  const result = await bulkUpsertOpeningBalances(items)
  errors.push(...result.errors.map((e) => ({ row: -1, reason: e })))

  return NextResponse.json({ imported: result.imported, errors })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null
  if (v instanceof Date || typeof v !== 'object') return v
  if ('result' in v) return (v as { result: ExcelJS.CellValue }).result ?? null
  if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
  if ('text' in v) return (v as { text: string }).text
  return null
}
