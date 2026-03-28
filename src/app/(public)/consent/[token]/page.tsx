import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMemberByConsentToken, acceptConsent, declineConsent, getWorkspaceById } from '@/lib/db/queries/workspaces'
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
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--brand)', marginBottom: '24px' }}>
          {en.consent.brandLogo}
        </p>
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

  // Decline — no login required, but only if still pending
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

  // Accept — requires login and email must match the invited address
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

    // Check token expiry
    const expiresAt = member.consent_token_expires_at
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return (
        <ResultCard
          title="Link expired"
          body="This invitation link has expired. Ask your workspace admin to resend the invite."
          cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Go to sign in</Link>}
        />
      )
    }

    const session = await getSessionFromCookies()
    if (session) {
      // Email must match — prevent token-hijacking
      if (session.email.toLowerCase() !== member.email.toLowerCase()) {
        return (
          <ResultCard
            title="Wrong account"
            body={`This invitation was sent to ${member.email}. Please sign in with that email address to accept.`}
            cta={<Link href="/login" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--brand)' }}>Sign in with the correct account</Link>}
          />
        )
      }
      await acceptConsent(member.id, session.sub)
      redirect('/me')
    }
    // Not logged in — redirect to login with invite param
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
