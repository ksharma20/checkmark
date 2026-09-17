import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionFromCookies } from '@/lib/auth'
import {
  getWorkspaceBySlug,
  getVerifiedDomainsForEmail,
  getWorkspaceMemberByEmail,
} from '@/lib/db/queries/workspaces'
import { autoEnrolIntoWorkspace } from '@/lib/membership'
import { access } from '@/locales/en/access'
import AuthShell from '@/components/marketing/AuthShell'
import JoinClient from './JoinClient'

interface Props {
  params: Promise<{ slug: string }>
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
      <AuthShell>
        <h1 className="auth-title">{access.join.notFoundTitle}</h1>
        <p className="auth-body">{access.join.notFoundBody}</p>
        <Link href="/me" className="auth-link">
          {access.join.backToApp}
        </Link>
      </AuthShell>
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
      <AuthShell>
        <JoinClient memberId={existing.id} workspaceName={workspace.name} />
      </AuthShell>
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
    <AuthShell>
      <h1 className="auth-title">{access.join.inviteRequiredTitle}</h1>
      <p className="auth-body">{access.join.inviteRequiredBody(workspace.name)}</p>
      <Link href="/me" className="auth-link">
        {access.join.backToApp}
      </Link>
    </AuthShell>
  )
}
