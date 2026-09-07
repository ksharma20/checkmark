import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth'

/**
 * "Am I signed in?" — and nothing else.
 *
 * The marketing nav needs to know, and it cannot find out for itself: the
 * session cookie is httpOnly, so browser JS cannot read it. This is the smallest
 * honest answer to that question.
 *
 * It must be in `PUBLIC_API_ROUTES`, and for the usual reason (invariant 20):
 * `proxy.ts` cookie-gates every other `/api/*` route and would answer a signed-out
 * caller `401` before this handler ran. A 401 would technically encode "not
 * signed in", but it would also print an error in the console of every anonymous
 * visitor to the landing page. This returns 200 either way.
 *
 * It deliberately returns a BOOLEAN and no identity. The nav only ever decides
 * which two buttons to draw, and the pages calling it are public and statically
 * cached - putting a name or an email in this response would leak it into a
 * place that has no business holding one.
 */
export async function GET() {
  const session = await getSessionFromCookies()

  return NextResponse.json(
    { signedIn: !!session },
    {
      // Per-user and must never be shared by a CDN or reused after a login or
      // logout. The pages that call this are static; this response is not.
      headers: { 'Cache-Control': 'private, no-store' },
    },
  )
}
