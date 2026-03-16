import { NextRequest, NextResponse } from 'next/server'
import { countRecentOtps, createOtp } from '@/lib/db/queries/users'
import { generateOtp, otpExpiresAt } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

export async function POST(request: NextRequest) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email) {
    return apiError('Email is required', 'MISSING_EMAIL', 400)
  }

  // Rate limit: max 3 OTP sends per email per hour
  const recentCount = await countRecentOtps(email, 60)
  if (recentCount >= 3) {
    return apiError('Too many OTP requests. Try again later.', 'RATE_LIMITED', 429)
  }

  const code = generateOtp()
  const expiresAt = otpExpiresAt()

  await createOtp({ email, code, purpose: 'signup', expiresAt })
  await sendOtpEmail(email, code)

  return NextResponse.json({ sent: true, expiresIn: 600 })
}
