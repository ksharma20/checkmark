import { NextRequest, NextResponse } from 'next/server'
import { getValidOtp, markOtpUsed } from '@/lib/db/queries/users'

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

  const otp = await getValidOtp(email, code, 'signup')
  if (!otp) {
    return apiError('Invalid or expired code', 'INVALID_OTP', 400)
  }

  await markOtpUsed(otp.id)

  return NextResponse.json({ verified: true })
}
