import { NextRequest, NextResponse } from 'next/server'
import { getUserById, updateUserPassword } from '@/lib/db/queries/users'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { validatePassword } from '@/lib/password'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required', code: 'MISSING_FIELDS' }, { status: 400 })
  }
  const pwCheck = validatePassword(body.newPassword)
  if (!pwCheck.valid) {
    return NextResponse.json({ error: pwCheck.error, code: 'WEAK_PASSWORD' }, { status: 400 })
  }

  const user = await getUserById(userId)
  if (!user) return NextResponse.json({ error: 'User not found', code: 'NOT_FOUND' }, { status: 404 })

  const valid = await verifyPassword(body.currentPassword, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' }, { status: 401 })
  }

  const hash = await hashPassword(body.newPassword)
  await updateUserPassword(userId, hash)

  return NextResponse.json({ success: true })
}
