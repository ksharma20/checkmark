'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import PageTransition from '@/components/PageTransition'
import WsSidebar from '@/components/ws/WsSidebar'
import WsAccountMenu from '@/components/ws/WsAccountMenu'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import NotificationBell from '@/components/notifications/NotificationBell'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { ToastProvider } from '@/components/shared/Toast'
import { Chip, WorkspaceAvatar } from '@/components/ui'
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
  pendingLeaveCount: number
  pendingApprovalsCount: number
  userName: string
  userRoleName: string
  /** Resources this role can read - the screen registry filters the nav on it. */
  readableResources: Resource[]
  children: React.ReactNode
}

/**
 * The `.shell-ws` frame: a fixed 228px sidebar beside `.ws-main`, the column
 * carrying the 64px `.ws-topbar` and the 1180px-wide `.ws-content`.
 *
 * Above 860px this is a real app shell: `.shell-ws` is exactly one viewport
 * tall and does not scroll, the sidebar is a static full-height column, and
 * `.ws-main` is the scroll container - so only the content moves and the
 * topbar's `position: sticky` pins to the top of that column. At or below
 * 860px the shell reverts to a normal page-scrolling stack with the sidebar
 * collapsed into a horizontal tab strip. Both live in globals.css; this file
 * needs no responsive JS.
 */
export default function WsLayoutClient({
  slug, workspaceId, logoUpdatedAt, leavesEnabled, workspaceName, plan, pendingLeaveCount, pendingApprovalsCount,
  userName, userRoleName, readableResources, children,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="shell-ws">
        <WsSidebar
          slug={slug}
          leavesEnabled={leavesEnabled}
          pendingLeaveCount={pendingLeaveCount}
          pendingApprovalsCount={pendingApprovalsCount}
          userName={userName}
          userRoleName={userRoleName}
          readableResources={readableResources}
        />

        <div className="ws-main">
          <header className="ws-topbar">
            {/* The pill is the workspace switcher: /ws is the picker. */}
            <Link
              href="/ws"
              className="ws-pill pressable"
              title={wsAdmin.shell.switchWorkspace}
              style={{ textDecoration: 'none', maxWidth: '46vw', overflow: 'hidden' }}
            >
              <WorkspaceAvatar
                id={workspaceId}
                slug={slug}
                name={workspaceName}
                logoUpdatedAt={logoUpdatedAt}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {workspaceName}
              </span>
              <ChevronDown size={13} aria-hidden style={{ opacity: 0.6, flexShrink: 0 }} />
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Chip tone="owner">{userRoleName}</Chip>
              <Chip tone="verified" style={{ textTransform: 'capitalize' }}>
                {wsAdmin.shell.planChip(plan)}
              </Chip>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <NotificationBell
                  pollUrl={`/api/ws/${slug}/notifications/unread-count`}
                  onBellClick={() => setPanelOpen((v) => !v)}
                  isOpen={panelOpen}
                />
                {panelOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 200 }}>
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
