import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$|^[a-z0-9]{2}$/

export async function POST(request: NextRequest) {
  let body: { slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ available: false, error: 'Invalid body' }, { status: 400 })
  }

  const slug = (body.slug ?? '').toLowerCase().trim()

  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ available: false, error: 'Invalid slug format' })
  }

  const existing = await getWorkspaceBySlug(slug)
  return NextResponse.json({ available: !existing })
}
