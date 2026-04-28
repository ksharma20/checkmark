import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from './lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── /me/* - requires valid session ──────────────────────────────────────
  if (pathname.startsWith('/me')) {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // Attach user info to request headers for downstream use
    const response = NextResponse.next()
    response.headers.set('x-user-id', session.sub)
    response.headers.set('x-user-email', session.email)
    return response
  }

  // ─── /ws/* - requires valid session (admin check done per-route) ──────────
  if (pathname.startsWith('/ws')) {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const response = NextResponse.next()
    response.headers.set('x-user-id', session.sub)
    response.headers.set('x-user-email', session.email)
    return response
  }

  // ─── /api/* - validate JWT from cookie ────────────────────────────────────
  // /api/v1/* uses Bearer token - handled inside those route handlers
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/v1') && !isPublicApiRoute(pathname)) {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    const response = NextResponse.next()
    response.headers.set('x-user-id', session.sub)
    response.headers.set('x-user-email', session.email)
    return response
  }

  return NextResponse.next()
}

function isPublicApiRoute(pathname: string): boolean {
  const PUBLIC_API_ROUTES = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/otp/send",
    "/api/auth/otp/verify",
    "/api/auth/logout",
    "/api/auth/check-email",
    "/api/auth/reset-password",
    "/api/workspace/check-slug",
    "/api/me/reactivate",
  ];
  return PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(route))
}

export const config = {
  matcher: [
    '/me/:path*',
    '/ws/:path*',
    '/api/:path*',
  ],
}
