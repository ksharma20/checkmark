'use client'

import PageTransition from '@/components/PageTransition'
import WsSidebar from '@/components/ws/WsSidebar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

interface Props {
  slug: string
  leavesEnabled: boolean
  children: React.ReactNode
}

export default function WsLayoutClient({ slug, leavesEnabled, children }: Props) {
  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--surface-1)' }}>
      <WsSidebar slug={slug} leavesEnabled={leavesEnabled} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100dvh', overflowY: 'auto', overflowX: 'hidden', background: 'var(--surface-1)' }}>
        <main style={{ flex: 1 }}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <PwaInstallPrompt />
    </div>
  )
}
