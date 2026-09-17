import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUser } from '@/lib/db/queries/users'
import {
  getVerifiedDomainsForEmail,
  getWorkspaceMemberByEmail,
  getAdminWorkspacesForUser,
} from '@/lib/db/queries/workspaces'
import { autoEnrolIntoWorkspace, claimPendingMemberships } from '@/lib/membership'
import { hashPassword, createJwt, setSessionCookie, verifyOtpCookie, clearOtpCookie } from '@/lib/auth'
import { validatePassword } from '@/lib/password'
import { getRedirectAfterLogin } from '@/lib/permissions/ranks'

/**
 * Create an account. An ACCOUNT - nothing else.
 *
 * This route used to take `accountType`, `orgName`, `orgSlug` and `orgDomain`
 * and, for `accountType === 'org'`, create a workspace in the same request. The
 * type was never stored; it only decided whether that block ran. Sign-up now
 * asks a new user for the two things an account needs, and creating a workspace
 * is a separate, deliberate act at `/ws/new` (`POST /api/workspace`), which is
 * also the only path that can be reached by someone who already has one.
 *
 * What stays, in order, because each step guards the next:
 *
 *  1. the `cm_otp_ok` cookie must prove this email (invariant 3) - never a flag
 *     from the body;
 *  2. `EMAIL_TAKEN` before any write;
 *  3. `claimPendingMemberships()` links `user_id` on invitations addressed to
 *     this email and NOTHING more - signing up is not consent, and the HR record
 *     is claimed in `acceptMembership()` when they actually accept;
 *  4. verified-domain auto-enrol, which IS consent (the workspace has declared
 *     everyone on that domain staff), so it lands `active` in one step;
 *  5. the session cookie, and only then a redirect.
 */

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

export async function POST(request: NextRequest) {
  let body: {
    email?: string
    full_name?: string
    password?: string
  }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  const full_name = (body.full_name ?? '').trim()
  const password = body.password ?? ''

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

  const passwordHash = await hashPassword(password)
  const user = await createUser({ email, passwordHash, fullName: full_name })

  // Link any pending invited memberships for this email to the new user account
  // - and NOTHING more. The invitations stay pending: signing up is not consent,
  // and joining an employer's workspace stays an explicit click. The HR record
  // filed under that address is claimed when they accept, in
  // `acceptMembership()`, not here.
  await claimPendingMemberships(email, user.id)

  // Auto-enrol based on verified domain
  const matchingWorkspaceIds = await getVerifiedDomainsForEmail(email)
  for (const workspaceId of matchingWorkspaceIds) {
    const alreadyMember = await getWorkspaceMemberByEmail(workspaceId, email)
    await autoEnrolIntoWorkspace({
      workspaceId,
      userId: user.id,
      email,
      existingMemberId: alreadyMember?.id ?? null,
      existingStatus: alreadyMember?.status ?? null,
    })
  }

  await clearOtpCookie()
  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  // Usually `/me` - a brand-new account holds no org access. It can still be a
  // workspace: an auto-enrol above may have landed them somewhere that grants it.
  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect = getRedirectAfterLogin(adminWorkspaces)

  return NextResponse.json({
    user: { id: user.id, email: user.email, full_name: user.full_name },
    redirect,
  })
}
