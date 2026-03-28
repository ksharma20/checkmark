import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionFromCookies } from '@/lib/auth'
import { en } from '@/locales/en'
import {
  getWorkspaceBySlug,
  getMembershipsByEmail,
  addWorkspaceMember,
  getVerifiedDomainsForEmail,
  getWorkspaceMemberByEmail,
} from '@/lib/db/queries/workspaces'
import JoinClient from './JoinClient'

interface Props {
  params: Promise<{ slug: string }>
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-1)',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
        }}
      >
        <p
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            color: 'var(--brand)',
            marginBottom: '24px',
          }}
        >
          {en.join.brandLogo}
        </p>
        {children}
      </div>
    </div>
  )
}

export default async function JoinPage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) {
    redirect(`/login?invite=${slug}`)
  }

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) {
    return (
      <InfoCard>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
          Workspace not found
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          This workspace link is invalid or the workspace no longer exists.
        </p>
        <Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>
          Back to dashboard
        </Link>
      </InfoCard>
    )
  }

  const email = session.email

  // Check existing membership in this workspace
  const existing = await getWorkspaceMemberByEmail(workspace.id, email)

  // Already an active member
  if (existing?.status === 'active') {
    redirect('/me')
  }

  // Has a pending consent invite
  if (existing?.status === 'pending_consent') {
    return (
      <InfoCard>
        <JoinClient memberId={existing.id} workspaceName={workspace.name} />
      </InfoCard>
    )
  }

  // No invite but domain might match verified domains — auto-enrol
  const matchingIds = await getVerifiedDomainsForEmail(email)
  if (matchingIds.includes(workspace.id)) {
    await addWorkspaceMember({
      workspaceId: workspace.id,
      userId: session.sub,
      email,
      role: 'member',
      status: 'active',
    })
    redirect('/me')
  }

  // No path to join — invite required
  return (
    <InfoCard>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
        Invite required
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        You need to be invited by a <strong>{workspace.name}</strong> admin to join this workspace.
      </p>
      <Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>
        Back to dashboard
      </Link>
    </InfoCard>
  )
}
