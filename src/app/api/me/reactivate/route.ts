import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmailIncludeDeleted, reactivateUser } from '@/lib/db/queries/users'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { verifyPassword, createJwt, setSessionCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const email = (body.email ?? '').toLowerCase().trim()
  const password = body.password ?? ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  const user = await getUserByEmailIncludeDeleted(email)
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  // Reactivate — clear deleted_at
  await reactivateUser(user.id)

  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect =
    adminWorkspaces.length === 0 ? '/me' :
    adminWorkspaces.length === 1 ? `/ws/${adminWorkspaces[0].slug}` : '/ws'

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
    redirect,
  })
}
