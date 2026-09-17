import { handleFocusEnd } from '@/lib/space-focus'

/**
 * `POST /api/focus/interrupt` - the member stopped the timer early.
 *
 * Identical to `/api/focus/complete` except for the one column it sets, and it
 * still writes a row: a session somebody deliberately ended is a fact about
 * their day, and dropping it would make the record flattering rather than true.
 * Interrupted sessions are counted in the day's session total and excluded from
 * its focused minutes - see `/api/focus/stats`.
 */

export async function POST(request: Request) {
  return handleFocusEnd(request, { interrupted: true })
}
