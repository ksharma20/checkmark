import { Suspense } from 'react'
import DocumentsScreen from './DocumentsScreen'
import { ScopeSkeleton } from '../workspace-scope'

/**
 * `/me/documents` - the member's own document folder.
 *
 * Server shell around a client screen: uploads and downloads are browser work,
 * but the page stays a Server Component so it owns metadata. The Suspense
 * boundary is what `useSearchParams` inside `useWorkspaceScope` requires.
 */

export const metadata = {
  title: 'My documents',
  robots: { index: false, follow: false },
}

export default function MeDocumentsPage() {
  return (
    <Suspense fallback={<ScopeSkeleton />}>
      <DocumentsScreen />
    </Suspense>
  )
}
