import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventToday, checkoutEvent } from '@/lib/db/queries/events'
import { updateUserStats } from '@/lib/stats'
import { extractIp, getIpGeo } from '@/lib/geo'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // State machine: reject if not checked in
  const openEvent = await getOpenEventToday(userId)
  if (!openEvent) {
    return NextResponse.json(
      { error: "You're not checked in.", code: 'NOT_CHECKED_IN' },
      { status: 409 }
    )
  }

  // Parse optional location + reason body
  let body: {
    gps_lat?: number
    gps_lng?: number
    gps_accuracy_m?: number
    wifi_ssid?: string
    reason?: string
  } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  // Capture checkout-time IP geo (same pattern as check-in)
  const ip = extractIp(request)
  const geo = await getIpGeo(ip)

  const event = await checkoutEvent(openEvent.id, userId, {
    checkoutGpsLat: body.gps_lat ?? null,
    checkoutGpsLng: body.gps_lng ?? null,
    checkoutGpsAccuracyM: body.gps_accuracy_m ?? null,
    checkoutWifiSsid: body.wifi_ssid ?? null,
    checkoutIpAddress: ip,
    checkoutIpGeoLat: geo?.lat ?? null,
    checkoutIpGeoLng: geo?.lng ?? null,
    checkoutReason: body.reason ?? null,
  })

  if (!event) {
    return NextResponse.json({ error: 'Checkout failed', code: 'CHECKOUT_FAILED' }, { status: 500 })
  }

  const durationHours = event.checkout_at
    ? (new Date(event.checkout_at).getTime() - new Date(event.checkin_at).getTime()) / (1000 * 60 * 60)
    : null

  updateUserStats(userId).catch(console.error)

  return NextResponse.json({ event, duration_hours: durationHours })
}
