import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import WsClient from '../WsClient'

/**
 * /ws/new — always shows the workspace creation form, bypassing the single-workspace auto-redirect.
 * Linked from /me/settings "Organisation features" section.
 */
export default async function WsNewPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  // Pass empty workspaces so WsClient jumps straight to the creation form
  return <WsClient workspaces={[]} forceCreate />
}
