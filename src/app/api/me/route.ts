import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUserName, deactivateUser } from '@/lib/db/queries/users'
import { getSoleAdminWorkspaces } from '@/lib/db/queries/workspaces'
import { clearSessionCookie } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const user = await getUserById(userId)
  if (!user) return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ user: { id: user.id, email: user.email, fullName: user.full_name } })
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { fullName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const fullName = (body.fullName ?? '').trim()
  if (!fullName) {
    return NextResponse.json({ error: 'fullName is required', code: 'MISSING_FIELD' }, { status: 400 })
  }

  await updateUserName(userId, fullName)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Block if this user is the sole admin of any active workspace — deactivating
  // would orphan it with no way to recover access.
  const soleAdminOf = await getSoleAdminWorkspaces(userId)
  if (soleAdminOf.length > 0) {
    return NextResponse.json(
      {
        error: 'SOLE_ADMIN',
        workspaces: soleAdminOf.map((w) => ({ slug: w.slug, name: w.name })),
      },
      { status: 409 }
    )
  }

  // Soft delete — data is preserved; user can reactivate by logging back in
  await deactivateUser(userId)
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
