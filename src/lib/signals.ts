import { getWorkspaceSignals, WorkspaceSignalConfig } from './db/queries/signals'
import { getActiveMemberIds } from './db/queries/workspaces'
import { getEventsForUsers, PresenceEvent } from './db/queries/events'
import { getOverrideEventIds } from './db/queries/workspaces'
import { haversineMetres } from './geo'
import { verifyWifiSsid } from './auth'
import { historyStartDate, getPlanLimits } from './plans'

export { haversineMetres }

export type MatchedBy = 'wifi' | 'gps' | 'ip' | 'none' | 'unverified' | 'override'

export interface PresenceEventWithMatch extends PresenceEvent {
  matched_by: MatchedBy
  matched_signals: string[]  // which signal types actually matched: e.g. ['gps', 'wifi']
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

  // Config-light mode: no signals configured at all — return all events unfiltered
  if (signals.length === 0) {
    return filteredEvents.map((event) => ({
      ...event,
      matched_by: overrideEventIds.has(event.id) ? 'override' as MatchedBy : 'none' as MatchedBy,
      matched_signals: [] as string[],
    }))
  }

  // Signal matching mode
  // WiFi hashes need async bcrypt comparison — collect them first
  type GpsSignal = WorkspaceSignalConfig & { gps_lat: number; gps_lng: number }
  type IpSignal = WorkspaceSignalConfig & { ip_geo_lat: number; ip_geo_lng: number }

  const wifiSignals = signals.filter((s) => s.signal_type === 'wifi' && s.wifi_ssid_hash)
  const gpsSignals = signals.filter((s): s is GpsSignal =>
    s.signal_type === 'gps' && s.gps_lat !== null && s.gps_lng !== null
  )
  const ipSignals = signals.filter((s): s is IpSignal =>
    s.signal_type === 'ip' && s.ip_geo_lat !== null && s.ip_geo_lng !== null
  )

  // Determine which signal types are configured for this workspace
  const configuredTypes = new Set<string>()
  if (gpsSignals.length > 0) configuredTypes.add('gps')
  if (ipSignals.length > 0) configuredTypes.add('ip')
  if (wifiSignals.length > 0) configuredTypes.add('wifi')

  const result: PresenceEventWithMatch[] = []

  for (const event of filteredEvents) {
    // Admin override always passes through — bypass signal matching entirely
    if (overrideEventIds.has(event.id)) {
      result.push({ ...event, matched_by: 'override', matched_signals: [] })
      continue
    }

    let matchedBy: MatchedBy = 'unverified'

    // Check GPS signals
    if (matchedBy === 'unverified' && event.gps_lat !== null && event.gps_lng !== null) {
      for (const signal of gpsSignals) {
        const radius = options.overrideGpsRadius ?? signal.gps_radius_m ?? 300
        if (haversineMetres(event.gps_lat, event.gps_lng, signal.gps_lat, signal.gps_lng) <= radius) {
          matched.add('gps')
          break
        }
      }
    }

    // Check IP signals
    if (matchedBy === 'unverified' && event.ip_geo_lat !== null && event.ip_geo_lng !== null) {
      for (const signal of ipSignals) {
        if (haversineMetres(event.ip_geo_lat, event.ip_geo_lng, signal.ip_geo_lat, signal.ip_geo_lng) <= (signal.ip_proximity_m ?? 500)) {
          matched.add('ip')
          break
        }
      }
    }

    // Check WiFi signals (async bcrypt)
    if (matchedBy === 'unverified' && event.wifi_ssid && wifiSignals.length > 0) {
      for (const signal of wifiSignals) {
        if (await verifyWifiSsid(event.wifi_ssid, signal.wifi_ssid_hash!)) {
          matched.add('wifi')
          break
        }
      }
    }

    // AND semantics: ALL configured types must match
    const allMatched = configuredTypes.size > 0 && [...configuredTypes].every(t => matched.has(t))
    const anyMatched = matched.size > 0
    const matched_by: MatchedBy = allMatched ? 'verified' : anyMatched ? 'partial' : 'none'

    result.push({ ...event, matched_by, matched_signals: [...matched] })
  }

  return result
}

/**
 * Returns true only if the event was fully verified AND checkout location matched.
 * Used to determine whether hours count as "in office" presence.
 */
export function eventCountsAsOfficePresence(event: PresenceEventWithMatch): boolean {
  if (event.matched_by !== 'verified') return false
  // If checkout GPS was captured and mismatched office location, don't count hours
  if (event.checkout_location_mismatch !== null && event.checkout_location_mismatch > 0) return false
  return true
}
