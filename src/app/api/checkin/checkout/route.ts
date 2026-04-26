import { NextRequest, NextResponse } from 'next/server'
import { getOpenEventToday, checkoutEvent, updateCheckoutLocationLabel } from '@/lib/db/queries/events'
import { updateUserStats } from '@/lib/stats'
import { extractIp, getIpGeo, haversineMetres } from '@/lib/geo'
import { getGpsSignalsForUser } from '@/lib/db/queries/workspaces'
import { reverseGeocodeLabel } from '@/lib/geo-label'

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

  // Compute checkout_location_mismatch using workspace-configured GPS radius
  let checkoutLocationMismatch: number | null = null
  let outsideRadius = false
  if (body.gps_lat != null && body.gps_lng != null) {
    const gpsSignals = await getGpsSignalsForUser(userId)
    if (gpsSignals.length > 0) {
      let minDist = Infinity
      let matchedRadius = 300
      for (const sig of gpsSignals) {
        const dist = haversineMetres(body.gps_lat, body.gps_lng, sig.gps_lat, sig.gps_lng)
        if (dist < minDist) { minDist = dist; matchedRadius = sig.gps_radius_m }
      }
      checkoutLocationMismatch = Math.round(minDist)
      outsideRadius = minDist > matchedRadius
    }
  }

  const trustFlags = openEvent.trust_flags ? (JSON.parse(openEvent.trust_flags) as string[]) : []
  if (outsideRadius) trustFlags.push('checkout_outside_radius')

  const event = await checkoutEvent(openEvent.id, userId, {
    checkoutGpsLat: body.gps_lat ?? null,
    checkoutGpsLng: body.gps_lng ?? null,
    checkoutGpsAccuracyM: body.gps_accuracy_m ?? null,
    checkoutIpAddress: ip,
    checkoutIpGeoLat: geo?.lat ?? null,
    checkoutIpGeoLng: geo?.lng ?? null,
    checkoutReason: body.reason ?? null,
    checkoutLocationMismatch,
    trustFlags,
  })

  if (!event) {
    return NextResponse.json({ error: 'Checkout failed', code: 'CHECKOUT_FAILED' }, { status: 500 })
  }

  const durationHours = event.checkout_at
    ? (new Date(event.checkout_at).getTime() - new Date(event.checkin_at).getTime()) / (1000 * 60 * 60)
    : null

  updateUserStats(userId).catch(console.error)

  // Fire-and-forget: resolve checkout GPS to human label
  if (body.gps_lat != null && body.gps_lng != null) {
    reverseGeocodeLabel(body.gps_lat, body.gps_lng)
      .then((label) => { if (label) return updateCheckoutLocationLabel(event.id, label) })
      .catch(() => {})
  }

  return NextResponse.json({ event, duration_hours: durationHours })
}
