/**
 * Upload or clear a workspace's logo.
 *
 * Writing is `settings:write`; READING is a separate, member-scoped route
 * (`/api/me/ws/[slug]/logo`) because every member's shell renders the logo and
 * an ordinary member holds no admin resource.
 *
 * The type is decided by SNIFFING MAGIC BYTES, never by the browser-supplied
 * `File.type` - that string is attacker-controlled. SVG is deliberately not
 * accepted: it is markup, and serving attacker-supplied markup from our own
 * origin is a stored-XSS primitive that no amount of sniffing fixes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { MAX_LOGO_BYTES, sniffLogoMimeType } from '@/lib/storage'
import { upsertWorkspaceLogo, deleteWorkspaceLogo } from '@/lib/db/queries/workspace-logo'
import { wsAdmin } from '@/locales/en/ws-settings'

interface Props { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Settings, Action.Write)
  if (!ctx) return forbidden()

  let file: File | null = null
  try {
    const form = await req.formData()
    const entry = form.get('file')
    file = entry instanceof File ? entry : null
  } catch {
    file = null
  }
  if (!file) {
    return NextResponse.json(
      { error: wsAdmin.settings.logoNoFile, code: 'NO_FILE' },
      { status: 400 },
    )
  }

  // Checked before the bytes are read into memory, so an oversized upload is
  // refused rather than buffered first.
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: wsAdmin.settings.logoTooLarge, code: 'FILE_TOO_LARGE' },
      { status: 413 },
    )
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = sniffLogoMimeType(bytes)
  if (!mime) {
    return NextResponse.json(
      { error: wsAdmin.settings.logoBadType, code: 'UNSUPPORTED_TYPE' },
      { status: 415 },
    )
  }

  // One statement, so replacing a logo never leaves a window with none.
  await upsertWorkspaceLogo(ctx.workspace.id, bytes.toString('base64'), mime, bytes.length)

  return NextResponse.json({ ok: true, mime_type: mime, size_bytes: bytes.length })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Settings, Action.Write)
  if (!ctx) return forbidden()

  await deleteWorkspaceLogo(ctx.workspace.id)
  return NextResponse.json({ ok: true })
}
