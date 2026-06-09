'use client'

import { useState } from 'react'
import PageTransition from '@/components/PageTransition'
import WsSidebar from '@/components/ws/WsSidebar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import NotificationBell from '@/components/notifications/NotificationBell'
import NotificationPanel from '@/components/notifications/NotificationPanel'

interface Props {
  slug: string
  leavesEnabled: boolean
  children: React.ReactNode
}

export default function WsLayoutClient({ slug, leavesEnabled, children }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--surface-1)' }}>
      <WsSidebar slug={slug} leavesEnabled={leavesEnabled} />

      {/* Right column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', position: 'relative' }}>

        {/* Top header — dark to match sidebar */}
        <header style={{
          height: '52px',
          background: '#0D1B2A',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 16px',
          flexShrink: 0,
          zIndex: 30,
        }}>
          <NotificationBell
            pollUrl={`/api/ws/${slug}/notifications/unread-count`}
            onBellClick={() => setPanelOpen(v => !v)}
            isOpen={panelOpen}
          />
        </header>

        {/* Notification panel — anchored to column, above scroll overflow */}
        {panelOpen && (
          <div style={{ position: 'absolute', top: '52px', right: '16px', zIndex: 200 }}>
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
  )
}
