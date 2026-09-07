import { Suspense } from 'react'
import RosterScreen from './RosterScreen'
import { ScopeSkeleton } from '../workspace-scope'

/**
 * `/me/workspace` - the "who's in right now" roster.
 *
 * A server shell around a client screen: the roster is live data behind a
 * workspace picker, so the rendering is interactive, but the page itself stays
 * a Server Component so it can own metadata. The Suspense boundary is required
 * because `useWorkspaceScope` reads `useSearchParams`.
 */

export const metadata = {
  title: 'Workspace',
  robots: { index: false, follow: false },
}

export default function MeWorkspacePage() {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <RosterScreen />
    </Suspense>
  )
}
