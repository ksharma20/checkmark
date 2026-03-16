import { NextRequest, NextResponse } from 'next/server'
import { acceptConsent, declineConsent } from '@/lib/db/queries/workspaces'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: { memberId?: string; action?: 'accept' | 'decline' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  if (!body.memberId || !body.action) {
    return NextResponse.json({ error: 'memberId and action are required', code: 'MISSING_FIELDS' }, { status: 400 })
  }
  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json({ error: 'action must be accept or decline', code: 'INVALID_ACTION' }, { status: 400 })
  }

  if (body.action === 'accept') {
    await acceptConsent(body.memberId, userId)
  } else {
    await declineConsent(body.memberId)
  }

  return NextResponse.json({ success: true })
}
