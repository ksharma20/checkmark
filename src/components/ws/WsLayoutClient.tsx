'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Menu } from 'lucide-react'
import PageTransition from '@/components/PageTransition'
import WsSidebar from '@/components/ws/WsSidebar'
import WsAccountMenu from '@/components/ws/WsAccountMenu'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import NotificationBell from '@/components/notifications/NotificationBell'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { ToastProvider } from '@/components/shared/Toast'
import { Chip, IconButton, WorkspaceAvatar } from '@/components/ui'
import { useOverlay } from '@/components/ui/use-overlay'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'
import type { Resource } from '@/lib/permissions/catalogue'

interface Props {
  slug: string
  /** Seeds the avatar's fallback colour. The id, never the slug. */
  workspaceId: string
  leavesEnabled: boolean
  workspaceName: string
  /** null when the workspace has no logo; also the image cache-buster. */
  logoUpdatedAt?: string | null
  /** Plan key as stored on the workspace row - rendered as a chip. */
  plan: string
  /** Leave + regularization, badged on the Approvals nav entry. */
  pendingApprovalsCount: number
  userName: string
  userRoleName: string
  /** Resources this role can read - the screen registry filters the nav on it. */
  readableResources: Resource[]
  /** Seeded from the `vnz_nav` cookie by the server layout, so the first paint
   *  is already the right width. */
  initialNavCollapsed: boolean
  children: React.ReactNode
}

/** Matches the stylesheet's shell breakpoint. The two must not drift. */
const DESKTOP_QUERY = '(min-width: 861px)'

/**
 * The `.shell-ws` frame: the sidebar beside `.ws-main`, the column carrying the
 * 64px `.ws-topbar` and the 1180px-wide `.ws-content`.
 *
 * The sidebar is a sidebar at every width now - the ≤860px horizontal tab strip
 * is gone. It has two independent pieces of state and neither one needs to know
 * the viewport width, because the stylesheet decides which is meaningful:
 *
 * - `navCollapsed` - 228px column or 64px icon rail. Persisted to `vnz_nav`,
 *   because it is a preference. Only expressed at ≥861px.
 * - `drawerOpen`   - the off-canvas drawer. Deliberately NOT persisted: a
 *   navigation drawer that reopens itself on the next page is a bug, not a
 *   preference. Only expressed at ≤860px.
 *
 * Above 861px this is a real app shell: `.shell-ws` is exactly one viewport
 * tall and does not scroll, the sidebar is a static full-height column, and
 * `.ws-main` is the scroll container - so only the content moves and the
 * topbar's `position: sticky` pins to the top of that column. At or below 860px
 * the shell reverts to a normal page-scrolling stack and the sidebar lifts out
 * of the flow entirely as a fixed overlay.
 */
export default function WsLayoutClient({
  slug, workspaceId, logoUpdatedAt, leavesEnabled, workspaceName, plan, pendingApprovalsCount,
  userName, userRoleName, readableResources, initialNavCollapsed, children,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(initialNavCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Escape, body scroll lock (restoring the previous value), focus into the
  // panel and back to the opener, and the focus trap - the same contract Modal,
  // SlideOver and BottomSheet share. The drawer is not portalled (it is part of
  // the shell), so `mounted` is unused here; everything else applies verbatim.
  const { panelRef } = useOverlay<HTMLElement>(drawerOpen, closeDrawer)

  // A drawer that survived a navigation would cover the page the user just
  // asked for. Adjusted during render rather than in an effect: an effect here
  // trips this repo's `react-hooks/set-state-in-effect` rule, and would also
  // paint the new page with the drawer still over it for one frame. Every nav
  // link calls `onNavigate` too - this is what additionally catches the browser
  // back and forward buttons.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawerOpen(false)
  }

  // The ONE piece of responsive JS in the shell, and it earns its place: the
  // drawer's focus trap is only correct while the sidebar is an overlay. Open
  // the drawer on a phone, rotate to landscape past 861px, and without this the
  // trap would be holding focus inside a sidebar that has become an ordinary
  // inline column - keyboard users would be stuck in the nav. No initial read:
  // the drawer always starts shut, so there is nothing to correct on mount and
  // this stays a pure subscription.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const closeIfDesktop = (e: MediaQueryListEvent) => { if (e.matches) setDrawerOpen(false) }
    mq.addEventListener('change', closeIfDesktop)
    return () => mq.removeEventListener('change', closeIfDesktop)
  }, [])

  function toggleNav() {
    setNavCollapsed((collapsed) => {
      const next = !collapsed
      // Written from the browser and read by the server layout on the next
      // request. Lax rather than Strict for the same reason the session cookie
      // is: a PWA cold-open is treated as cross-site and would drop it.
      document.cookie =
        `${en.constants.cookieNav}=${next ? 'collapsed' : 'expanded'};path=/;max-age=31536000;samesite=lax`
      return next
    })
  }

  return (
    <ToastProvider>
      <div
        className="shell-ws"
        data-nav={navCollapsed ? 'collapsed' : 'expanded'}
        data-drawer={drawerOpen ? 'open' : 'closed'}
      >
        {/* Only ever visible at ≤860px, where the sidebar is a fixed overlay.
            `hidden` rather than a conditional render: the click that closes the
            drawer must not also fall through onto whatever is underneath. */}
        <div className="ws-scrim" onClick={closeDrawer} hidden={!drawerOpen} aria-hidden />

        <WsSidebar
          navRef={panelRef}
          slug={slug}
          collapsed={navCollapsed}
          onToggleCollapsed={toggleNav}
          onNavigate={closeDrawer}
          leavesEnabled={leavesEnabled}
          pendingApprovalsCount={pendingApprovalsCount}
          userName={userName}
          userRoleName={userRoleName}
          readableResources={readableResources}
        />

        <div className="ws-main">
          <header className="ws-topbar">
            <div className="topbar-lead">
              {/* ≤860px only - the stylesheet hides it above the breakpoint,
                  where the sidebar is always on screen and has its own toggle. */}
              <IconButton
                className="nav-drawer-toggle"
                variant="plain"
                label={drawerOpen ? wsAdmin.shell.closeNav : wsAdmin.shell.openNav}
                icon={<Menu size={18} />}
                aria-expanded={drawerOpen}
                aria-controls="ws-sidebar"
                onClick={() => setDrawerOpen((v) => !v)}
              />

              {/* The pill is the workspace switcher: /ws is the picker. */}
              <Link
                href="/ws"
                className="ws-pill pressable"
                title={wsAdmin.shell.switchWorkspace}
              >
                <WorkspaceAvatar
                  id={workspaceId}
                  slug={slug}
                  name={workspaceName}
                  logoUpdatedAt={logoUpdatedAt}
                />
                <span className="ws-pill-name">{workspaceName}</span>
                <ChevronDown size={13} aria-hidden className="ws-pill-caret" />
              </Link>
            </div>

            <div className="topbar-actions">
              <Chip tone="owner" className="topbar-role-chip">{userRoleName}</Chip>
              <Chip tone="verified" className="topbar-plan-chip">
                {wsAdmin.shell.planChip(plan)}
              </Chip>

              <div className="topbar-bell">
                <NotificationBell
                  pollUrl={`/api/ws/${slug}/notifications/unread-count`}
                  onBellClick={() => setPanelOpen((v) => !v)}
                  isOpen={panelOpen}
                />
                {panelOpen && (
                  <div className="topbar-bell-panel">
                    <NotificationPanel slug={slug} onClose={() => setPanelOpen(false)} />
                  </div>
                )}
              </div>

              {/* `.topbar-account` is display:none above 860px - below it, this
                  replaces the sidebar foot, which the stylesheet hides. */}
              <div className="topbar-account">
                <WsAccountMenu
                  slug={slug}
                  userName={userName}
                  userRoleName={userRoleName}
                  variant="topbar"
                />
              </div>
            </div>
          </header>

          <main className="ws-content">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>

        <PwaInstallPrompt />
      </div>
    </ToastProvider>
  )
}
