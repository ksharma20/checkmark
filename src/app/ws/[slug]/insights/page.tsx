import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import InsightsClient from '../InsightsClient'
import AnalyticsClient from '../AnalyticsClient'

interface Props { params: Promise<{ slug: string }> }

/**
 * Analytics & insights.
 *
 * Two halves of one question, both gated on `analytics:read` (the resource the
 * screen registry names for Screen.Analytics):
 *
 *   InsightsClient  - time buckets. When is the office busy?
 *   AnalyticsClient - per member over a date range. Who was actually here?
 *
 * They read different endpoints (/insights and /analytics) and neither
 * subsumes the other, so both render here rather than one being dropped.
 */
export default async function InsightsPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Analytics, Action.Read)) redirect('/me')

  return (
    <>
      <InsightsClient slug={slug} workspaceCreatedAt={workspace.created_at.slice(0, 10)} />
      <AnalyticsClient slug={slug} />
    </>
  )
}
