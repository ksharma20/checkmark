import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug, getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { getUserById } from '@/lib/db/queries/users'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getPlanLimits } from '@/lib/plans'
import { wsAdmin } from '@/locales/en/ws-overview'
import TodayClient from './TodayClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WsDashboardPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Server-side gate mirroring requireWsAccess(). The sidebar also hides the
  // tab, but that is a courtesy only - someone typing the URL must land
  // somewhere sensible rather than on an empty shell.
  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Dashboard, Action.Read)) redirect('/me')

  const canAction = can(role.permissions, Resource.Approvals, Action.Write)

  const [memberIds, dbUser] = await Promise.all([
    getActiveMemberIds(workspace.id),
    getUserById(user.userId),
  ])
  const adminFirstName = dbUser?.full_name?.trim().split(' ')[0] || user.email

  // Plan gate. Rendered on the server because the limit is a property of the
  // workspace row, not something the browser should be trusted to compute.
  const planLimits = getPlanLimits(workspace.plan)
  const memberCount = memberIds.length
  const atLimit = planLimits.maxUsers !== null && memberCount >= planLimits.maxUsers
  const nearLimit = planLimits.maxUsers !== null && !atLimit && memberCount >= planLimits.maxUsers - 2

  const planLimitBanner = (atLimit || nearLimit) ? (
    <div
      className="card"
      role="status"
      style={{
        marginTop: '16px',
        padding: '12px 16px',
        borderColor: atLimit ? 'var(--danger)' : 'var(--amber)',
        background: `color-mix(in srgb, ${atLimit ? 'var(--danger)' : 'var(--amber)'} 8%, var(--surface-0))`,
        color: atLimit ? 'var(--danger)' : 'var(--text-secondary)',
        fontSize: '13px',
      }}
    >
      {atLimit
        ? wsAdmin.overview.planLimitReached(memberCount, planLimits.maxUsers!, workspace.plan)
        : wsAdmin.overview.planLimitNear(memberCount, planLimits.maxUsers!, workspace.plan)}
    </div>
  ) : null

  return (
    <TodayClient
      slug={slug}
      planLimitBanner={planLimitBanner}
      adminFirstName={adminFirstName}
      canAction={canAction}
    />
  )
}
