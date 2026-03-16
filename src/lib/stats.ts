import {
  getTotalCheckins,
  getTotalHours,
  getCheckinsThisMonth,
  getDistinctCheckinDates,
  getCheckinsThisMonthWithGps,
  upsertUserStats,
  getUserStats,
} from './db/queries/stats'
import { haversineMetres } from './geo'

export { getUserStats }

/**
 * Recompute and upsert user_stats after every check-in.
 * Called by the check-in API route.
 */
export async function updateUserStats(userId: string): Promise<void> {
  const [totalCheckins, totalHours, checkinsThisMonth, allDates, gpsPoints] = await Promise.all([
    getTotalCheckins(userId),
    getTotalHours(userId),
    getCheckinsThisMonth(userId),
    getDistinctCheckinDates(userId),
    getCheckinsThisMonthWithGps(userId),
  ])

  // ─── Streak calculation ──────────────────────────────────────────────────
  // allDates is ordered DESC (newest first)
  let currentStreak = 0
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (let i = 0; i < allDates.length; i++) {
    const checkinDate = new Date(allDates[i] + 'T00:00:00Z')
    const expected = new Date(today)
    expected.setUTCDate(today.getUTCDate() - i)

    if (checkinDate.getTime() === expected.getTime()) {
      currentStreak++
    } else {
      break
    }
  }

  // ─── Longest streak ───────────────────────────────────────────────────────
  const existing = await getUserStats(userId)
  const longestStreak = Math.max(existing?.longest_streak ?? 0, currentStreak)

  // ─── Distinct GPS clusters this month ─────────────────────────────────────
  // Simple clustering: count points that are >500m from all previously seen cluster centres
  const CLUSTER_RADIUS_M = 500
  const clusterCentres: Array<{ lat: number; lng: number }> = []

  for (const point of gpsPoints) {
    const nearExisting = clusterCentres.some(
      (c) => haversineMetres(c.lat, c.lng, point.gps_lat, point.gps_lng) < CLUSTER_RADIUS_M
    )
    if (!nearExisting) {
      clusterCentres.push({ lat: point.gps_lat, lng: point.gps_lng })
    }
  }

  const lastCheckinDate = allDates[0] ?? null

  await upsertUserStats(userId, {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_checkins: totalCheckins,
    total_hours_logged: totalHours,
    checkins_this_month: checkinsThisMonth,
    distinct_locations_this_month: clusterCentres.length,
    last_checkin_date: lastCheckinDate,
  })
}
