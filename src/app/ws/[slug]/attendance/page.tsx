import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import AttendanceClient from './AttendanceClient'

interface Props { params: Promise<{ slug: string }> }

/**
 * Today's roster for the whole workspace.
 *
 * Gated on `dashboard:read`, the same resource the /dashboard endpoint this
 * screen reads is gated on - the server check here and the one inside
 * requireWsAccess() can therefore never disagree. Write actions (approving a
 * regularization, which is how an admin override gets recorded) are gated
 * separately on `approvals:write` by their own route.
 */
export default async function AttendancePage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Dashboard, Action.Read)) redirect('/me')

  const canAction = can(role.permissions, Resource.Approvals, Action.Write)

  return <AttendanceClient slug={slug} canAction={canAction} />
}
