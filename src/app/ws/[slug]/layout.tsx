import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug, getWorkspaceMember } from '@/lib/db/queries/workspaces'
import { en } from '@/locales/en'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function WsSlugLayout({ children, params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const membership = await getWorkspaceMember(workspace.id, user.userId)
  if (!membership || membership.role !== 'admin' || membership.status !== 'active') {
    redirect('/me')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: 'var(--surface-1)',
      }}
    >
      {/* PWA meta tags for /ws */}
      <link rel="manifest" href="/manifest-ws.json" />
      <meta name="theme-color" content="#1B4DFF" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={`${en.brand.shortName} WS`} />
      {/* Top header */}
      <header
        style={{
          background: 'var(--surface-0)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Brand + workspace name row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '52px',
            padding: '0 20px',
          }}
        >
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              color: 'var(--brand)',
              marginRight: '8px',
            }}
          >
            {en.brand.name}
          </span>
          <span style={{ color: 'var(--border)', marginRight: '8px', fontSize: '14px' }}>/</span>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              color: 'var(--navy)',
              flex: 1,
            }}
          >
            {workspace.name}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Link
              href="/ws"
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                height: '32px',
                padding: '0 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ⊞ Workspaces
            </Link>
            <Link
              href="/me"
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                height: '32px',
                padding: '0 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Personal →
            </Link>
          </div>
        </div>

        {/* Nav tabs */}
        <nav
          style={{
            display: 'flex',
            padding: '0 20px',
            gap: '2px',
          }}
        >
          <NavTab href={`/ws/${slug}`} label="Dashboard" />
          <NavTab href={`/ws/${slug}/people`} label="People" />
          <NavTab href={`/ws/${slug}/insights`} label="Insights" />
          <NavTab href={`/ws/${slug}/settings`} label="Settings" />
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        padding: '10px 14px',
        borderBottom: '2px solid transparent',
        display: 'block',
      }}
    >
      {label}
    </Link>
  )
}
