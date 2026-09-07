import Image from 'next/image'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionFromCookies } from '@/lib/auth'
import {
  getWorkspaceBySlug,
  getVerifiedDomainsForEmail,
  getWorkspaceMemberByEmail,
} from '@/lib/db/queries/workspaces'
import { autoEnrolIntoWorkspace } from '@/lib/membership'
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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial glow */}
      <div style={{
        pointerEvents: 'none',
        position: 'absolute',
        left: '50%',
        top: '-10%',
        width: '700px',
        height: '500px',
        transform: 'translateX(-50%)',
        background: 'radial-gradient(ellipse at center, rgba(27,77,255,0.09) 0%, transparent 70%)',
        zIndex: 0,
      }} />
      {/* Grid pattern */}
      <div style={{
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(27,77,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(27,77,255,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)',
        zIndex: 0,
      }} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '420px',
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
        }}
      >
        <Image src="/logo.png" alt="CheckMark" width={75} height={42} style={{ height: '42px', width: 'auto', marginBottom: '24px' }} />
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

  // No invite but domain might match verified domains - auto-enrol
  const matchingIds = await getVerifiedDomainsForEmail(email)
  if (matchingIds.includes(workspace.id)) {
    // Through the shell so an HR record already filed under this address is
    // claimed at the same moment - the admin may have added them as an employee
    // before they ever signed up.
    await autoEnrolIntoWorkspace({
      workspaceId: workspace.id,
      userId: session.sub,
      email,
      existingMemberId: existing?.id ?? null,
      existingStatus: existing?.status ?? null,
    })
    redirect('/me')
  }

  // No path to join - invite required
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
