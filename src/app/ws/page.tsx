import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getAdminWorkspacesForUser, getArchivedAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import WsClient from './WsClient'

export default async function WsIndexPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const [active, archived] = await Promise.all([
    getAdminWorkspacesForUser(user.userId),
    getArchivedAdminWorkspacesForUser(user.userId),
  ])

  return <WsClient workspaces={active} archivedWorkspaces={archived} />
}
