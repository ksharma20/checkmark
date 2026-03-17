import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getUserByEmailIncludeDeleted, getUserById, createOtp, getLatestUnusedOtp, incrementOtpAttempts, markOtpUsed, updateUserEmail } from '@/lib/db/queries/users'
import { generateOtp, otpExpiresAt } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function err(msg: string, code: string, status: number) {
  return NextResponse.json({ error: msg, code }, { status })
}

/**
 * POST /api/me/email
 *
 * Step 1 — request: { newEmail }   → sends OTP to newEmail
 * Step 2 — confirm: { newEmail, code } → verifies OTP, updates email
 */
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return err('Unauthorized', 'UNAUTHORIZED', 401)

  let body: { newEmail?: string; code?: string }
  try { body = await request.json() } catch {
    return err('Invalid body', 'INVALID_BODY', 400)
  }

  const newEmail = (body.newEmail ?? '').toLowerCase().trim()
  if (!newEmail || !EMAIL_RE.test(newEmail)) {
    return err('Valid email address is required', 'INVALID_EMAIL', 400)
  }

  const user = await getUserById(userId)
  if (!user) return err('User not found', 'NOT_FOUND', 404)

  if (newEmail === user.email.toLowerCase()) {
    return err('New email must be different from current email', 'SAME_EMAIL', 400)
  }

  // Check the new email isn't already taken (including deactivated accounts)
  const existing = await getUserByEmailIncludeDeleted(newEmail)
  if (existing) return err('That email is already in use', 'EMAIL_TAKEN', 409)

  // ── Step 2: verify OTP and update ──
  if (body.code) {
    const inputCode = body.code.trim()
    const latest = await getLatestUnusedOtp(newEmail, 'email_change')
    if (!latest) return err('No pending code. Request a new one.', 'NO_PENDING_OTP', 400)
    if (latest.attempts >= 5) return err('Too many incorrect attempts. Request a new code.', 'TOO_MANY_ATTEMPTS', 429)

    if (latest.code !== inputCode) {
      await incrementOtpAttempts(latest.id)
      return err('Invalid or expired code', 'INVALID_OTP', 400)
    }

    await markOtpUsed(latest.id)
    await updateUserEmail(userId, newEmail)
    return NextResponse.json({ updated: true })
  }

  // ── Step 1: send OTP ──
  const code = generateOtp()
  await createOtp({ email: newEmail, code, purpose: 'email_change', expiresAt: otpExpiresAt() })
  await sendOtpEmail(newEmail, code)

  return NextResponse.json({ sent: true })
}
