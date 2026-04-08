import { updateEventTrustFlags } from './db/queries/events'
import { getUserEvents } from './db/queries/events'
import { haversineMetres } from './geo'

export type TrustFlag =
  | 'mock_gps_suspected'
  | 'timezone_mismatch'
  | 'vpn_suspected'
  | 'impossible_travel'

interface EvalParams {
  eventId: string
  userId: string
  gpsAccuracyM: number | null
  deviceTimezone: string | null
  ipGeoLat: number | null
  ipGeoLng: number | null
  ipAddress: string
  gpsLat: number | null
  gpsLng: number | null
  checkinAt: string
}

export async function evaluateTrust(params: EvalParams): Promise<void> {
  const flags: TrustFlag[] = []

  // 1. Mock GPS: accuracy <= 1m
  if (params.gpsAccuracyM !== null && params.gpsAccuracyM <= 1) {
    flags.push('mock_gps_suspected')
  }

  // 2. Timezone mismatch: browser tz offset vs approximate IP geo tz
  if (params.deviceTimezone && params.ipGeoLng !== null) {
    try {
      const ipOffset = Math.round(params.ipGeoLng / 15) * 60 // approx minutes east of UTC
      const tzName = params.deviceTimezone
      // Get browser offset from timezone name
      const browserOffsetNeg = new Date().toLocaleString('en', { timeZone: tzName, timeZoneName: 'shortOffset' })
        .match(/GMT([+-]\d+(?::\d+)?)/)?.[1]
      if (browserOffsetNeg) {
        const [h, m = '0'] = browserOffsetNeg.replace('+', '').split(':')
        const browserOffset = parseInt(h) * 60 + (parseInt(h) >= 0 ? 1 : -1) * parseInt(m)
        if (Math.abs(browserOffset - ipOffset) > 90) flags.push('timezone_mismatch')
      }
    } catch { /* skip */ }
  }

  // 3. VPN/proxy check via ip-api
  const privatePatterns = ['127.', '::1', '192.168.', '10.', '172.']
  const isPrivate = privatePatterns.some((p) => params.ipAddress.startsWith(p))
  if (!isPrivate) {
    try {
      const res = await fetch(`http://ip-api.com/json/${params.ipAddress}?fields=proxy,hosting`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { proxy?: boolean; hosting?: boolean }
        if (data.proxy || data.hosting) flags.push('vpn_suspected')
      }
    } catch { /* skip */ }
  }

  // 4. Impossible travel: >500km from previous check-in within 2 hours
  if (params.gpsLat !== null && params.gpsLng !== null) {
    try {
      const { events } = await getUserEvents({ userId: params.userId, limit: 5 })
      const prev = events.find((e) => e.id !== params.eventId && e.gps_lat !== null && e.gps_lng !== null)
      if (prev && prev.gps_lat !== null && prev.gps_lng !== null) {
        const dist = haversineMetres(params.gpsLat, params.gpsLng, prev.gps_lat, prev.gps_lng)
        const checkinTs = prev.checkin_at.includes('T') ? prev.checkin_at : prev.checkin_at.replace(' ', 'T') + 'Z'
        const tDiff = Math.abs(new Date(params.checkinAt).getTime() - new Date(checkinTs).getTime())
        if (dist > 500_000 && tDiff < 2 * 3600 * 1000) flags.push('impossible_travel')
      }
    } catch { /* skip */ }
  }

  if (flags.length > 0) {
    await updateEventTrustFlags(params.eventId, flags)
  }
}
