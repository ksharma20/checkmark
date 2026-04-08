import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { todayInTz, localMidnightToUtc } from '@/lib/timezone'
import { getPlanLimits } from '@/lib/plans'
import TodayClient from './TodayClient'
import AnalyticsClient from './AnalyticsClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WsDashboardPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const tz = workspace.display_timezone
  const todayStr = todayInTz(tz)

  // Today's display date (server-computed in workspace tz)
  const startUtc = localMidnightToUtc(todayStr, tz)
  const todayDisplay = new Date(startUtc).toLocaleDateString('en-US', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
  })

  // Plan limit banner
  const members = await getActiveMembersWithDetails(workspace.id)
  const planLimits = getPlanLimits(workspace.plan)
  const memberCount = members.length
  const atLimit = planLimits.maxUsers !== null && memberCount >= planLimits.maxUsers
  const nearLimit = planLimits.maxUsers !== null && !atLimit && memberCount >= planLimits.maxUsers - 2

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
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

      {/* ── Today section header ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ width: '3px', height: '22px', borderRadius: '2px', background: 'var(--brand)', flexShrink: 0 }} />
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Today
          </h1>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {todayDisplay}
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)',
            background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px',
          }}>
            {tz}
          </span>
        </div>
      </div>

      <TodayClient slug={slug} tz={tz} />

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '36px 0 0' }} />

      {/* ── Analytics section ── */}
      <AnalyticsClient slug={slug} />
    </div>
  )
}
