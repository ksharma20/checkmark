import Link from 'next/link'
import { getServerUser } from '@/lib/auth'
import { getOpenEventToday, getUserEvents } from '@/lib/db/queries/events'
import { getUserWorkspaces, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import { getUserById } from '@/lib/db/queries/users'
import CheckinButtons from '@/components/user/CheckinButtons'
import EventCard from '@/components/user/EventCard'
import TimezoneReporter from '@/components/user/TimezoneReporter'

export default async function MePage() {
  const user = await getServerUser()
  if (!user) return null

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const monthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const [activeEvent, todayResult, monthResult, memberships, profile] = await Promise.all([
    getOpenEventToday(user.userId),
    getUserEvents({ userId: user.userId, start: `${todayStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }),
    getUserEvents({ userId: user.userId, start: `${monthStr}T00:00:00.000Z`, end: nextMonthDate.toISOString(), limit: 500 }),
    getUserWorkspaces(user.userId),
    getUserById(user.userId),
  ])

  const todayEvents = todayResult.events
  const monthEvents = monthResult.events

  // Effective start: later of month start or user's account creation date
  const monthStartDate = new Date(monthStr + 'T00:00:00.000Z')
  const rawJoin = profile?.created_at
  const joinDate = rawJoin
    ? new Date(rawJoin.includes('T') ? rawJoin : rawJoin.replace(' ', 'T') + 'Z')
    : null
  const effectiveStart = joinDate && joinDate > monthStartDate ? joinDate : monthStartDate

  function isWorkday(d: Date): boolean {
    const dow = d.getUTCDay()
    return dow >= 1 && dow <= 5
  }

  function countWorkdays(start: Date, end: Date): number {
    let count = 0
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
    while (d <= endDay) {
      if (isWorkday(d)) count++
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return count
  }

  // Group month events by day
  const eventsByDay = new Map<string, string[]>()
  for (const e of monthEvents) {
    const day = e.checkin_at.slice(0, 10)
    if (!eventsByDay.has(day)) eventsByDay.set(day, [])
    eventsByDay.get(day)!.push(e.event_type)
  }

  // Count WFO / WFH days (workdays only, from effective start)
  const wfoDaySet = new Set<string>()
  const wfhDaySet = new Set<string>()
  for (const [day, types] of eventsByDay) {
    const dayDate = new Date(day + 'T00:00:00.000Z')
    if (dayDate < effectiveStart) continue
    if (!isWorkday(dayDate)) continue
    if (types.includes('office_checkin')) {
      wfoDaySet.add(day)
    } else {
      wfhDaySet.add(day)
    }
  }

  const wfoDays = wfoDaySet.size
  const wfhDays = wfhDaySet.size
  const todayDate = new Date(todayStr + 'T00:00:00.000Z')
  const workdaysTotal = countWorkdays(effectiveStart, todayDate)
  const leaveDays = Math.max(0, workdaysTotal - wfoDays - wfhDays)

  // Workspace names for the orgs strip
  const workspaceIds = memberships.map((m) => m.workspace_id)
  const workspaces = await getWorkspacesByIds(workspaceIds)
  const wsMap = new Map(workspaces.map((w) => [w.id, w]))

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '20px 16px',
      }}
    >
      {/* Silent timezone reporter — keeps DB in sync with browser timezone */}
      <TimezoneReporter />

      {/* Check-in / checkout buttons (includes status line + active indicator) */}
      <CheckinButtons activeEvent={activeEvent} name={profile?.full_name ?? user.email.split('@')[0]} />

      {/* This month attendance summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          margin: '20px 0',
        }}
      >
        {([
          { value: wfoDays, label: 'WFO', sub: 'this month', color: 'var(--teal)' },
          { value: wfhDays, label: 'WFH', sub: 'this month', color: 'var(--brand)' },
          { value: leaveDays, label: 'On Leave', sub: 'this month', color: 'var(--amber)' },
        ] as const).map((card) => (
          <div
            key={card.label}
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 8px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: card.color,
                lineHeight: 1,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: '4px',
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '10px',
                color: 'var(--text-muted)',
                marginTop: '1px',
              }}
            >
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Today's events */}
      {todayEvents.length > 0 && (
        <section style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            Today
          </h2>
          {todayEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}

      {/* Orgs strip */}
      {memberships.length > 0 && (
        <section>
          <h2
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            In workspaces
          </h2>
          {memberships.map((m) => {
            const ws = wsMap.get(m.workspace_id)
            if (!ws) return null
            return (
              <Link
                key={m.id}
                href={`/me/ws/${ws.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: '8px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
                className="ws-card-link"
              >
                <div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {ws.name}
                  </div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {m.role}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--navy)' }}>
                      {wfoDays + wfhDays}
                    </div>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>
                      days this month
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </section>
      )}

      {/* Empty state — no activity yet */}
      {todayEvents.length === 0 && memberships.length === 0 && (
        <div
          style={{
            marginTop: '32px',
            padding: '32px 20px',
            textAlign: 'center',
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Tap &ldquo;I&apos;m here&rdquo; when you arrive somewhere.
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>
            Your check-in history will build up here over time.
          </p>
        </div>
      )}
    </div>
  )
}
