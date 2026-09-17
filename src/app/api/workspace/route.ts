import { NextRequest, NextResponse } from 'next/server'
import { createWorkspace, getWorkspaceBySlug, getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { getUserByEmail } from '@/lib/db/queries/users'
import { validateSlug } from '@/lib/slug'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const active = await getAdminWorkspacesForUser(userId)
  return NextResponse.json({
    active: active.map((w) => ({ id: w.id, slug: w.slug, name: w.name })),
    count: active.length,
  })
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  if (!userId || !userEmail) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { name?: string; slug?: string; orgType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const slug = (body.slug ?? '').trim().toLowerCase()

  if (!name) {
    return NextResponse.json({ error: 'Organisation name is required', code: 'MISSING_NAME' }, { status: 400 })
  }

  const slugCheck = validateSlug(slug)
  if (!slugCheck.valid) {
    return NextResponse.json({ error: slugCheck.error, code: 'INVALID_SLUG' }, { status: 400 })
  }

  const existing = await getWorkspaceBySlug(slug)
  if (existing) {
    return NextResponse.json({ error: 'Slug is already taken', code: 'SLUG_TAKEN' }, { status: 409 })
  }

  // No cap on how many workspaces one account may create.
  //
  // This used to answer `403 WORKSPACE_LIMIT_REACHED` to anybody whose account
  // already held org access ANYWHERE - including in somebody else's workspace,
  // which they did not create and cannot leave. Multi-workspace membership is
  // supported by the whole rest of the product (`/me`'s workspace pill exists
  // for exactly that), so the refusal only blocked the one person who wanted a
  // second one of their own. `createWorkspace` still seeds the system roles in
  // the same transaction as the workspace row (invariant 10), so every one of
  // them has an owner who can actually run it.

  // Get user record to use email
  const user = await getUserByEmail(userEmail)
  const email = user?.email ?? userEmail

  const workspace = await createWorkspace({
    slug,
    name,
    creatorUserId: userId,
    creatorEmail: email,
  })

  return NextResponse.json({ workspace: { id: workspace.id, slug: workspace.slug, name: workspace.name } })
}
