import { Suspense } from 'react'
import ProfileScreen from './ProfileScreen'
import { ScopeSkeleton } from '../workspace-scope'

/**
 * `/me/profile` - the self-service employee profile.
 *
 * Server shell around a client form, for the same reasons as the other three
 * `/me` screens: the page owns metadata, the screen owns interactivity, and the
 * Suspense boundary is what `useSearchParams` inside `useWorkspaceScope` needs.
 */

export const metadata = {
  title: 'My profile',
  robots: { index: false, follow: false },
}

export default function MeProfilePage() {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <ProfileScreen />
    </Suspense>
  )
}
