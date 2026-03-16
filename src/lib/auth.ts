import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'cm_session'
const TOKEN_EXPIRY = '30d'
const BCRYPT_ROUNDS = 12

// ─── JWT ─────────────────────────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export interface JwtPayload {
  sub: string   // userId
  email: string
  iat: number
  exp: number
}

export async function createJwt(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSessionFromCookies(): Promise<JwtPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyJwt(token)
}

export function getSessionFromRequest(request: NextRequest): Promise<JwtPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return Promise.resolve(null)
  return verifyJwt(token)
}

export function getBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function hashWifiSsid(ssid: string): Promise<string> {
  return bcrypt.hash(ssid, BCRYPT_ROUNDS)
}

export async function verifyWifiSsid(ssid: string, hash: string): Promise<boolean> {
  return bcrypt.compare(ssid, hash)
}

export function wifiSsidDisplay(ssid: string): string {
  if (ssid.length <= 3) return ssid + '***'
  return ssid.slice(0, 3) + '***'
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function otpExpiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString()
}

// ─── Server component helper ──────────────────────────────────────────────────

/** Read the user identity set by proxy.ts — only valid in Server Components and Route Handlers. */
export async function getServerUser(): Promise<{ userId: string; email: string } | null> {
  const h = await headers()
  const userId = h.get('x-user-id')
  const email = h.get('x-user-email')
  if (!userId || !email) return null
  return { userId, email }
}
