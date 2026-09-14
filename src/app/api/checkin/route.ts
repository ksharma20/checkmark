import { NextRequest, NextResponse } from 'next/server'
import { createEvent, getOpenEventToday, setScheduledCheckout, updateEventLocationLabel } from '@/lib/db/queries/events'
import { getRateLimitCount, recordRateLimitHit } from '@/lib/db/queries/users'
import { getUserStats } from '@/lib/db/queries/stats'
import { extractIp, getIpGeo } from '@/lib/geo'
import { updateUserStats } from '@/lib/stats'
import { reverseGeocodeLabel } from '@/lib/geo-label'
import { evaluateTrust } from '@/lib/trust'
import { getPresencePrefsForUser } from '@/lib/db/queries/presence-prefs'
import {
  DEFAULT_PRESENCE_PREFS,
  MAX_AUTO_CHECKOUT_H,
  MIN_AUTO_CHECKOUT_H,
} from '@/lib/presence-ladder'

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
    gps_lat?: number;
    gps_lng?: number;
    gps_accuracy_m?: number;
    note?: string;
    event_type?: string;
    is_remote?: boolean;
    device_info?: string | null;
    device_timezone?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const ip = extractIp(request);
  const geo = await getIpGeo(ip);

  // Backwards compatibility: older clients send `is_remote: true`.
  // Canonical representation is `event_type: 'remote_checkin'`.
  const resolvedEventType =
    body.event_type ?? (body.is_remote ? "remote_checkin" : "office_checkin");

  const event = await createEvent({
    userId,
    eventType: resolvedEventType,
    ipAddress: ip,
    ipGeoLat: geo?.lat ?? null,
    ipGeoLng: geo?.lng ?? null,
    gpsLat: body.gps_lat ?? null,
    gpsLng: body.gps_lng ?? null,
    gpsAccuracyM: body.gps_accuracy_m ?? null,
    note: body.note ?? null,
    source: "user_app",
    deviceInfo: body.device_info ?? null,
    deviceTimezone: body.device_timezone ?? null,
  });
  if (!event)
    return NextResponse.json({ error: 'Check-in failed', code: 'DB_ERROR' }, { status: 500 })

  /**
   * Schedule the auto-checkout, at the member's own hour count.
   *
   * This was a hardcoded 12 hours. `DEFAULT_PRESENCE_PREFS.autoCheckoutAfterH`
   * is 12 for exactly that reason, so a member who has never opened the session
   * settings gets the identical time they got before this table existed - the
   * deploy changes nobody's behaviour, only their ability to change it
   * themselves.
   *
   * A FAILED PREFERENCE READ MUST NOT FAIL THE CHECK-IN. Recording presence is
   * the product; a scheduling preference is a detail of what happens twelve
   * hours later, and letting it block the write would mean a member standing in
   * the office unable to say so because of a table they may not even have a row
   * in. The fallback is the same default as having no row, which is the outcome
   * they would almost certainly have got anyway.
   */
  let autoCheckoutAfterH = DEFAULT_PRESENCE_PREFS.autoCheckoutAfterH
  try {
    autoCheckoutAfterH = (await getPresencePrefsForUser(userId)).autoCheckoutAfterH
  } catch (err) {
    console.error('[checkin] presence prefs lookup failed; using the default close time:', err)
  }

  /**
   * Clamped here as well as validated in `/api/me/presence-prefs`, because this
   * is the value that decides when somebody's day is closed and the route is not
   * the only thing that could ever have written the row - a migration, a support
   * fix or a future importer all reach the column directly. A stored 0 would
   * close the session in the same instant it opened; a stored 10000 would leave
   * it open past the point the cron will even look at it (CRON_MAX_EVENT_AGE_H),
   * which means never closed at all.
   */
  const clampedH = Math.min(
    MAX_AUTO_CHECKOUT_H,
    Math.max(MIN_AUTO_CHECKOUT_H, autoCheckoutAfterH),
  )
  const autoCheckoutAt = new Date(Date.now() + clampedH * 60 * 60 * 1000).toISOString()
  await setScheduledCheckout(event.id, autoCheckoutAt)

  updateUserStats(userId).catch(console.error)

  // Fire-and-forget: resolve GPS to human label and store (avoids client-side 429s)
  // Retries once after 30s on failure
  if (event.gps_lat !== null && event.gps_lng !== null) {
    const lat = event.gps_lat
    const lng = event.gps_lng
    const tryGeocode = (attempt: number): void => {
      reverseGeocodeLabel(lat, lng)
        .then((label) => {
          if (label) return updateEventLocationLabel(event.id, label)
        })
        .catch(() => {
          if (attempt < 2) {
            setTimeout(() => tryGeocode(attempt + 1), 30_000)
          }
        })
    }
    tryGeocode(1)
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
