import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'

interface Props { params: Promise<{ slug: string }> }

function toUtcIso(s: string | null): string {
  if (!s) return ''
  if (s.includes('T')) return s.endsWith('Z') ? s : s + 'Z'
  return s.replace(' ', 'T') + 'Z'
}

function formatTz(utcStr: string | null, tz: string): string {
  if (!utcStr) return ''
  const date = new Date(toUtcIso(utcStr))
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(',', '')
}

function csvEscape(val: string | number | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * GET /api/ws/[slug]/export?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Downloads a CSV of presence events for all active members.
 * Requires Starter or Growth plan. Enforces plan history window.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workspace } = ctx
  const url = new URL(request.url)
  const now = new Date()
  const defaultYear = now.getUTCFullYear()
  const defaultMonth = String(now.getUTCMonth() + 1).padStart(2, '0')
  const defaultStart = `${defaultYear}-${defaultMonth}-01`
  const defaultEnd = new Date(defaultYear, now.getUTCMonth() + 1, 0).toISOString().slice(0, 10)

  const startDate = url.searchParams.get('start') ?? defaultStart
  const endDate = url.searchParams.get('end') ?? defaultEnd
  const tz = workspace.display_timezone

  const [allEvents, memberDetails] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, {
      startDate,
      endDate: endDate + 'T23:59:59Z',
    }),
    getActiveMembersWithDetails(workspace.id),
  ])

  const memberMap = new Map(memberDetails.map((m) => [m.user_id, m]))

  const headers = [
    'member_name',
    'member_email',
    'matched_by',
    `checkin_at_${tz.replace(/\//g, '_')}`,
    `checkout_at_${tz.replace(/\//g, '_')}`,
    'duration_hours',
    'location_label',
  ]

  const rows: string[][] = [headers]

  for (const ev of allEvents) {
    const member = memberMap.get(ev.user_id)
    const checkinUtc = toUtcIso(ev.checkin_at)
    const checkoutUtc = ev.checkout_at ? toUtcIso(ev.checkout_at) : null

    let durationHours = ''
    if (checkinUtc && checkoutUtc) {
      const diff = (new Date(checkoutUtc).getTime() - new Date(checkinUtc).getTime()) / (1000 * 60 * 60)
      durationHours = Math.round(diff * 100) / 100 + ''
    }

    const isRemote = ev.event_type === 'remote_checkin' || ev.matched_by === 'partial'
    const displayLabel = isRemote ? 'Remote' : 'Office'

    rows.push([
      member?.full_name ?? member?.email ?? ev.user_id,
      member?.email ?? '',
      ev.matched_by,
      formatTz(ev.checkin_at, tz),
      checkoutUtc ? formatTz(ev.checkout_at!, tz) : '',
      durationHours,
      displayLabel,
    ])
  }

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')

  const filename = `checkmark-export-${slug}-${startDate}-to-${endDate}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
