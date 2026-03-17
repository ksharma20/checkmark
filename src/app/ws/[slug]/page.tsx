import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { getPlanLimits } from '@/lib/plans'
import TodayClient from './TodayClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WsTodayPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const tz = workspace.display_timezone
  const todayStr = todayInTz(tz)

  function nextDayStr(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  }

  // Today's display date (server-computed in workspace tz)
  const startUtc = localMidnightToUtc(todayStr, tz)
  const todayDisplay = new Date(startUtc).toLocaleDateString('en-US', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
  })

  // Plan limit banner (needs member count)
  const [members] = await Promise.all([getActiveMembersWithDetails(workspace.id)])
  const planLimits = getPlanLimits(workspace.plan)
  const memberCount = members.length
  const atLimit = planLimits.maxUsers !== null && memberCount >= planLimits.maxUsers
  const nearLimit = planLimits.maxUsers !== null && !atLimit && memberCount >= planLimits.maxUsers - 2

  // suppress unused warning
  void nextDayStr

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Plan limit banner */}
      {(atLimit || nearLimit) && (
        <div style={{
          background: atLimit
            ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
            : 'color-mix(in srgb, var(--amber) 10%, transparent)',
          border: `1px solid ${atLimit ? 'var(--danger)' : 'var(--amber)'}`,
          borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '16px',
          fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
          color: atLimit ? 'var(--danger)' : 'var(--text-secondary)',
        }}>
          {atLimit
            ? `Member limit reached — ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan. Upgrade to add more members.`
            : `Approaching member limit — ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan.`}
        </div>
      )}

      {/* Date + meta row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
          Today
        </h1>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {todayDisplay}
        </span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)',
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px',
        }}>
          {tz}
        </span>
      </div>

      {/* Stat chips + filter bar + member list — all client-side with API pagination */}
      <TodayClient slug={slug} tz={tz} />
    </div>
  )
}
