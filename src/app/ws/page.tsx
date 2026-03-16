import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerUser } from '@/lib/auth'
import { getAdminWorkspacesForUser } from '@/lib/db/queries/workspaces'

export default async function WsIndexPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspaces = await getAdminWorkspacesForUser(user.userId)

  if (workspaces.length === 0) redirect('/me')
  if (workspaces.length === 1) redirect(`/ws/${workspaces[0].slug}`)

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <p
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            color: 'var(--brand)',
            marginBottom: '24px',
          }}
        >
          CheckMark
        </p>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--navy)',
            marginBottom: '8px',
          }}
        >
          Your workspaces
        </h1>
        <p
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}
        >
          Select a workspace to view its dashboard.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/ws/${ws.slug}`}
              style={{
                display: 'block',
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
                textDecoration: 'none',
              }}
            >
              <p
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 600,
                  fontSize: '15px',
                  color: 'var(--navy)',
                  marginBottom: '2px',
                }}
              >
                {ws.name}
              </p>
              <p
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                /ws/{ws.slug}
              </p>
            </Link>
          ))}
        </div>

        <Link
          href="/me"
          style={{
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ← Back to personal dashboard
        </Link>
      </div>
    </div>
  )
}
