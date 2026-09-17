import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, updateUserPassword } from '@/lib/db/queries/users'
import { verifyOtpCookie, createJwt, setSessionCookie, hashPassword } from '@/lib/auth'
import { validatePassword } from '@/lib/password'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import { getRedirectAfterLogin } from '@/lib/permissions/ranks'

export async function POST(request: NextRequest) {
  let body: { email?: string; newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email)
    return NextResponse.json({ error: 'Email required', code: 'MISSING_EMAIL' }, { status: 400 })
  if (!body.newPassword)
    return NextResponse.json({ error: 'New password required', code: 'MISSING_PASSWORD' }, { status: 400 })

  // OTP cookie must be valid for this email
  const otpValid = await verifyOtpCookie(email)
  if (!otpValid)
    return NextResponse.json({ error: 'OTP verification required', code: 'OTP_REQUIRED' }, { status: 403 })

  // validatePassword returns { valid: true } | { valid: false; error: string }
  const passwordResult = validatePassword(body.newPassword)
  if (!passwordResult.valid)
    return NextResponse.json({ error: passwordResult.error, code: 'WEAK_PASSWORD' }, { status: 400 })

  const user = await getUserByEmail(email)
  if (!user)
    return NextResponse.json({ error: 'Account not found', code: 'NOT_FOUND' }, { status: 404 })

  const newHash = await hashPassword(body.newPassword)
  await updateUserPassword(user.id, newHash)

  // Issue a new session
  const token = await createJwt(user.id, user.email)
  await setSessionCookie(token)

  // One spelling of "where does this person land", shared with login, register
  // and reactivate. Three hand-written copies of the same ladder is three places
  // for it to drift.
  const adminWorkspaces = await getAdminWorkspacesForUser(user.id)
  const redirect = getRedirectAfterLogin(adminWorkspaces)

  return NextResponse.json({ success: true, redirect })
}
