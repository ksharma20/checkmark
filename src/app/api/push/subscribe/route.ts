import { NextRequest, NextResponse } from 'next/server'
import { upsertPushSubscription, deletePushSubscription } from '@/lib/db/queries/push'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth)
    return NextResponse.json(
      { error: 'Missing subscription fields', code: 'INVALID_SUBSCRIPTION' },
      { status: 400 }
    )

  await upsertPushSubscription({
    userId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  })

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (!body.endpoint)
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  await deletePushSubscription(userId, body.endpoint)
  return NextResponse.json({ unsubscribed: true })
}
