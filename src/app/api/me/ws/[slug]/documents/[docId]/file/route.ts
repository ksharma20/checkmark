/**
 * Download one of the member's OWN documents.
 *
 * The ownership check is the whole point of this route existing separately
 * from the admin one: the docId comes from the client, so after loading the
 * metadata we compare its `employee_id` against the employee record resolved
 * from the session user. A mismatch is a 404 - not a 403, which would confirm
 * that the id is real.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { findEmployeeByUserId } from '@/lib/db/queries/employees'
import { getDocument } from '@/lib/db/queries/documents'
import { documentStore } from '@/lib/storage'
import { contentDispositionFilename } from '@/lib/api/documents-upload'

interface Props { params: Promise<{ slug: string; docId: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, docId } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const employee = await findEmployeeByUserId(ctx.workspace.id, ctx.userId)
  if (!employee) {
    return NextResponse.json({ error: 'Employee profile not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const document = await getDocument(docId, ctx.workspace.id)
  if (!document || document.employee_id !== employee.id) {
    return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const file = await documentStore.get(ctx.workspace.id, docId)
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded', code: 'NO_FILE' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `attachment; filename="${contentDispositionFilename(document.file_name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
