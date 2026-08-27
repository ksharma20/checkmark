'use client'

import { useState, useEffect } from 'react'
import PageTransition from '@/components/PageTransition'
import WsSidebar from '@/components/ws/WsSidebar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import NotificationBell from '@/components/notifications/NotificationBell'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { ToastProvider } from '@/components/shared/Toast'
import type { Resource } from '@/lib/permissions/catalogue'

interface Props {
  slug: string
  leavesEnabled: boolean
  workspaceName: string
  memberCount: number | null
  pendingLeaveCount: number
  pendingApprovalsCount: number
  userName: string
  userRoleName: string
  /** Resources this role can read - the screen registry filters the nav on it. */
  readableResources: Resource[]
  children: React.ReactNode
}

export default function WsLayoutClient({
  slug, leavesEnabled, workspaceName, memberCount, pendingLeaveCount, pendingApprovalsCount, userName, userRoleName, readableResources, children,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [todayLabel, setTodayLabel] = useState<string | null>(null)

  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
  }, [])

  return (
    <ToastProvider>
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--surface-1)' }}>
      <WsSidebar
        slug={slug}
        leavesEnabled={leavesEnabled}
        pendingLeaveCount={pendingLeaveCount}
        pendingApprovalsCount={pendingApprovalsCount}
        userName={userName}
        userRoleName={userRoleName}
        readableResources={readableResources}
      />

      {/* Right column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', position: 'relative' }}>

        {/* Top header — dark to match sidebar */}
        <header style={{
          height: '56px',
          background: '#0d2118',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
          zIndex: 30,
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              background: 'rgba(0,212,170,0.15)', border: '1px solid rgba(0,212,170,0.3)',
              color: '#00D4AA', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700,
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}>
              {workspaceName ? workspaceName.charAt(0).toUpperCase() : 'W'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'rgba(255,255,255,0.92)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                {workspaceName}
              </p>
              {memberCount !== null && (
                <p style={{
                  margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.42)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  {memberCount} {memberCount === 1 ? 'employee' : 'employees'}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {todayLabel && (
              <span style={{
                fontSize: '11.5px', color: 'rgba(255,255,255,0.55)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '999px', padding: '5px 11px',
                fontFamily: 'Plus Jakarta Sans, sans-serif', whiteSpace: 'nowrap',
              }}>
                {todayLabel}
              </span>
            )}
            <NotificationBell
              pollUrl={`/api/ws/${slug}/notifications/unread-count`}
              onBellClick={() => setPanelOpen(v => !v)}
              isOpen={panelOpen}
            />
          </div>
        </header>

        {/* Notification panel — anchored to column, above scroll overflow */}
        {panelOpen && (
          <div style={{ position: 'absolute', top: '56px', right: '16px', zIndex: 200 }}>
            <NotificationPanel slug={slug} onClose={() => setPanelOpen(false)} />
          </div>
        )}

        {/* Scrollable page content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--surface-1)' }}>
          <main>
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>

      <PwaInstallPrompt />
    </div>
    </ToastProvider>
  )
}
