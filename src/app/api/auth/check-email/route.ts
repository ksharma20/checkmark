import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmailIncludeDeleted } from '@/lib/db/queries/users'

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

  const user = await getUserByEmailIncludeDeleted(email)
  if (!user) return NextResponse.json({ exists: false })

  // Tell the frontend if the account is deactivated so it can show a reactivation step
  return NextResponse.json({
    exists: true,
    deactivated: user.deleted_at !== null,
  })
}
