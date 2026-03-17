import { NextRequest, NextResponse } from 'next/server'
import { createEvent, getOpenEventToday } from '@/lib/db/queries/events'
import { getUserStats } from '@/lib/db/queries/stats'
import { extractIp, getIpGeo } from '@/lib/geo'
import { updateUserStats } from '@/lib/stats'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

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
  })

  updateUserStats(userId).catch(console.error)

  const stats = await getUserStats(userId)
  return NextResponse.json({ event, stats })
}
