import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { todayInTz } from '@/lib/timezone'
import { getCelebrationsInMonth, type UpcomingCelebration } from '@/lib/db/queries/employees'
import { Action, Resource } from '@/lib/permissions/catalogue'

export interface CelebrationsResponse {
  /** Echoed back so the card's heading can never disagree with its rows. */
  month: string
  celebrations: UpcomingCelebration[]
}

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Celebrations for one calendar month.
 *
 * Its own route rather than another field on `/overview`: the overview route
 * takes no parameters and is fetched once on mount, and threading a month
 * through it would re-run the approvals queue and the department breakdown
 * every time somebody stepped back a month.
 *
 * Gated on `Resource.Dashboard` - the same gate as the widget's own page, not a
 * resource of its own. An unparseable month falls back to the current one in
 * the WORKSPACE's timezone rather than 400-ing: an admin in London must not see
 * a different month from one in Kolkata.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Dashboard, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const today = todayInTz(ctx.workspace.display_timezone)
  const param = req.nextUrl.searchParams.get('month')
  const month = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : today.slice(0, 7)

  const celebrations = await getCelebrationsInMonth(ctx.workspace.id, month, today)

  return NextResponse.json({ month, celebrations } satisfies CelebrationsResponse)
}
