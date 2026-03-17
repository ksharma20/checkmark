import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import WsClient from './WsClient'

export default async function WsIndexPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspaces = await getAdminWorkspacesForUser(user.userId)

  // Single workspace → go straight there
  if (workspaces.length === 1) redirect(`/ws/${workspaces[0].slug}`)

  return <WsClient workspaces={workspaces} />
}
