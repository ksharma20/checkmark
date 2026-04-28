import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getWorkspaceSignals } from '@/lib/db/queries/signals'
import { getActiveMembersWithDetails, createAdminOverride, getWorkspaceOverrides, setEffectiveCheckout } from '@/lib/db/queries/workspaces'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'
import { nextDateKey } from '@/lib/attendance-summary'
import type { MatchedBy } from '@/lib/signals'

interface Props { params: Promise<{ slug: string }> }

export interface DisputeEvent {
  event_id: string
  user_id: string
  dispute_type: 'signal_mismatch' | 'missing_checkout' | 'overridden'
  member_name: string
  member_email: string
  checkin_at: string
  checkout_at: string | null
  matched_by: MatchedBy
  location_label: string | null
  note: string | null
  source: string
  has_gps: boolean
  overridden: boolean
  checkout_location_mismatch: number | null
}

export interface DisputesResponse {
  events: DisputeEvent[]
  start_date: string
  end_date: string
  signals_configured: boolean
}

/**
 * GET /api/ws/[slug]/disputes?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns events that need admin attention:
 * unmatched signal events, events with no checkout, and already-overridden events.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workspace } = ctx
  const url = new URL(request.url)
  const today = todayInTz(workspace.display_timezone)
  const [defaultYear, defaultMonthNumber] = today.split('-').map(Number)
  const defaultMonth = String(defaultMonthNumber).padStart(2, '0')
  const defaultStart = `${defaultYear}-${defaultMonth}-01`
  const defaultEnd = today

  const startDate = url.searchParams.get('start') ?? defaultStart
  const endDate = url.searchParams.get('end') ?? defaultEnd
  const startUtc = localMidnightToUtc(startDate, workspace.display_timezone)
  const endUtc = localMidnightToUtc(nextDateKey(endDate), workspace.display_timezone)

  const [allEvents, memberDetails, overrides, workspaceSignals] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, {
      startDate: startUtc,
      endDate: endUtc,
    }),
    getActiveMembersWithDetails(workspace.id),
    getWorkspaceOverrides(workspace.id),
    getWorkspaceSignals(workspace.id),
  ])

  const memberMap = new Map(memberDetails.map((m) => [m.user_id, m]))
  const overriddenEventIds = new Set(overrides.map((o) => o.presence_event_id))

  const signals_configured = workspaceSignals.length > 0

  // Return events that are unmatched, missing checkout, or already overridden.
  const disputeEvents = allEvents.filter(
    (e) => e.matched_by === 'none' || e.checkout_at === null || overriddenEventIds.has(e.id)
  )

  const member = (userId: string) => memberMap.get(userId)

  const events: DisputeEvent[] = disputeEvents.map((e) => {
    const overridden = overriddenEventIds.has(e.id)
    return {
      event_id: e.id,
      user_id: e.user_id,
      dispute_type: overridden ? 'overridden' : e.checkout_at === null ? 'missing_checkout' : 'signal_mismatch',
      member_name: member(e.user_id)?.full_name ?? member(e.user_id)?.email ?? e.user_id,
      member_email: member(e.user_id)?.email ?? '',
      checkin_at: e.checkin_at,
      checkout_at: e.checkout_at,
      matched_by: e.matched_by,
      location_label: e.location_label,
      note: e.note,
      source: e.source,
      has_gps: e.gps_lat !== null,
      overridden,
      checkout_location_mismatch: e.checkout_location_mismatch ?? null,
    }
  })

  return NextResponse.json({
    events,
    start_date: startDate,
    end_date: endDate,
    signals_configured,
  } satisfies DisputesResponse)
}

/**
 * POST /api/ws/[slug]/disputes
 * Body: { event_id: string; note?: string }
 * Creates an admin override for the given event (marks it as "counted").
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { event_id, note, effective_checkout_at } = body as {
    event_id?: string
    note?: string
    effective_checkout_at?: string | null
  }

  if (!event_id) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 })
  }

  const override = await createAdminOverride({
    workspaceId: ctx.workspace.id,
    presenceEventId: event_id,
    adminUserId: ctx.userId,
    note: note ?? null,
  })

  if (effective_checkout_at) {
    await setEffectiveCheckout(override.id, ctx.workspace.id, effective_checkout_at)
  }

  return NextResponse.json({ override }, { status: 201 })
}
