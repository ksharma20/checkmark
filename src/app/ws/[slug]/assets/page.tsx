import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import AssetsClient from './AssetsClient'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * The equipment register.
 *
 * Gated on `assets:read`; write actions (add, assign, return, repair, retire)
 * additionally need `assets:write`, and the assign modal needs `employees:read`
 * because it lists people. All three are resolved here and passed down, so the
 * client never reasons about permissions itself. The routes re-check.
 */
export default async function AssetsPage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Assets, Action.Read)) {
    redirect('/me')
  }

  return (
    <AssetsClient
      slug={slug}
      canWrite={can(role.permissions, Resource.Assets, Action.Write)}
      canReadEmployees={can(role.permissions, Resource.Employees, Action.Read)}
    />
  )
}
