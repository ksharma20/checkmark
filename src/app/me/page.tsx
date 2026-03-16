import { getServerUser } from '@/lib/auth'
import { getOpenEventToday, getUserEvents } from '@/lib/db/queries/events'
import { getUserStats } from '@/lib/db/queries/stats'
import { getUserWorkspaces, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import CheckinButtons from '@/components/user/CheckinButtons'
import EventCard from '@/components/user/EventCard'

export default async function MePage() {
  const user = await getServerUser()
  if (!user) return null

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const monthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const [activeEvent, todayResult, monthResult, stats, memberships] = await Promise.all([
    getOpenEventToday(user.userId),
    getUserEvents({ userId: user.userId, start: `${todayStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` }),
    getUserEvents({ userId: user.userId, start: `${monthStr}T00:00:00.000Z`, end: nextMonthDate.toISOString(), limit: 500 }),
    getUserStats(user.userId),
    getUserWorkspaces(user.userId),
  ])

  const todayEvents = todayResult.events
  const monthEvents = monthResult.events

  // Compute from this month's events
  const distinctDaysThisMonth = new Set(monthEvents.map((e) => e.checkin_at.split('T')[0])).size
  const hoursThisMonth = monthEvents.reduce((sum, e) => {
    if (e.checkout_at) {
      return sum + (new Date(e.checkout_at).getTime() - new Date(e.checkin_at).getTime()) / 3_600_000
    }
    return sum
  }, 0)
  const locationsThisMonth = stats?.distinct_locations_this_month ?? 0

  // Workspace names for the orgs strip
  const workspaceIds = memberships.map((m) => m.workspace_id)
  const workspaces = await getWorkspacesByIds(workspaceIds)
  const wsMap = new Map(workspaces.map((w) => [w.id, w]))

  const todayDisplay = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '20px 16px',
      }}
    >
      {/* Date */}
      <p
        style={{
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontFamily: 'DM Sans, sans-serif',
          marginBottom: '4px',
        }}
      >
        {todayDisplay}
      </p>

      {/* Status line */}
      <p
        style={{
          fontSize: '15px',
          fontFamily: 'DM Sans, sans-serif',
          color: activeEvent ? 'var(--teal)' : 'var(--text-secondary)',
          marginBottom: '16px',
        }}
      >
        {activeEvent
          ? `Checked in at ${new Date(activeEvent.checkin_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : todayEvents.length > 0
          ? `Last checked out at ${new Date(todayEvents[0].checkout_at ?? todayEvents[0].checkin_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Not checked in yet'}
      </p>

      {/* Check-in / checkout buttons */}
      <CheckinButtons activeEvent={activeEvent} />

      {/* This month stat chips */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          margin: '20px 0',
        }}
      >
        {[
          { value: distinctDaysThisMonth, label: 'days' },
          { value: `${hoursThisMonth.toFixed(1)}`, label: 'hrs' },
          { value: locationsThisMonth, label: 'places' },
        ].map((chip) => (
          <div
            key={chip.label}
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
                color: 'var(--navy)',
                lineHeight: 1,
              }}
            >
              {chip.value}
            </div>
            <div
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              {chip.label}
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
              <div
                key={m.id}
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ws.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {m.role}
                  </div>
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    textAlign: 'right',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: '18px',
                      color: 'var(--navy)',
                    }}
                  >
                    {distinctDaysThisMonth}
                  </div>
                  <div
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    days this month
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Empty state */}
      {todayEvents.length === 0 && memberships.length === 0 && (
        <div
          style={{
            marginTop: '32px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
          }}
        >
          <p>Your first check-in is waiting.</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Tap &ldquo;I&apos;m here&rdquo; whenever you arrive at work.
          </p>
        </div>
      )}
    </div>
  )
}
