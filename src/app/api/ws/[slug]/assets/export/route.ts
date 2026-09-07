import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { listAssets, isAssetStatus } from '@/lib/db/queries/assets'

interface Props { params: Promise<{ slug: string }> }

/**
 * Quote one CSV field.
 *
 * Every value is quoted rather than only the ones containing a delimiter: it
 * costs a few bytes and removes the class of bug where a name gains a comma
 * later and silently shifts every following column.
 *
 * The leading-character guard is CSV injection defence - a cell starting
 * `=`, `+`, `-` or `@` is executed as a formula when the file is opened in
 * Excel or Sheets, so an asset named `=HYPERLINK(...)` would otherwise become
 * a live payload on an admin's machine.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

const HEADERS = [
  'Name',
  'Category',
  'Serial number',
  'Condition',
  'Status',
  'Assigned to',
  'Employee ID',
  'Assigned at',
  'Purchase value',
  'Notes',
  'Created at',
]

// ─── GET /api/ws/[slug]/assets/export ─────────────────────────────────────────
// Honours the same ?category= / ?status= filters as the list endpoint, so the
// export always matches what the admin is looking at.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  // Gated on Assets:read, not Export:read - the Export resource governs the
  // attendance workbook, and an assets-only role should still be able to take
  // its own list away with it.
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Read)
  if (!ctx) return forbidden()

  const sp = req.nextUrl.searchParams
  const category = sp.get('category') ?? undefined
  const statusParam = sp.get('status')
  const status = isAssetStatus(statusParam) ? statusParam : undefined

  const assets = await listAssets(ctx.workspace.id, { category, status })

  const lines = [HEADERS.map(csvField).join(',')]
  for (const a of assets) {
    const assignee = a.assignee_first_name
      ? `${a.assignee_first_name} ${a.assignee_last_name ?? ''}`.trim()
      : ''
    lines.push([
      a.name,
      a.category ?? '',
      a.serial_number ?? '',
      a.condition ?? '',
      a.status,
      assignee,
      a.assignee_employee_id ?? '',
      a.assigned_at ?? '',
      a.purchase_value ?? '',
      a.notes ?? '',
      a.created_at,
    ].map(csvField).join(','))
  }

  // ﻿: without the BOM, Excel reads the file as the local ANSI codepage
  // and mangles every non-ASCII name.
  const csv = '﻿' + lines.join('\r\n') + '\r\n'
  const filename = `assets-${slug}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
