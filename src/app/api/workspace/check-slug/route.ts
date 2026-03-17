import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { validateSlug } from '@/lib/slug'

export async function POST(request: NextRequest) {
  let body: { slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ available: false, error: 'Invalid body' }, { status: 400 })
  }

  const slug = (body.slug ?? '').toLowerCase().trim()
  const result = validateSlug(slug)
  if (!result.valid) {
    return NextResponse.json({ available: false, error: result.error })
  }

  const existing = await getWorkspaceBySlug(slug)
  return NextResponse.json({ available: !existing })
}
