import { getWorkspaceSignals } from './db/queries/signals'
import { getActiveMemberIds } from './db/queries/workspaces'
import { getEventsForUsers, PresenceEvent } from './db/queries/events'
import { getOverrideEventIds } from './db/queries/workspaces'
import { haversineMetres } from './geo'
import { verifyWifiSsid } from './auth'
import { historyStartDate, getPlanLimits } from './plans'

export { haversineMetres }

export type MatchedBy = 'wifi' | 'gps' | 'ip' | 'none' | 'override'

export interface PresenceEventWithMatch extends PresenceEvent {
  matched_by: MatchedBy
}

export interface QueryWorkspaceEventsOptions {
  startDate: string
  endDate: string
  userId?: string
  overrideGpsRadius?: number
  overrideShowAll?: boolean
  eventType?: string
}

/**
 * The core dashboard query.
 * Returns presence events for enrolled users, filtered by signal config.
 * If no signal config exists: returns all events for enrolled users (config-light).
 */
export async function queryWorkspaceEvents(
  workspaceId: string,
  workspacePlan: string,
  options: QueryWorkspaceEventsOptions
): Promise<PresenceEventWithMatch[]> {
  const planLimits = getPlanLimits(workspacePlan)

  // Apply plan history gate
  let effectiveStart = options.startDate
  const historyGate = historyStartDate(workspacePlan)
  if (historyGate && effectiveStart < historyGate) {
    effectiveStart = historyGate
  }

  // Get active member user IDs (only status='active' members)
  let memberIds = await getActiveMemberIds(workspaceId)

  // Apply user limit for free plan
  if (planLimits.maxUsers !== null && memberIds.length > planLimits.maxUsers) {
    memberIds = memberIds.slice(0, planLimits.maxUsers)
  }

  // Filter to specific user if requested
  if (options.userId) {
    memberIds = memberIds.filter((id) => id === options.userId)
  }

  if (memberIds.length === 0) return []

  // Fetch all events in range for these users
  const events = await getEventsForUsers({
    userIds: memberIds,
    start: effectiveStart,
    end: options.endDate,
  })

  // Apply event type filter
  const filteredEvents = options.eventType
    ? events.filter((e) => e.event_type === options.eventType)
    : events

  // Get signal configs
  const signals = await getWorkspaceSignals(workspaceId)
  const overrideEventIds = await getOverrideEventIds(workspaceId)

  // Config-light mode: no signals configured OR admin override
  if (signals.length === 0 || options.overrideShowAll) {
    return filteredEvents.map((event) => ({
      ...event,
      matched_by: overrideEventIds.has(event.id) ? 'override' : 'none',
    }))
  }

  // Signal matching mode
  // WiFi hashes need async bcrypt comparison — collect them first
  const wifiSignals = signals.filter((s) => s.signal_type === 'wifi' && s.wifi_ssid_hash)
  const gpsSignals = signals.filter((s) => s.signal_type === 'gps' && s.gps_lat !== null && s.gps_lng !== null)
  const ipSignals = signals.filter((s) => s.signal_type === 'ip' && s.ip_geo_lat !== null && s.ip_geo_lng !== null)

  const result: PresenceEventWithMatch[] = []

  for (const event of filteredEvents) {
    // Admin override takes precedence
    if (overrideEventIds.has(event.id)) {
      result.push({ ...event, matched_by: 'override' })
      continue
    }

    let matchedBy: MatchedBy = 'none'

    // Check GPS signals
    if (matchedBy === 'none' && event.gps_lat !== null && event.gps_lng !== null) {
      for (const signal of gpsSignals) {
        const radius = options.overrideGpsRadius ?? signal.gps_radius_m ?? 300
        const distance = haversineMetres(
          event.gps_lat,
          event.gps_lng,
          signal.gps_lat!,
          signal.gps_lng!
        )
        if (distance < radius) {
          matchedBy = 'gps'
          break
        }
      }
    }

    // Check IP signals
    if (matchedBy === 'none' && event.ip_geo_lat !== null && event.ip_geo_lng !== null) {
      for (const signal of ipSignals) {
        const distance = haversineMetres(
          event.ip_geo_lat,
          event.ip_geo_lng,
          signal.ip_geo_lat!,
          signal.ip_geo_lng!
        )
        if (distance < (signal.ip_proximity_m ?? 500)) {
          matchedBy = 'ip'
          break
        }
      }
    }

    // Check WiFi signals (async bcrypt)
    if (matchedBy === 'none' && event.wifi_ssid && wifiSignals.length > 0) {
      for (const signal of wifiSignals) {
        const matches = await verifyWifiSsid(event.wifi_ssid, signal.wifi_ssid_hash!)
        if (matches) {
          matchedBy = 'wifi'
          break
        }
      }
    }

    result.push({ ...event, matched_by: matchedBy })
  }

  return result
}
