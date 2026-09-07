import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getPlanLimits } from '@/lib/plans'
import { Card, Chip } from '@/components/ui'
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
        <Chip tone="verified" style={{ textTransform: 'capitalize' }}>{workspace.plan}</Chip>
      </div>

      <MonthlyClient
        slug={slug}
        tz={workspace.display_timezone}
        canExport={planLimits.csvExport}
        historyMonths={planLimits.historyMonths}
      />

      {!planLimits.csvExport && (
        <Card style={{ marginTop: '16px' }}>
          <div className="row-between" style={{ flexWrap: 'wrap' }}>
            <p className="t-secondary">{wsAdmin.monthly.csvGateNote}</p>
            <Link href="/pricing" style={{ color: 'var(--brand)', fontWeight: 600, fontSize: '13.5px' }}>
              {wsAdmin.reports.viewPricing}
            </Link>
          </div>
        </Card>
      )}
    </>
  )
}
