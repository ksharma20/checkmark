import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { queryWorkspaceEvents } from '@/lib/signals'
import type { PresenceEventWithMatch, MatchedBy } from '@/lib/signals'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc, formatInTz, durationHours } from '@/lib/timezone'
import { getPlanLimits } from '@/lib/plans'

interface Props {
  params: Promise<{ slug: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextDayStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function fmtDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const SIGNAL_BADGE: Record<MatchedBy, { label: string; color: string; bg: string }> = {
  wifi:     { label: 'WiFi',     color: 'var(--teal)',    bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' },
  gps:      { label: 'GPS',      color: 'var(--brand)',   bg: 'color-mix(in srgb, var(--brand) 12%, transparent)' },
  ip:       { label: 'IP',       color: 'var(--amber)',   bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  override: { label: 'Override', color: '#8B5CF6',        bg: 'color-mix(in srgb, #8B5CF6 12%, transparent)' },
  none:     { label: '—',        color: 'var(--text-muted)', bg: 'transparent' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalBadge({ matchedBy }: { matchedBy: MatchedBy }) {
  const badge = SIGNAL_BADGE[matchedBy]
  if (matchedBy === 'none') return <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>—</span>
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '20px',
        padding: '0 7px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        color: badge.color,
        background: badge.bg,
        border: `1px solid ${badge.color}`,
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </span>
  )
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'Syne, sans-serif',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '8px',
        marginTop: '24px',
      }}
    >
      {children}
    </p>
  )
}

interface PersonRow {
  member: MemberWithUser
  latestEvent: PresenceEventWithMatch
  allEvents: PresenceEventWithMatch[]
  isActive: boolean
  tz: string
}

function PersonRow({ member, latestEvent, allEvents, isActive, tz }: PersonRow) {
  const duration = durationHours(latestEvent.checkin_at, latestEvent.checkout_at)
  const name = member.full_name || member.email
  const checkinTime = formatInTz(latestEvent.checkin_at, tz, 'time')
  const checkoutTime = latestEvent.checkout_at ? formatInTz(latestEvent.checkout_at, tz, 'time') : null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '6px',
      }}
    >
      {/* Name + email */}
      <div>
        <p
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        >
          {name}
          {allEvents.length > 1 && (
            <span
              style={{
                marginLeft: '6px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
            >
              ×{allEvents.length}
            </span>
          )}
        </p>
        {member.full_name && (
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            {member.email}
          </p>
        )}
      </div>

      {/* Time range */}
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        {checkinTime}
        {checkoutTime ? ` → ${checkoutTime}` : isActive ? ' →' : ''}
      </span>

      {/* Signal badge */}
      <SignalBadge matchedBy={latestEvent.matched_by} />

      {/* Duration */}
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '12px',
          color: duration !== null ? 'var(--text-secondary)' : 'var(--text-muted)',
          width: '52px',
          textAlign: 'right',
        }}
      >
        {duration !== null ? fmtDuration(duration) : isActive ? '…' : '—'}
      </span>
    </div>
  )
}

function NotInRow({ member }: { member: MemberWithUser }) {
  const name = member.full_name || member.email
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '6px',
        opacity: 0.7,
      }}
    >
      <span
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          flex: 1,
        }}
      >
        {name}
      </span>
      {member.full_name && (
        <span
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          {member.email}
        </span>
      )}
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

  // Build user_id → member map
  const memberMap = new Map(members.map((m) => [m.user_id, m]))

  // Group events by user_id (newest first from query)
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
      // "present" = has at least one open event (no checkout)
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
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <StatChip value={present.length} label="in office" accent={present.length > 0} />
        <StatChip value={visited.length} label="visited" />
        <StatChip value={notIn.length} label="not in" />
        <StatChip value={members.length} label="total members" />
      </div>

      {/* Present section */}
      {present.length > 0 && (
        <>
          <SectionLabel>In office now ({present.length})</SectionLabel>
          {present.map(({ member, latest, all }) => (
            <PersonRow
              key={member.member_id}
              member={member}
              latestEvent={latest}
              allEvents={all}
              isActive={true}
              tz={tz}
            />
          ))}
        </>
      )}

      {/* Visited section */}
      {visited.length > 0 && (
        <>
          <SectionLabel>Visited today ({visited.length})</SectionLabel>
          {visited.map(({ member, latest, all }) => (
            <PersonRow
              key={member.member_id}
              member={member}
              latestEvent={latest}
              allEvents={all}
              isActive={false}
              tz={tz}
            />
          ))}
        </>
      )}

      {/* Not in section */}
      {notIn.length > 0 && (
        <>
          <SectionLabel>Not in today ({notIn.length})</SectionLabel>
          {notIn.map((member) => (
            <NotInRow key={member.member_id} member={member} />
          ))}
        </>
      )}

      {/* Empty state */}
      {members.length === 0 && (
        <div
          style={{
            marginTop: '48px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
          }}
        >
          <p>No members yet.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Invite your team from the People tab.
          </p>
        </div>
      )}
    </div>
  )
}
