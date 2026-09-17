import { Suspense } from 'react'
import { getServerUser } from '@/lib/auth'
import SpaceScreen from './SpaceScreen'
import InsightsPanel from './InsightsPanel'
import InsightsSkeleton from './InsightsSkeleton'

/**
 * `/me/space` - the member's personal space: notes, to-dos, focus, insights.
 *
 * THE ONE `/me` SCREEN THAT IS NOT WORKSPACE-SCOPED. Three of its four tabs read
 * tables that carry no `workspace_id` at all, so there is nothing for the top-bar
 * pill to scope them to - and, following the rule that governs every screen
 * under that pill, this one adds no picker of its own. The fourth tab, Insights,
 * does use the active workspace for its office/remote split only, and resolves
 * it the same way the layout does rather than asking again.
 *
 * A Server Component shell around a client screen, which is the `/me/documents`
 * shape: the tabs, the editors and the timer are browser work, but the page
 * stays a Server Component so it owns its metadata - and so the Insights panel
 * can be rendered on the server and handed down as a slot. That slot is why
 * there is no `/api/me/insights`: the numbers are computed once, during the
 * render that is already happening, instead of behind a round trip with its own
 * loading state.
 *
 * The Suspense boundary streams the panel: the presence-event read behind it is
 * the slowest thing on the page, and the other three tabs must not wait for a
 * tab the member may never open.
 */

export const metadata = {
  title: 'My space',
  robots: { index: false, follow: false },
}

export default async function MeSpacePage() {
  // The layout renders for signed-out visitors too (middleware handles the
  // redirect), so this has to tolerate no session rather than assume one.
  const user = await getServerUser()

  return (
    <SpaceScreen
      insights={
        user ? (
          <Suspense fallback={<InsightsSkeleton />}>
            <InsightsPanel userId={user.userId} />
          </Suspense>
        ) : (
          <InsightsSkeleton />
        )
      }
    />
  )
}
