import { db } from '../index'

export interface UserStats {
  user_id: string
  current_streak: number
  longest_streak: number
  total_checkins: number
  total_hours_logged: number
  checkins_this_month: number
  distinct_locations_this_month: number
  last_checkin_date: string | null
  updated_at: string
}

export async function getUserStats(userId: string): Promise<UserStats | null> {
  return db.queryOne<UserStats>('SELECT * FROM user_stats WHERE user_id = ?', [userId])
}

export async function upsertUserStats(userId: string, stats: Omit<UserStats, 'user_id' | 'updated_at'>): Promise<void> {
  await db.execute(
    `INSERT INTO user_stats
       (user_id, current_streak, longest_streak, total_checkins, total_hours_logged,
        checkins_this_month, distinct_locations_this_month, last_checkin_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       current_streak = excluded.current_streak,
       longest_streak = excluded.longest_streak,
       total_checkins = excluded.total_checkins,
       total_hours_logged = excluded.total_hours_logged,
       checkins_this_month = excluded.checkins_this_month,
       distinct_locations_this_month = excluded.distinct_locations_this_month,
       last_checkin_date = excluded.last_checkin_date,
       updated_at = datetime('now')`,
    [
      userId,
      stats.current_streak,
      stats.longest_streak,
      stats.total_checkins,
      stats.total_hours_logged,
      stats.checkins_this_month,
      stats.distinct_locations_this_month,
      stats.last_checkin_date,
    ]
  )
}

// Raw query helpers used by lib/stats.ts

export async function getTotalCheckins(userId: string): Promise<number> {
  const result = await db.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM presence_events WHERE user_id = ?',
    [userId]
  )
  return result?.count ?? 0
}

export async function getTotalHours(userId: string): Promise<number> {
  const result = await db.queryOne<{ total: number }>(
    `SELECT COALESCE(SUM(
       (strftime('%s', checkout_at) - strftime('%s', checkin_at)) / 3600.0
     ), 0) as total
     FROM presence_events
     WHERE user_id = ? AND checkout_at IS NOT NULL`,
    [userId]
  )
  return result?.total ?? 0
}

export async function getCheckinsThisMonth(userId: string): Promise<number> {
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM presence_events
     WHERE user_id = ?
       AND strftime('%Y-%m', checkin_at) = strftime('%Y-%m', 'now')`,
    [userId]
  )
  return result?.count ?? 0
}

export async function getDistinctCheckinDates(userId: string): Promise<string[]> {
  const rows = await db.query<{ date: string }>(
    `SELECT DISTINCT date(checkin_at) as date
     FROM presence_events
     WHERE user_id = ?
     ORDER BY date DESC`,
    [userId]
  )
  return rows.map((r) => r.date)
}

export async function getCheckinsThisMonthWithGps(userId: string): Promise<Array<{ gps_lat: number; gps_lng: number }>> {
  return db.query<{ gps_lat: number; gps_lng: number }>(
    `SELECT gps_lat, gps_lng FROM presence_events
     WHERE user_id = ?
       AND gps_lat IS NOT NULL AND gps_lng IS NOT NULL
       AND strftime('%Y-%m', checkin_at) = strftime('%Y-%m', 'now')`,
    [userId]
  )
}
