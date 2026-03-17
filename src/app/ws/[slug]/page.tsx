import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import type { PresenceEventWithMatch } from '@/lib/signals'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { getPlanLimits } from '@/lib/plans'
import TodayClient from './TodayClient'

interface Props {
  params: Promise<{ slug: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        minWidth: '100px',
      }}
    >
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '26px',
          fontWeight: 700,
          color: accent ? 'var(--teal)' : 'var(--navy)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginTop: '3px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WsTodayPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const tz = workspace.display_timezone

  // Today's UTC bounds in workspace timezone
  const todayStr = todayInTz(tz)
  const startUtc = localMidnightToUtc(todayStr, tz)
  const endUtc = localMidnightToUtc(nextDayStr(todayStr), tz)

  // Parallel fetch
  const [events, members] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, {
      startDate: startUtc,
      endDate: endUtc,
    }),
    getActiveMembersWithDetails(workspace.id),
  ])

  // Group events by user_id
  const eventsByUser = new Map<string, PresenceEventWithMatch[]>()
  for (const event of events) {
    const arr = eventsByUser.get(event.user_id) ?? []
    arr.push(event)
    eventsByUser.set(event.user_id, arr)
  }

  // Categorise members
  const present: { member: MemberWithUser; latest: PresenceEventWithMatch; all: PresenceEventWithMatch[] }[] = []
  const visited: { member: MemberWithUser; latest: PresenceEventWithMatch; all: PresenceEventWithMatch[] }[] = []
  const notIn: MemberWithUser[] = []

  for (const member of members) {
    const userEvents = eventsByUser.get(member.user_id) ?? []
    if (userEvents.length === 0) {
      notIn.push(member)
    } else {
      const openEvent = userEvents.find((e) => !e.checkout_at)
      const latest = openEvent ?? userEvents[0]
      if (openEvent) {
        present.push({ member, latest, all: userEvents })
      } else {
        visited.push({ member, latest, all: userEvents })
      }
    }
  }

  // Format today's date for display
  const todayDisplay = new Date(startUtc).toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Plan limit banner
  const planLimits = getPlanLimits(workspace.plan)
  const memberCount = members.length
  const atLimit = planLimits.maxUsers !== null && memberCount >= planLimits.maxUsers
  const nearLimit = planLimits.maxUsers !== null && !atLimit && memberCount >= planLimits.maxUsers - 2

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px 20px',
      }}
    >
      {/* Plan limit banner */}
      {(atLimit || nearLimit) && (
        <div
          style={{
            background: atLimit
              ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
              : 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: `1px solid ${atLimit ? 'var(--danger)' : 'var(--amber)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
            color: atLimit ? 'var(--danger)' : 'var(--text-secondary)',
          }}
        >
          {atLimit
            ? `Member limit reached — ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan. Upgrade to add more members.`
            : `Approaching member limit — ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan.`}
        </div>
      )}

      {/* Date + meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--navy)',
            margin: 0,
          }}
        >
          Today
        </h1>
        <span
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            color: 'var(--text-secondary)',
          }}
        >
          {todayDisplay}
        </span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '2px 6px',
          }}
        >
          {tz}
        </span>
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatChip value={present.length} label="in office" accent={present.length > 0} />
        <StatChip value={visited.length} label="visited" />
        <StatChip value={notIn.length} label="not in" />
        <StatChip value={memberCount} label="total members" />
      </div>

      {/* Filter bar + member lists — client component */}
      <TodayClient
        present={present}
        visited={visited}
        notIn={notIn}
        tz={tz}
        totalMembers={memberCount}
      />
    </div>
  )
}
