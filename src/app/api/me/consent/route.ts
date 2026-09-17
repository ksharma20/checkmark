import { NextRequest, NextResponse } from 'next/server'
import { acceptMembership, declineMembership } from '@/lib/membership'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  if (!userId || !userEmail) {
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

  // `memberId` comes from the client, so the row is re-checked against the
  // session email inside acceptMembership/declineMembership. Without that, any
  // signed-in user who learned another person's member id could accept an
  // invitation addressed to them.
  const result = body.action === 'accept'
    ? await acceptMembership(body.memberId, userId, userEmail)
    : await declineMembership(body.memberId, userEmail)

  if (!result.ok) {
    // EXPIRED is a 410, not a 409: the invitation was real and is now gone,
    // which is exactly what Gone means - and it is the one refusal with a
    // remedy, so the client renders it differently and says "ask an admin to
    // re-send". It can only come back from accept; declining an expired
    // invitation still succeeds.
    if (result.code === 'EXPIRED') {
      return NextResponse.json(
        { error: 'That invitation has expired. Ask an admin to send you a new one.', code: 'INVITE_EXPIRED' },
        { status: 410 },
      )
    }
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'WRONG_ACCOUNT' ? 403 : 409
    const error =
      result.code === 'NOT_FOUND' ? 'That invitation no longer exists'
      : result.code === 'WRONG_ACCOUNT' ? 'That invitation was sent to a different email address'
      : 'That invitation has already been answered'
    return NextResponse.json({ error, code: result.code }, { status })
  }

  return NextResponse.json({ success: true })
}
