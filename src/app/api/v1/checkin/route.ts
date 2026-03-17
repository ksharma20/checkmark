import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAllActiveApiTokens, touchApiToken } from '@/lib/db/queries/users'
import { createEvent, updateEventLocationLabel } from '@/lib/db/queries/events'
import { updateUserStats } from '@/lib/stats'
import { extractIp, getIpGeo } from '@/lib/geo'
import { reverseGeocodeLabel } from '@/lib/geo-label'

/**
 * POST /api/v1/checkin
 *
 * Creates a presence event authenticated via a personal API token.
 *
 * Authorization: Bearer cm_<token>
 *
 * Body (all optional):
 *   gps_lat, gps_lng, gps_accuracy_m, wifi_ssid, note, event_type
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Bearer token required', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const raw = authHeader.slice(7).trim() // cm_<hex> or just <hex>
  const plain = raw.startsWith('cm_') ? raw.slice(3) : raw

  // Find matching token by bcrypt comparison (O(n), acceptable for v1)
  const allTokens = await getAllActiveApiTokens()
  let matchedToken = null
  for (const token of allTokens) {
    if (await bcrypt.compare(plain, token.token_hash)) {
      matchedToken = token
      break
    }
  }

  if (!matchedToken) {
    return NextResponse.json({ error: 'Invalid or revoked token', code: 'INVALID_TOKEN' }, { status: 401 })
  }

  // Touch last_used_at (fire-and-forget)
  touchApiToken(matchedToken.id).catch(console.error)

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
    userId: matchedToken.user_id,
    eventType: body.event_type ?? 'office_checkin',
    wifiSsid: body.wifi_ssid ?? null,
    ipAddress: ip,
    ipGeoLat: geo?.lat ?? null,
    ipGeoLng: geo?.lng ?? null,
    gpsLat: body.gps_lat ?? null,
    gpsLng: body.gps_lng ?? null,
    gpsAccuracyM: body.gps_accuracy_m ?? null,
    note: body.note ?? null,
    source: 'api_token',
    apiTokenId: matchedToken.id,
  })

  updateUserStats(matchedToken.user_id).catch(console.error)

  if (event.gps_lat !== null && event.gps_lng !== null) {
    reverseGeocodeLabel(event.gps_lat, event.gps_lng)
      .then((label) => { if (label) return updateEventLocationLabel(event.id, label) })
      .catch(() => {})
  }

  return NextResponse.json({ event })
}
