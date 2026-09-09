import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getUserWorkspaces, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import AnnouncementsScreen from './AnnouncementsScreen'
import { ScopeSkeleton } from '../workspace-scope'

/**
 * `/me/announcements` - the member's archive of workspace notices.
 *
 * Every announcement notification deep-links here as
 * `/me/announcements?ws=<slug>`, because a notification row carries the body
 * and has nowhere to put a file. That query param is resolved HERE, on the
 * server, against the caller's own active memberships: a hand-typed
 * `?ws=someone-elses-company` falls back to the active workspace rather than
 * naming a workspace this person is not in. The client never reads `?ws=`.
 *
 * There is no workspace picker on this screen and there must never be one -
 * the top-bar pill is the only selector on `/me`, and the screen reads it
 * through `useWorkspaceScope()`.
 */

export const metadata = {
  title: 'Announcements',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ ws?: string }>
}

export default async function MeAnnouncementsPage({ searchParams }: Props) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { ws } = await searchParams

  let scopedSlug: string | null = null
  if (ws) {
    const memberships = await getUserWorkspaces(user.userId)
    const workspaces = await getWorkspacesByIds(memberships.map((m) => m.workspace_id))
    scopedSlug = workspaces.find((w) => w.slug === ws && !w.archived_at)?.slug ?? null
  }

  // Keyed on the resolved slug so arriving from a notification for a different
  // workspace remounts, rather than re-rendering with the previous workspace's
  // notices still on screen while the new fetch is in flight.
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <AnnouncementsScreen key={scopedSlug ?? 'active'} scopedSlug={scopedSlug} />
    </Suspense>
  )
}
