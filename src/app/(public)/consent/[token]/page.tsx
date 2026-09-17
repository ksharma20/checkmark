import Image from 'next/image'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMemberByConsentToken, declineConsent, getWorkspaceById } from '@/lib/db/queries/workspaces'
import { acceptMembership, isInviteExpired } from '@/lib/membership'
import { getSessionFromCookies } from '@/lib/auth'
import { en } from '@/locales/en'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}

function ResultCard({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
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
          textAlign: 'center',
        }}
      >
        <Image src="/logo.png" alt="CheckMark" width={75} height={42} style={{ height: '42px', width: 'auto', marginBottom: '24px' }} />
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
          {title}
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {body}
        </p>
        {cta}
      </div>
    </div>
  )
}

export default async function ConsentPage({ params, searchParams }: Props) {
  const { token } = await params
  const { action } = await searchParams

  const member = await getMemberByConsentToken(token)

  if (!member) {
    return (
      <ResultCard
        title="Invalid or expired link"
        body="This consent link is no longer valid. Ask your workspace admin to resend the invite."
        cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to sign in</Link>}
      />
    )
  }

  // Decline - no login required, but only if still pending
  if (action === 'decline') {
    if (member.status === 'pending_consent') {
      await declineConsent(member.id)
    }
    return (
      <ResultCard
        title="Invitation declined"
        body={en.consent.declineBody}
        cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to sign in</Link>}
      />
    )
  }

  // Accept - requires login and email must match the invited address
  if (action === 'accept') {
    // Reject already-used tokens
    if (member.status !== 'pending_consent') {
      return (
        <ResultCard
          title="Link already used"
          body="This invitation link has already been accepted or declined."
          cta={<Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to dashboard</Link>}
        />
      )
    }

    // The RULE lives in `isInviteExpired`, which `acceptMembership` also uses -
    // this is the same check, not a second one, so the two cannot drift. It is
    // made here as well because it is worth answering BEFORE a logged-out
    // visitor is sent round the login flow for a link that is already dead.
    const expiredCard = (
      <ResultCard
        title="Link expired"
        body="This invitation link has expired. Ask your workspace admin to resend the invite."
        cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to sign in</Link>}
      />
    )
    if (isInviteExpired(member.consent_token_expires_at)) return expiredCard

    const session = await getSessionFromCookies()
    if (session) {
      // Email must match - prevent token-hijacking
      if (session.email.toLowerCase() !== member.email.toLowerCase()) {
        return (
          <ResultCard
            title="Wrong account"
            body={`This invitation was sent to ${member.email}. Please sign in with that email address to accept.`}
            cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Sign in with the correct account</Link>}
          />
        )
      }
      // The result is READ rather than discarded: the row is re-fetched inside,
      // so the window between the checks above and the write is where an expiry
      // or a second accept from another tab lands.
      const result = await acceptMembership(member.id, session.sub, session.email)
      if (!result.ok) {
        if (result.code === 'EXPIRED') return expiredCard
        return (
          <ResultCard
            title="Link already used"
            body="This invitation link has already been accepted or declined."
            cta={<Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to dashboard</Link>}
          />
        )
      }
      redirect('/me')
    }
    // Not logged in - redirect to login with invite param
    const workspace = await getWorkspaceById(member.workspace_id)
    const inviteSlug = workspace?.slug ?? ''
    redirect(`/login?invite=${inviteSlug}`)
  }

  return (
    <ResultCard
      title="Invalid action"
      body="The link you followed is missing a required parameter."
      cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to sign in</Link>}
    />
  )
}
