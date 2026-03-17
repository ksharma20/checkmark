import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug, getWorkspaceMember } from '@/lib/db/queries/workspaces'
import PeopleClient from './PeopleClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PeoplePage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const membership = await getWorkspaceMember(workspace.id, session.sub)
  if (!membership || membership.role !== 'admin' || membership.status !== 'active') {
    redirect('/me')
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '20px',
        }}
      >
        People
      </h1>
      <PeopleClient slug={slug} />
    </div>
  )
}
