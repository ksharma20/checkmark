/**
 * Node.js-only session helpers — NOT imported by src/proxy.ts (Edge middleware).
 * Use these in Server Components, Route Handlers, and Layouts.
 */
import { getSessionFromCookies, JwtPayload } from '@/lib/auth'
import { isTokenRevoked } from '@/lib/db/queries/tokens'

/**
 * Returns the verified, non-revoked session from the session cookie.
 * Returns null if: cookie missing, JWT invalid/expired, or token revoked.
 */
export async function getCheckedSession(): Promise<JwtPayload | null> {
  const session = await getSessionFromCookies()
  if (!session) return null
  if (session.jti && await isTokenRevoked(session.jti)) return null
  return session
}
