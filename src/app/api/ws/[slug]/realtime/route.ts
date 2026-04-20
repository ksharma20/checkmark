import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getSignalConfigs } from '@/lib/db/queries/workspaces'

export interface RealtimeMinuteBucket {
  minute: number   // 0 = oldest, 29 = most recent
  label: string    // e.g. "30m ago", "now"
  count: number    // unique users active in that minute
}

export interface RealtimeLocation {
  label: string
  count: number
}

export interface RealtimeResponse {
  active_count: number          // unique users checked-in in last 30 min
  per_minute: RealtimeMinuteBucket[]
  locations: RealtimeLocation[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const now = Date.now()
  const windowMs = 30 * 60 * 1000
  const startMs = now - windowMs
  const startDate = new Date(startMs).toISOString()
  const endDate = new Date(now).toISOString()

  const [events, signalConfigs] = await Promise.all([
    queryWorkspaceEvents(ctx.workspace.id, ctx.workspace.plan, { startDate, endDate }),
    getSignalConfigs(ctx.workspace.id),
  ])

  // Only events checked in within the last 30 minutes
  const recentEvents = events.filter((ev) => {
    const checkinMs = new Date(
      ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z'
    ).getTime()
    return checkinMs >= startMs
  })

  // Per-minute buckets (0 = 29 min ago, 29 = current minute)
  const per_minute: RealtimeMinuteBucket[] = Array.from({ length: 30 }, (_, i) => {
    const bucketStart = startMs + i * 60000
    const bucketEnd = bucketStart + 60000
    const users = new Set<string>()
    for (const ev of recentEvents) {
      const checkinMs = new Date(
        ev.checkin_at.includes('T') ? ev.checkin_at : ev.checkin_at.replace(' ', 'T') + 'Z'
      ).getTime()
      // User is "active" in this bucket if they checked in during or before it
      // and either haven't checked out or checked out after the bucket started
      const checkoutMs = ev.checkout_at
        ? new Date(ev.checkout_at.includes('T') ? ev.checkout_at : ev.checkout_at.replace(' ', 'T') + 'Z').getTime()
        : Infinity
      if (checkinMs <= bucketEnd && checkoutMs >= bucketStart) {
        users.add(ev.user_id)
      }
    }
    const minsAgo = 29 - i
    const label = minsAgo === 0 ? 'now' : `${minsAgo}m`
    return { minute: i, label, count: users.size }
  })

  // Location breakdown — seed all configured locations first (count = 0), then fill from events
  const locationMap = new Map<string, Set<string>>()
  for (const cfg of signalConfigs) {
    const label = cfg.location_name
      ?? (cfg.signal_type === 'wifi' ? 'Office (Wi-Fi)' : cfg.signal_type === 'gps' ? 'Office (GPS)' : 'Remote')
    if (!locationMap.has(label)) locationMap.set(label, new Set())
  }
  for (const ev of recentEvents) {
    const isOffice = ev.matched_by === 'verified' || ev.matched_by === 'override'
    const loc = ev.location_label
      ?? (isOffice
        ? (ev.matched_signals.includes('wifi') ? 'Office (Wi-Fi)' : ev.matched_signals.includes('gps') ? 'Office (GPS)' : 'Office')
        : 'Remote')
    const users = locationMap.get(loc) ?? new Set()
    users.add(ev.user_id)
    locationMap.set(loc, users)
  }
  const active_count = new Set([...locationMap.values()].flatMap(s => [...s])).size

  const locations: RealtimeLocation[] = [...locationMap.entries()]
    .map(([label, users]) => ({ label, count: users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({ active_count, per_minute, locations } satisfies RealtimeResponse)
}
