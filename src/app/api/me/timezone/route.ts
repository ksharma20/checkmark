import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { updateUserTimezone } from '@/lib/db/queries/users'

// Rough IANA timezone validation — must contain a slash (e.g. "Asia/Kolkata")
function isValidIana(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { timezone, confirm } = body as { timezone?: string; confirm?: boolean }

  if (!timezone || !isValidIana(timezone)) {
    return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
  }

  await updateUserTimezone(user.userId, timezone, confirm === true)
  return NextResponse.json({ ok: true })
}
