import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUser } from '@/lib/db/queries/users'
import {
  getVerifiedDomainsForEmail,
  addWorkspaceMember,
  getWorkspaceMemberByEmail,
  getAdminWorkspacesForUser,
} from '@/lib/db/queries/workspaces'
import { hashPassword, createJwt, setSessionCookie } from '@/lib/auth'

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

function getRedirectAfterLogin(adminWorkspaces: { slug: string }[]): string {
  if (adminWorkspaces.length === 0) return '/me'
  if (adminWorkspaces.length === 1) return `/ws/${adminWorkspaces[0].slug}`
  return '/ws'
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string
    fullName?: string
    password?: string
    otpVerified?: boolean
    invite?: string
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  const fullName = (body.fullName ?? '').trim()
  const password = body.password ?? ''

  if (!email) return apiError('Email is required', 'MISSING_EMAIL', 400)
  if (!fullName) return apiError('Full name is required', 'MISSING_NAME', 400)
  if (!password || password.length < 8) {
    return apiError('Password must be at least 8 characters', 'WEAK_PASSWORD', 400)
  }
  if (!body.otpVerified) {
    return apiError('Email verification required', 'OTP_NOT_VERIFIED', 400)
  }

  // Check user doesn't already exist
  const existing = await getUserByEmail(email)
  if (existing) {
    return apiError('An account with this email already exists', 'EMAIL_TAKEN', 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await createUser({ email, passwordHash, fullName })

  // Auto-enrol based on verified domain
  const matchingWorkspaceIds = await getVerifiedDomainsForEmail(email)
  for (const workspaceId of matchingWorkspaceIds) {
    const alreadyMember = await getWorkspaceMemberByEmail(workspaceId, email)
    if (!alreadyMember) {
      await addWorkspaceMember({
        workspaceId,
        userId: user.id,
        email,
        role: 'member',
        status: 'active',
      })
    } else if (alreadyMember.status === 'pending_consent') {
      // Link existing pending member to the new user account
      await addWorkspaceMember({
        workspaceId,
        userId: user.id,
        email,
        role: alreadyMember.role,
        status: 'active',
      })
    }
  }

  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect = getRedirectAfterLogin(adminWorkspaces)

  return NextResponse.json({
    user: { id: user.id, email: user.email, fullName: user.full_name },
    redirect,
  })
}
