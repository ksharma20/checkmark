import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getDocument } from '@/lib/db/queries/documents'
import { documentStore } from '@/lib/storage'
import { contentDispositionFilename } from '@/lib/api/documents-upload'

interface Props { params: Promise<{ slug: string; id: string; docId: string }> }

// ─── GET /api/ws/[slug]/employees/[id]/documents/[docId]/file ─────────────────
//
// The ONLY route that emits document bytes, and it emits them as a body, never
// inside JSON. Base64 in a JSON field would be logged by anything that logs
// response bodies, would sit in the browser's memory as a string, and would
// invite the frontend to build data: URLs out of it.
//
// Always `attachment`: an inline PDF or image renders in the tab, and a
// same-origin render of user-supplied content is the start of every stored-XSS
// story. A download is what an HR document is for anyway.

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, id, docId } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Documents, Action.Read)
  if (!ctx) return forbidden()

  const document = await getDocument(docId, ctx.workspace.id)
  if (!document || document.employee_id !== id) {
    return NextResponse.json({ error: 'Document not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const file = await documentStore.get(ctx.workspace.id, docId)
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded', code: 'NO_FILE' }, { status: 404 })
  }

  const filename = contentDispositionFilename(document.file_name)

  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Employee documents are private per-viewer data; no shared cache should
      // ever hold a copy.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
