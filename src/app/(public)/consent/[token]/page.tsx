import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMemberByConsentToken, declineConsent, getWorkspaceById } from '@/lib/db/queries/workspaces'
import { acceptMembership, isInviteExpired } from '@/lib/membership'
import { getSessionFromCookies } from '@/lib/auth'
import { en } from '@/locales/en'
import { access } from '@/locales/en/access'
import AuthShell from '@/components/marketing/AuthShell'

interface Props {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}

function ResultCard({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <AuthShell centered>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-body">{body}</p>
      {cta}
    </AuthShell>
  )
}

/** Every exit from this page is a link back to one of two places. */
function SignInLink() {
  return <Link href="/login" className="auth-link">{access.consent.signIn}</Link>
}
function DashboardLink() {
  return <Link href="/me" className="auth-link">{access.consent.dashboard}</Link>
}

export default async function ConsentPage({ params, searchParams }: Props) {
  const { token } = await params
  const { action } = await searchParams

  const member = await getMemberByConsentToken(token)

  if (!member) {
    return (
      <ResultCard
        title={access.consent.invalidTitle}
        body={access.consent.invalidBody}
        cta={<SignInLink />}
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
        title={access.consent.declinedTitle}
        body={en.consent.declineBody}
        cta={<SignInLink />}
      />
    )
  }

  // Accept - requires login and email must match the invited address
  if (action === 'accept') {
    // Reject already-used tokens
    if (member.status !== 'pending_consent') {
      return (
        <ResultCard
          title={access.consent.usedTitle}
          body={access.consent.usedBody}
          cta={<DashboardLink />}
        />
      )
    }

    // The RULE lives in `isInviteExpired`, which `acceptMembership` also uses -
    // this is the same check, not a second one, so the two cannot drift. It is
    // made here as well because it is worth answering BEFORE a logged-out
    // visitor is sent round the login flow for a link that is already dead.
    const expiredCard = (
      <ResultCard
        title={access.consent.expiredTitle}
        body={access.consent.expiredBody}
        cta={<SignInLink />}
      />
    )
    if (isInviteExpired(member.consent_token_expires_at)) return expiredCard

    const session = await getSessionFromCookies()
    if (session) {
      // Email must match - prevent token-hijacking
      if (session.email.toLowerCase() !== member.email.toLowerCase()) {
        return (
          <ResultCard
            title={access.consent.wrongAccountTitle}
            body={access.consent.wrongAccountBody(member.email)}
            cta={<Link href="/login" className="auth-link">{access.consent.wrongAccountCta}</Link>}
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
            title={access.consent.usedTitle}
            body={access.consent.usedBody}
            cta={<DashboardLink />}
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
      title={access.consent.missingActionTitle}
      body={access.consent.missingActionBody}
      cta={<SignInLink />}
    />
  )
}
