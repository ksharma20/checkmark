import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import WsClient from '../WsClient'

/**
 * /ws/new - always opens the workspace creation form.
 * Linked from /me/settings "Organisation features".
 */
export default async function WsNewPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  return <WsClient workspaces={[]} archivedWorkspaces={[]} startCreating />
}
