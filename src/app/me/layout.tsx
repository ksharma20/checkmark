import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getServerUser } from '@/lib/auth'
import {
  getUserWorkspaces,
  getWorkspacesByIds,
} from '@/lib/db/queries/workspaces'
import { getRolesForUserWorkspaces } from '@/lib/db/queries/roles'
import { getUserById } from '@/lib/db/queries/users'
import { hasAnyOrgAccess } from '@/lib/permissions/can'
import BottomNav from '@/components/user/BottomNav'
import MeTopbar, { type MeWorkspaceOption } from '@/components/user/MeTopbar'
import TimezoneReporter from '@/components/user/TimezoneReporter'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PageTransition from '@/components/PageTransition'
import { ToastProvider } from '@/components/shared/Toast'
import { ActiveWorkspaceProvider } from './workspace-scope'
import { resolveActiveWorkspaceSlug } from './active-workspace'
import { en } from '@/locales/en'

export const metadata: Metadata = {
  title: 'My Presence',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser()

  // The shell renders for signed-out visitors too (middleware handles the
  // redirect); it just has nothing to put in the pill.
  let workspaces: MeWorkspaceOption[] = []
  let userName = ''
  let activeSlug: string | null = null

  if (user) {
    const [memberships, rolesByWorkspace, profile] = await Promise.all([
      getUserWorkspaces(user.userId),
      getRolesForUserWorkspaces(user.userId),
      getUserById(user.userId),
    ])

    const wsRows = await getWorkspacesByIds(memberships.map((m) => m.workspace_id))
    const wsMap = new Map(wsRows.map((w) => [w.id, w]))

    workspaces = memberships.flatMap((m) => {
      const ws = wsMap.get(m.workspace_id)
      if (!ws || ws.archived_at) return []
      const role = rolesByWorkspace[m.workspace_id]
      return [{
        id: ws.id,
        slug: ws.slug,
        name: ws.name,
        // Display name, never the raw key - `hr-manager` would otherwise
        // render as "Hr-manager".
        logoUpdatedAt: ws.logo_updated_at ?? null,
        roleName: role?.name ?? m.role,
        hasOrgAccess: hasAnyOrgAccess(role?.permissions),
      }]
    })

    // The remembered choice, checked against the memberships just loaded - a
    // cookie naming a workspace this user is not in resolves to their first.
    activeSlug = await resolveActiveWorkspaceSlug(workspaces.map((w) => w.slug))

    userName = profile?.full_name?.trim() || user.email.split('@')[0]
  }

  return (
    <>
      {/* PWA meta tags for /me. theme-color matches --surface-1, the shell's ground. */}
      <link rel="manifest" href="/manifest-me.json" />
      <meta name="theme-color" content="#F8FAFC" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={en.brand.shortName} />

      <ToastProvider>
        {/* One provider around the topbar *and* the page, because the pill in
            the topbar is the only workspace selector on this surface and every
            screen below it reads the choice. Suspense because the provider
            resolves `?ws=` through `useSearchParams`. */}
        <Suspense>
          <ActiveWorkspaceProvider workspaces={workspaces} initialSlug={activeSlug}>
            <div className="shell-me" style={{ background: 'var(--surface-1)' }}>
              {/* Silent timezone reporter - keeps DB in sync with browser timezone */}
              <TimezoneReporter />

              <MeTopbar
                workspaces={workspaces}
                userName={userName}
                userEmail={user?.email ?? ''}
              />

              <main className="me-content">
                <PageTransition>{children}</PageTransition>
              </main>

              <BottomNav />
            </div>
          </ActiveWorkspaceProvider>
        </Suspense>
        <PwaInstallPrompt />
      </ToastProvider>
    </>
  )
}
