import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmailIncludeDeleted } from '@/lib/db/queries/users'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { verifyPassword, createJwt, setSessionCookie } from '@/lib/auth'

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

function getRedirectAfterLogin(adminWorkspaces: { slug: string }[]): string {
  if (adminWorkspaces.length === 0) return '/me'
  if (adminWorkspaces.length === 1) return `/ws/${adminWorkspaces[0].slug}`
  return '/ws'
}

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email) {
    return apiError('Email is required', 'MISSING_EMAIL', 400)
  }

  // Step 1: Check if user exists (frontend uses check-email, but kept for safety)
  if (!body.password) {
    const user = await getUserByEmailIncludeDeleted(email)
    if (!user) return NextResponse.json({ exists: false })
    return NextResponse.json({ exists: true, deactivated: user.deleted_at !== null })
  }

  // Step 2: Verify password
  const user = await getUserByEmailIncludeDeleted(email)
  if (!user) {
    return apiError('Invalid credentials', 'INVALID_CREDENTIALS', 401)
  }

  const valid = await verifyPassword(body.password, user.password_hash)
  if (!valid) {
    return apiError('Invalid credentials', 'INVALID_CREDENTIALS', 401)
  }

  // Deactivated account — password is correct but account is soft-deleted
  if (user.deleted_at !== null) {
    return NextResponse.json(
      { error: 'Account deactivated', code: 'ACCOUNT_DEACTIVATED', email },
      { status: 403 }
    )
  }

  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect = getRedirectAfterLogin(adminWorkspaces)

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
    redirect,
  })
}
