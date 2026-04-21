import { NextRequest, NextResponse } from 'next/server'
import { createEvent, getOpenEventToday, setScheduledCheckout, updateEventLocationLabel } from '@/lib/db/queries/events'
import { getRateLimitCount, recordRateLimitHit } from '@/lib/db/queries/users'
import { getUserStats } from '@/lib/db/queries/stats'
import { extractIp, getIpGeo } from '@/lib/geo'
import { updateUserStats } from '@/lib/stats'
import { reverseGeocodeLabel } from '@/lib/geo-label'
import { evaluateTrust } from '@/lib/trust'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Rate limit: max 10 check-ins per user per hour (prevents spam)
  const checkinKey = `checkin:${userId}`
  if (await getRateLimitCount(checkinKey, 'checkin', 60) >= 10) {
    return NextResponse.json(
      { error: 'Too many check-ins. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }
  await recordRateLimitHit(checkinKey, 'checkin')

  // State machine: reject if already checked in
  const openEvent = await getOpenEventToday(userId)
  if (openEvent) {
    return NextResponse.json(
      { error: "You're already checked in. Check out first.", code: 'ALREADY_CHECKED_IN' },
      { status: 409 }
    )
  }

  let body: {
    gps_lat?: number
    gps_lng?: number
    gps_accuracy_m?: number
    wifi_ssid?: string
    note?: string
    event_type?: string
    device_info?: string | null
    device_timezone?: string | null
  }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const ip = extractIp(request)
  const geo = await getIpGeo(ip)

  const event = await createEvent({
    userId,
    eventType: body.event_type ?? 'office_checkin',
    wifiSsid: body.wifi_ssid ?? null,
    ipAddress: ip,
    ipGeoLat: geo?.lat ?? null,
    ipGeoLng: geo?.lng ?? null,
    gpsLat: body.gps_lat ?? null,
    gpsLng: body.gps_lng ?? null,
    gpsAccuracyM: body.gps_accuracy_m ?? null,
    note: body.note ?? null,
    source: 'user_app',
    deviceInfo: body.device_info ?? null,
    deviceTimezone: body.device_timezone ?? null,
  })
  if (!event)
    return NextResponse.json({ error: 'Check-in failed', code: 'DB_ERROR' }, { status: 500 })

  // Schedule auto-checkout 12 hours after check-in
  const autoCheckoutAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  await setScheduledCheckout(event.id, autoCheckoutAt)

  updateUserStats(userId).catch(console.error)

  // Fire-and-forget: resolve GPS to human label and store (avoids client-side 429s)
  if (event.gps_lat !== null && event.gps_lng !== null) {
    reverseGeocodeLabel(event.gps_lat, event.gps_lng)
      .then((label) => { if (label) return updateEventLocationLabel(event.id, label) })
      .catch(() => {})
  }

  // Fire-and-forget: evaluate trust signals async
  evaluateTrust({
    eventId: event.id,
    userId,
    gpsAccuracyM: event.gps_accuracy_m,
    deviceTimezone: body.device_timezone ?? null,
    ipGeoLat: event.ip_geo_lat,
    ipGeoLng: event.ip_geo_lng,
    ipAddress: event.ip_address,
    gpsLat: event.gps_lat,
    gpsLng: event.gps_lng,
    checkinAt: event.checkin_at,
  }).catch(() => {})

  const stats = await getUserStats(userId)
  return NextResponse.json({ event: { ...event, scheduled_checkout_at: autoCheckoutAt }, stats })
}
