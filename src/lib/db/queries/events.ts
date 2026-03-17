import { db } from '../index'

export interface PresenceEvent {
  id: string
  user_id: string
  event_type: string
  checkin_at: string
  checkout_at: string | null
  note: string | null
  wifi_ssid: string | null
  ip_address: string
  ip_geo_lat: number | null
  ip_geo_lng: number | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy_m: number | null
  source: string
  api_token_id: string | null
  created_at: string
  // Checkout-time signals (captured when user checks out)
  checkout_gps_lat: number | null
  checkout_gps_lng: number | null
  checkout_gps_accuracy_m: number | null
  checkout_wifi_ssid: string | null
  checkout_ip_address: string | null
  checkout_ip_geo_lat: number | null
  checkout_ip_geo_lng: number | null
  location_label: string | null
  deleted_at: string | null
}

export async function createEvent(params: {
  userId: string
  eventType?: string
  wifiSsid?: string | null
  ipAddress: string
  ipGeoLat?: number | null
  ipGeoLng?: number | null
  gpsLat?: number | null
  gpsLng?: number | null
  gpsAccuracyM?: number | null
  note?: string | null
  source?: string
  apiTokenId?: string | null
}): Promise<PresenceEvent> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO presence_events
       (id, user_id, event_type, wifi_ssid, ip_address, ip_geo_lat, ip_geo_lng,
        gps_lat, gps_lng, gps_accuracy_m, note, source, api_token_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.eventType ?? 'office_checkin',
      params.wifiSsid ?? null,
      params.ipAddress,
      params.ipGeoLat ?? null,
      params.ipGeoLng ?? null,
      params.gpsLat ?? null,
      params.gpsLng ?? null,
      params.gpsAccuracyM ?? null,
      params.note ?? null,
      params.source ?? 'user_app',
      params.apiTokenId ?? null,
    ]
  )
  return db.queryOne<PresenceEvent>('SELECT * FROM presence_events WHERE id = ?', [id]) as Promise<PresenceEvent>
}

export async function checkoutEvent(
  eventId: string,
  userId: string,
  signals?: {
    checkoutGpsLat?: number | null
    checkoutGpsLng?: number | null
    checkoutGpsAccuracyM?: number | null
    checkoutWifiSsid?: string | null
    checkoutIpAddress?: string | null
    checkoutIpGeoLat?: number | null
    checkoutIpGeoLng?: number | null
  }
): Promise<PresenceEvent | null> {
  await db.execute(
    `UPDATE presence_events
     SET checkout_at = datetime('now'),
         checkout_gps_lat = ?,
         checkout_gps_lng = ?,
         checkout_gps_accuracy_m = ?,
         checkout_wifi_ssid = ?,
         checkout_ip_address = ?,
         checkout_ip_geo_lat = ?,
         checkout_ip_geo_lng = ?
     WHERE id = ? AND user_id = ? AND checkout_at IS NULL`,
    [
      signals?.checkoutGpsLat ?? null,
      signals?.checkoutGpsLng ?? null,
      signals?.checkoutGpsAccuracyM ?? null,
      signals?.checkoutWifiSsid ?? null,
      signals?.checkoutIpAddress ?? null,
      signals?.checkoutIpGeoLat ?? null,
      signals?.checkoutIpGeoLng ?? null,
      eventId,
      userId,
    ]
  )
  return db.queryOne<PresenceEvent>('SELECT * FROM presence_events WHERE id = ?', [eventId])
}

export async function getOpenEventToday(userId: string): Promise<PresenceEvent | null> {
  return db.queryOne<PresenceEvent>(
    `SELECT * FROM presence_events
     WHERE user_id = ? AND checkout_at IS NULL AND deleted_at IS NULL
       AND date(checkin_at) = date('now')
     ORDER BY checkin_at DESC LIMIT 1`,
    [userId]
  )
}

export async function getMostRecentOpenEvent(userId: string): Promise<PresenceEvent | null> {
  return db.queryOne<PresenceEvent>(
    `SELECT * FROM presence_events
     WHERE user_id = ? AND checkout_at IS NULL AND deleted_at IS NULL
     ORDER BY checkin_at DESC LIMIT 1`,
    [userId]
  )
}

export async function getUserEvents(params: {
  userId: string
  start?: string
  end?: string
  limit?: number
  offset?: number
}): Promise<{ events: PresenceEvent[]; total: number }> {
  const conditions: string[] = ['user_id = ?', 'deleted_at IS NULL']
  const args: unknown[] = [params.userId]

  if (params.start) {
    conditions.push('checkin_at >= ?')
    args.push(params.start)
  }
  if (params.end) {
    conditions.push('checkin_at <= ?')
    args.push(params.end)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const countResult = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM presence_events ${where}`,
    args
  )
  const total = countResult?.total ?? 0

  const limit = params.limit ?? 50
  const offset = params.offset ?? 0

  const events = await db.query<PresenceEvent>(
    `SELECT * FROM presence_events ${where} ORDER BY checkin_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  )

  return { events, total }
}

/** Returns an event only if it belongs to the given user and is not soft-deleted. */
export async function getEventByIdForUser(eventId: string, userId: string): Promise<PresenceEvent | null> {
  return db.queryOne<PresenceEvent>(
    'SELECT * FROM presence_events WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [eventId, userId]
  )
}

export async function updateEventNote(eventId: string, userId: string, note: string): Promise<PresenceEvent | null> {
  await db.execute(
    'UPDATE presence_events SET note = ? WHERE id = ? AND user_id = ?',
    [note, eventId, userId]
  )
  return db.queryOne<PresenceEvent>('SELECT * FROM presence_events WHERE id = ?', [eventId])
}

export async function deleteEvent(eventId: string, userId: string): Promise<boolean> {
  // Only soft-deletable within 5 minutes of creation
  const event = await db.queryOne<PresenceEvent>(
    `SELECT * FROM presence_events WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
    [eventId, userId]
  )
  if (!event) return false

  // Normalize SQLite datetime before computing age
  const createdAt = event.created_at.includes('T')
    ? event.created_at
    : event.created_at.replace(' ', 'T') + 'Z'
  const ageMs = Date.now() - new Date(createdAt).getTime()
  if (ageMs > 5 * 60 * 1000) return false

  await db.execute(
    `UPDATE presence_events SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
    [eventId, userId]
  )
  return true
}

export async function updateEventLocationLabel(eventId: string, label: string): Promise<void> {
  await db.execute(
    'UPDATE presence_events SET location_label = ? WHERE id = ?',
    [label, eventId]
  )
}

export async function getEventsForUsers(params: {
  userIds: string[]
  start: string
  end: string
}): Promise<PresenceEvent[]> {
  if (params.userIds.length === 0) return []
  const placeholders = params.userIds.map(() => '?').join(', ')
  return db.query<PresenceEvent>(
    `SELECT * FROM presence_events
     WHERE user_id IN (${placeholders})
       AND checkin_at >= ? AND checkin_at <= ?
       AND deleted_at IS NULL
     ORDER BY checkin_at DESC`,
    [...params.userIds, params.start, params.end]
  )
}
