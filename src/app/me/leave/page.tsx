import { Suspense } from 'react'
import LeaveScreen from './LeaveScreen'
import { ScopeSkeleton } from '../workspace-scope'

/**
 * `/me/leave` - balance, application, history and the holiday calendar.
 *
 * Server shell around a client screen: everything below the title is tabbed,
 * form-driven and workspace-scoped, so it has to run in the browser, but the
 * page stays a Server Component to own its metadata. The Suspense boundary is
 * required because `useWorkspaceScope` reads `useSearchParams`.
 */

export const metadata = {
  title: 'Leave',
  robots: { index: false, follow: false },
}

export default function MeLeavePage() {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <LeaveScreen />
    </Suspense>
  )
}
