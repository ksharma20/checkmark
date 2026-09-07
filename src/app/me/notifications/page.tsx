import { getServerUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getUserWorkspaces, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import NotificationsClient from './NotificationsClient'

export const metadata = { title: 'Notifications' }

interface Props {
  searchParams: Promise<{ ws?: string }>
}

/**
 * One page, two modes.
 *
 *   `?ws=<slug>` present and valid → that workspace only, no badges (the bell)
 *   absent or bogus              → every workspace, each row badged (the avatar
 *                                  menu's unified view)
 *
 * The slug is resolved here, on the server, against the caller's own active
 * memberships. A hand-typed `?ws=other-company` falls back to the unified view
 * rather than erroring - and even if it did not, `/api/me/ws/[slug]/*` re-checks
 * membership on every request, so nothing leaks either way.
 */
export default async function NotificationsPage({ searchParams }: Props) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { ws } = await searchParams

  let scopedSlug: string | null = null
  let scopedName: string | null = null
  if (ws) {
    const memberships = await getUserWorkspaces(user.userId)
    const workspaces = await getWorkspacesByIds(memberships.map((m) => m.workspace_id))
    const match = workspaces.find((w) => w.slug === ws && !w.archived_at)
    if (match) {
      scopedSlug = match.slug
      scopedName = match.name
    }
  }

  // Keyed on the mode so switching between the bell's `?ws=` view and the
  // unified one remounts rather than re-rendering with one workspace's rows
  // still on screen under the other one's heading.
  return (
    <NotificationsClient
      key={scopedSlug ?? 'all'}
      scopedSlug={scopedSlug}
      scopedName={scopedName}
    />
  )
}
