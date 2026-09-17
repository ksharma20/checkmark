import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getPlanLimits } from '@/lib/plans'
import { wsAdmin } from '@/locales/en/ws-settings'
import MonthlyClient from './MonthlyClient'

interface Props { params: Promise<{ slug: string }> }

export default async function MonthlyPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Activity, Action.Read)) redirect('/me')

  const planLimits = getPlanLimits(workspace.plan)

  return (
    <>
      <div className="fx-snap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <h1 className="t-h1">{wsAdmin.monthly.pageTitle}</h1>
      </div>

      <MonthlyClient
        slug={slug}
        tz={workspace.display_timezone}
        canExport={planLimits.csvExport}
        historyMonths={planLimits.historyMonths}
      />
    </>
  )
}
