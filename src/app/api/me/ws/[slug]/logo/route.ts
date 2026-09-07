/**
 * Serve a workspace's logo.
 *
 * Member-scoped rather than sitting under `/api/ws/[slug]/`, and deliberately:
 * both shells render it, and an ordinary member has no `settings:read`. Gating
 * it on any admin resource would mean the logo appeared for admins and silently
 * fell back to the generated swatch for everyone else. Membership is the honest
 * test - a workspace's own mark is not a secret from the people in it.
 *
 * Bytes go out as bytes, with a real `Content-Type`. Base64 never appears in a
 * JSON body (invariant 23).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireWsMember } from '@/lib/ws-admin'
import { getWorkspaceLogoBlob } from '@/lib/db/queries/workspace-logo'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsMember(req, slug)
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const logo = await getWorkspaceLogoBlob(ctx.workspace.id)
  if (!logo) {
    // Not an error: most workspaces have no logo and fall back to the swatch.
    return NextResponse.json({ error: 'No logo set', code: 'NO_LOGO' }, { status: 404 })
  }

  const bytes = Buffer.from(logo.base64, 'base64')
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': logo.mimeType,
      'Content-Length': String(bytes.length),
      // Long-lived because the caller appends the logo's `updated_at` as a
      // cache-busting query param - a replaced logo changes its URL, so a stale
      // copy can never be served. `private` because it is behind a session.
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      // Belt and braces against the image being interpreted as a document.
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
