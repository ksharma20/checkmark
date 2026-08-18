import { notFound } from 'next/navigation'
import { getWorkspaceBySlug, getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { getServerUser } from '@/lib/auth'
import { getUserById } from '@/lib/db/queries/users'
import { getPlanLimits } from '@/lib/plans'
import TodayClient from './TodayClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WsDashboardPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const [members, sessionUser] = await Promise.all([
    getActiveMembersWithDetails(workspace.id),
    getServerUser(),
  ])
  const dbUser = sessionUser ? await getUserById(sessionUser.userId) : null
  const adminFirstName = (dbUser?.full_name?.trim().split(' ')[0]) || 'there'

  // Plan limit banner
  const planLimits = getPlanLimits(workspace.plan)
  const memberCount = members.length
  const atLimit = planLimits.maxUsers !== null && memberCount >= planLimits.maxUsers
  const nearLimit = planLimits.maxUsers !== null && !atLimit && memberCount >= planLimits.maxUsers - 2

  const planLimitBanner = (atLimit || nearLimit) ? (
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
        ? `Member limit reached - ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan. Upgrade to add more members.`
        : `Approaching member limit - ${memberCount}/${planLimits.maxUsers} on the ${workspace.plan} plan.`}
    </div>
  ) : null

  return (
    <TodayClient
      slug={slug}
      planLimitBanner={planLimitBanner}
      adminFirstName={adminFirstName}
    />
  )
}
