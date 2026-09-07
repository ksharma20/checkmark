import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import LeavesClient from './LeavesClient'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Leave administration - requests, applied history and maternity cases.
 *
 * The layout beside this file already sends workspaces with `leaves_enabled`
 * off back to the workspace root; this page adds the permission half. Maternity
 * is filed under `leaves` server-side too, so one gate covers all three tabs.
 */
export default async function LeavesPage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Leaves, Action.Read)) {
    redirect('/me')
  }

  return (
    <LeavesClient
      slug={slug}
      canWrite={can(role.permissions, Resource.Leaves, Action.Write)}
      canReadEmployees={can(role.permissions, Resource.Employees, Action.Read)}
    />
  )
}
