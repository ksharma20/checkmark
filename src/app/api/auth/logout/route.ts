import { NextResponse } from 'next/server'
import { clearSessionCookie, getSessionFromCookies } from '@/lib/auth'
import { revokeToken } from '@/lib/db/queries/tokens'

export async function POST() {
  // Revoke the current token so it can't be reused after logout
  const session = await getSessionFromCookies()
  if (session?.jti) {
    const expiresAt = new Date(session.exp * 1000).toISOString()
    await revokeToken(session.jti, expiresAt)
  }

  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
