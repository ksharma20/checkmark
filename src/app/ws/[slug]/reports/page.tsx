import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getPlanLimits } from '@/lib/plans'
import ReportsClient from './ReportsClient'

interface Props { params: Promise<{ slug: string }> }

/**
 * The Reports screen: one page of downloadable HR reports plus a WFO trend.
 * The monthly activity grid is not here - it has its own screen at /monthly.
 *
 * Gated exactly as the screen registry says (src/lib/permissions/screens.ts):
 * `export:read`. The sidebar hides the tab too, but that is only a courtesy -
 * someone typing the URL must land somewhere sensible.
 *
 * The individual report cards need permissions of their own (leave, members,
 * analytics), resolved here rather than in the client so the buttons that would
 * 403 are never offered in the first place. Every route re-checks anyway.
 */
export default async function ReportsPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Export, Action.Read)) redirect('/me')

  const planLimits = getPlanLimits(workspace.plan)

  return (
    <ReportsClient
      slug={slug}
      timezone={workspace.display_timezone}
      canExport={planLimits.csvExport}
      canReadLeaves={can(role.permissions, Resource.Leaves, Action.Read)}
      canReadMembers={can(role.permissions, Resource.Members, Action.Read)}
      canReadAnalytics={can(role.permissions, Resource.Analytics, Action.Read)}
    />
  )
}
