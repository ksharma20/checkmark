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
    // "Am I signed in?" for the marketing nav. Cookie-gating it would answer a
    // signed-out visitor 401 before the handler ran; it returns 200 and a
    // boolean instead, so an anonymous landing-page view logs no error.
    "/api/auth/session",
    "/api/auth/check-email",
    "/api/auth/reset-password",
    "/api/workspace/check-slug",
    "/api/me/reactivate",
    // Machine callers. "Public" here means NOT COOKIE-GATED, not unauthenticated:
    // getSessionFromRequest only ever reads the session cookie, so a Bearer-token
    // caller is rejected here before its route can check anything.
    //
    // /api/push/cron authenticates itself against CRON_SECRET as its first act and
    // refuses outright when that env var is unset. Leaving it off this list meant
    // the GitHub Actions cron got a 401 from the middleware and NEVER RAN - taking
    // every milestone push, the auto-checkout warning, auto-checkout itself and both
    // wall-clock reminders down with it.
    "/api/push/cron",
    // Returns the VAPID public key, which is public by definition. SwRegister is
    // mounted in the root layout, so it runs on marketing pages too, where there is
    // no session and the 401 was silently swallowed.
    "/api/push/vapid-public-key",
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
