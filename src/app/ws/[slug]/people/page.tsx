import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import PeopleClient from './PeopleClient'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { en } from '@/locales/en'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Gate on the PERMISSION, not on holding a built-in role. A custom role with
  // members:read must reach this page - checking isWorkspaceAdmin here would
  // silently bounce every custom role no matter what its grid says.
  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Members, Action.Read)) {
    redirect('/me')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-1)', padding: '24px 20px' }}>
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h1
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '20px',
        }}
      >
        {en.wsPeople.pageTitle}
      </h1>
      <PeopleClient slug={slug} viewerUserId={session.sub} />
    </div>
    </div>
  )
}
