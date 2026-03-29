import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { NextRequest } from 'next/server'
import { COOKIE_SESSION, COOKIE_OTP } from '@/lib/constants'

const COOKIE_NAME = COOKIE_SESSION
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
  jti: string   // unique token id — used for revocation
  iat: number
  exp: number
}

export async function createJwt(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
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
    sameSite: 'strict',
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
  if (process.env.NODE_ENV === 'development') {
    // First 6 digits of current Unix epoch seconds — predictable from the clock.
    // Stays constant for ~10,000 seconds (~2.7 hrs). Tell testers: floor(Date.now()/1000).toString().slice(0,6)
    return String(Math.floor(Date.now() / 1000)).slice(0, 6)
  }
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function otpExpiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString()
}

// ─── OTP verification cookie ─────────────────────────────────────────────────

const OTP_COOKIE_NAME = COOKIE_OTP

export async function setOtpVerifiedCookie(email: string): Promise<void> {
  const token = await new SignJWT({ email, purpose: 'otp_verified' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJwtSecret())
  const cookieStore = await cookies()
  cookieStore.set(OTP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  })
}

export async function verifyOtpCookie(email: string): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(OTP_COOKIE_NAME)?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload.email === email && payload.purpose === 'otp_verified'
  } catch {
    return false
  }
}

export async function clearOtpCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(OTP_COOKIE_NAME)
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
