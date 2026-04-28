import Link from 'next/link'
import type { Metadata } from 'next'
import { getServerUser } from '@/lib/auth'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import BottomNav from '@/components/user/BottomNav'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PageTransition from '@/components/PageTransition'
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
  const adminWorkspaces = user ? await getAdminWorkspacesForUser(user.userId) : []

  const wsHref =
    adminWorkspaces.length === 1 ? `/ws/${adminWorkspaces[0].slug}` : '/ws'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--surface-1)',
      }}
    >
      {/* PWA meta tags for /me */}
      <link rel="manifest" href="/manifest-me.json" />
      <meta name="theme-color" content="#ffffff" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={en.brand.shortName} />
      {/* Header */}
      <header
        style={{
          height: '52px',
          background: 'var(--header-bg)',
          boxShadow: '0 1px 0 rgba(27,77,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ flex: 1 }}>
          <img src="/logo.png" alt="CheckMark" style={{ height: '60px', width: 'auto' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {adminWorkspaces.length > 0 && (
            <Link
              href={wsHref}
              style={{
                fontSize: '12px',
                fontFamily: 'DM Sans, sans-serif',
                color: 'rgba(241,245,249,0.65)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: '0 10px',
                border: '1px solid rgba(27,77,255,0.35)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Workspace →
            </Link>
          )}
          <Link
            href="/me/settings"
            aria-label="Settings"
            className="flex items-center justify-center sm:hidden"
            style={{
              width: '32px',
              height: '32px',
              color: 'rgba(241,245,249,0.65)',
              textDecoration: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Main content - padded bottom for fixed nav */}
      <main style={{ flex: 1, paddingBottom: '72px' }}><PageTransition>{children}</PageTransition></main>

      <BottomNav />
      <PwaInstallPrompt />
    </div>
  )
}
