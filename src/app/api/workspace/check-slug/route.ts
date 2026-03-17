import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$|^[a-z0-9]{2}$/

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'app', 'auth', 'login', 'logout', 'register', 'signup',
  'me', 'ws', 'workspace', 'workspaces', 'dashboard', 'settings', 'billing',
  'help', 'support', 'docs', 'legal', 'privacy', 'terms', 'status',
  'www', 'mail', 'smtp', 'ftp', 'ssh', 'cdn', 'static', 'assets',
  'health', 'ping', 'metrics', 'internal', 'system', 'root', 'null', 'undefined',
])

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

  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json({ available: false, error: 'This slug is reserved' })
  }

  const existing = await getWorkspaceBySlug(slug)
  return NextResponse.json({ available: !existing })
}
