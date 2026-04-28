import { NextRequest, NextResponse } from 'next/server'
import { getLatestUnusedOtp, getValidOtp, incrementOtpAttempts, markOtpUsed } from '@/lib/db/queries/users'
import { setOtpVerifiedCookie } from '@/lib/auth'

const MAX_ATTEMPTS = 5

function apiError(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status })
}

export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid request body', 'INVALID_BODY', 400)
  }

  const email = (body.email ?? '').toLowerCase().trim()
  const code = (body.code ?? '').trim()

  if (!email || !code) {
    return apiError('Email and code are required', 'MISSING_FIELDS', 400)
  }

  // Check attempt count on the latest pending OTP before comparing code
  const latest = await getLatestUnusedOtp(email, 'signup')
  if (!latest) {
    return apiError('Invalid or expired code', 'INVALID_OTP', 400)
  }

  if (latest.attempts >= MAX_ATTEMPTS) {
    return apiError('Too many incorrect attempts. Request a new code.', 'TOO_MANY_ATTEMPTS', 429)
  }

  const otp = await getValidOtp(email, code, 'signup')
  if (!otp) {
    // Wrong code - increment attempts on the latest OTP
    await incrementOtpAttempts(latest.id)
    return apiError('Invalid or expired code', 'INVALID_OTP', 400)
  }

  await markOtpUsed(otp.id)
  await setOtpVerifiedCookie(email)

  return NextResponse.json({ verified: true })
}
