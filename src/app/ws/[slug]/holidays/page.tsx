import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import HolidaysClient from './HolidaysClient'

interface Props { params: Promise<{ slug: string }> }

/**
 * The holiday calendar.
 *
 * Server-gated on `holidays:read`, with write and delete resolved here so the
 * client never renders an Add or Delete control the API would refuse. The
 * layout has already redirected when the workspace has leave switched off.
 */
export default async function HolidaysPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Holidays, Action.Read)) redirect('/me')

  return (
    <HolidaysClient
      slug={slug}
      canWrite={can(role.permissions, Resource.Holidays, Action.Write)}
      canDelete={can(role.permissions, Resource.Holidays, Action.Delete)}
    />
  )
}
