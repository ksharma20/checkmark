import Link from 'next/link'
import { getServerUser } from '@/lib/auth'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'
import BottomNav from '@/components/user/BottomNav'

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
      {/* Header */}
      <header
        style={{
          height: '52px',
          background: 'var(--surface-0)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <span
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            color: 'var(--brand)',
            flex: 1,
          }}
        >
          CheckMark
        </span>

        {adminWorkspaces.length > 0 && (
          <Link
            href={wsHref}
            style={{
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              height: '32px',
              padding: '0 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Workspace →
          </Link>
        )}
      </header>

      {/* Main content — padded bottom for fixed nav */}
      <main style={{ flex: 1, paddingBottom: '72px' }}>{children}</main>

      <BottomNav />
    </div>
  )
}
