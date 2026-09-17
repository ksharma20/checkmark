import { handleFocusEnd } from '@/lib/space-focus'

/**
 * `POST /api/focus/complete` - the member's timer ran to zero.
 *
 * THIS IS WHERE THE ROW IS WRITTEN. There is no start endpoint: the timer is
 * entirely client-side, so nothing has to be kept alive between start and
 * finish, and a row created at start would stay open forever for every session
 * the member abandoned with no cron to close it (sub-project E puts a
 * server-side timer explicitly out of scope). An abandoned session leaving no
 * row at all is the honest record - nobody focused.
 *
 * `started_at` is derived server-side as `now - actual_duration_min`, so the
 * only number the browser supplies is a bounded duration and no session can be
 * placed in the future or backdated into a day it did not happen.
 */

export async function POST(request: Request) {
  return handleFocusEnd(request, { interrupted: false })
}
