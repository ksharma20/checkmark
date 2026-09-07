import { NextRequest, NextResponse } from 'next/server'
import { getUserApiTokens, createApiToken, type UserApiToken } from '@/lib/db/queries/users'
import { tokenPrefix } from '@/lib/auth'
import bcrypt from 'bcryptjs'

/**
 * `token_hash` is the only column on the row that must never reach the client.
 * Stripping it by `delete` on a shallow copy rather than by destructuring it
 * into a throwaway binding keeps the emitted JSON identical while leaving no
 * unused variable behind.
 */
function withoutTokenHash(token: UserApiToken): Omit<UserApiToken, 'token_hash'> {
  const safe: Partial<UserApiToken> = { ...token }
  delete safe.token_hash
  return safe as Omit<UserApiToken, 'token_hash'>
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const tokens = await getUserApiTokens(userId)
  // Never return token_hash to client
  return NextResponse.json({
    tokens: tokens.map(withoutTokenHash),
  })
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Token name is required', code: 'MISSING_NAME' }, { status: 400 })
  }

  // Generate a secure random token - shown to user exactly once
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const plainToken = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const tokenHash = await bcrypt.hash(plainToken, 10)
  const token = await createApiToken({ userId, name, tokenHash, tokenPrefix: tokenPrefix(plainToken) })

  return NextResponse.json({
    token: { id: token.id, name: token.name, created_at: token.created_at },
    // plain_token is shown only once - user must copy it now
    plain_token: `cm_${plainToken}`,
  })
}
