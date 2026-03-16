import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/db/queries/users'

export async function POST(request: NextRequest) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ error: 'Email required', code: 'MISSING_EMAIL' }, { status: 400 })
  }

  const user = await getUserByEmail(email)
  return NextResponse.json({ exists: !!user })
}
