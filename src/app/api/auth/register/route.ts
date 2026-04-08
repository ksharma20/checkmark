import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUser } from '@/lib/db/queries/users'
import {
  getVerifiedDomainsForEmail,
  addWorkspaceMember,
  getWorkspaceMemberByEmail,
  getAdminWorkspacesForUser,
  createWorkspace,
  getWorkspaceBySlug,
  linkUserToMemberRecord,
} from '@/lib/db/queries/workspaces'
import { hashPassword, createJwt, setSessionCookie, verifyOtpCookie, clearOtpCookie } from '@/lib/auth'
import { validateSlug } from '@/lib/slug'
import { validatePassword } from '@/lib/password'

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

function getRedirectAfterLogin(adminWorkspaces: { slug: string }[]): string {
  if (adminWorkspaces.length === 0) return '/me'
  if (adminWorkspaces.length === 1) return `/ws/${adminWorkspaces[0].slug}`
  return '/ws'
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string
    full_name?: string
    password?: string
    accountType?: 'personal' | 'org'
    // org-only fields
    orgName?: string
    orgSlug?: string
    orgDomain?: string
    // legacy fallback
    invite?: string
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  const full_name = (body.full_name ?? '').trim()
  const password = body.password ?? ''
  const accountType = body.accountType ?? 'personal'

  if (!email) return apiError('Email is required', 'MISSING_EMAIL', 400)
  if (!full_name) return apiError('Full name is required', 'MISSING_NAME', 400)
  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) return apiError(pwCheck.error, 'WEAK_PASSWORD', 400)

  // Verify OTP cookie
  const otpOk = await verifyOtpCookie(email)
  if (!otpOk) {
    return apiError('Email verification required', 'OTP_NOT_VERIFIED', 400)
  }

  // Check user doesn't already exist
  const existing = await getUserByEmail(email)
  if (existing) {
    return apiError('An account with this email already exists', 'EMAIL_TAKEN', 409)
  }

  // Org registration validations
  if (accountType === 'org') {
    const orgName = (body.orgName ?? '').trim()
    const orgSlug = (body.orgSlug ?? '').toLowerCase().trim()
    if (!orgName) return apiError('Organisation name is required', 'MISSING_ORG_NAME', 400)
    const slugCheck = validateSlug(orgSlug)
    if (!slugCheck.valid) return apiError(slugCheck.error, 'INVALID_SLUG', 400)
    const slugTaken = await getWorkspaceBySlug(orgSlug)
    if (slugTaken) return apiError('That URL handle is already taken', 'SLUG_TAKEN', 409)
  }

  const passwordHash = await hashPassword(password)
  const user = await createUser({ email, passwordHash, fullName: full_name })

  // Link any pending invited memberships for this email to the new user account
  await linkUserToMemberRecord(email, user.id)

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
      await addWorkspaceMember({
        workspaceId,
        userId: user.id,
        email,
        role: alreadyMember.role,
        status: 'active',
      })
    }
  }

  // Create workspace for org accounts
  if (accountType === 'org') {
    const orgName = (body.orgName ?? '').trim()
    const orgSlug = (body.orgSlug ?? '').toLowerCase().trim()
    const orgDomain = (body.orgDomain ?? '').toLowerCase().trim()
    const domains = orgDomain ? [orgDomain] : []
    await createWorkspace({
      slug: orgSlug,
      name: orgName,
      creatorUserId: user.id,
      creatorEmail: email,
      domains,
    })
  }

  await clearOtpCookie()
  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect = getRedirectAfterLogin(adminWorkspaces)

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
    redirect,
  })
}
