import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { getPlanLimits } from '@/lib/plans'
import SettingsClient from './SettingsClient'

interface Props { params: Promise<{ slug: string }> }

/**
 * Settings, as its tabs.
 *
 * A server component so the plan and the caller's permissions are known on
 * first paint: the Billing tab needs `workspace.plan`, which GET /api/ws/[slug]
 * deliberately does not return, and every tab is gated on its OWN resource
 * rather than on "is this an admin". Each route re-checks - these flags only
 * stop us rendering a control that would immediately 403.
 */
export default async function SettingsPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Settings, Action.Read)) redirect('/me')

  return (
    <SettingsClient
      slug={slug}
      plan={workspace.plan}
      planLimits={getPlanLimits(workspace.plan)}
      leavesEnabled={!!workspace.leaves_enabled}
      canWriteSettings={can(role.permissions, Resource.Settings, Action.Write)}
      canReadLeaves={can(role.permissions, Resource.Leaves, Action.Read)}
      canWriteLeaves={can(role.permissions, Resource.Leaves, Action.Write)}
      canReadSignals={can(role.permissions, Resource.Signals, Action.Read)}
      canWriteSignals={can(role.permissions, Resource.Signals, Action.Write)}
      canDeleteSignals={can(role.permissions, Resource.Signals, Action.Delete)}
      canReadDomains={can(role.permissions, Resource.Domains, Action.Read)}
      canWriteDomains={can(role.permissions, Resource.Domains, Action.Write)}
      canDeleteDomains={can(role.permissions, Resource.Domains, Action.Delete)}
      canManageOwnership={can(role.permissions, Resource.Ownership, Action.Write)}
      canReadAnnouncements={can(role.permissions, Resource.Announcements, Action.Read)}
      canWriteAnnouncements={can(role.permissions, Resource.Announcements, Action.Write)}
      canDeleteAnnouncements={can(role.permissions, Resource.Announcements, Action.Delete)}
    />
  )
}
