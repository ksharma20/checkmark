import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import ApprovalsClient from './ApprovalsClient'
import { en } from '@/locales/en'

interface Props { params: Promise<{ slug: string }> }

export default async function ApprovalsPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  return (
    <div className="dash-page fx-spring" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700,
          color: 'var(--navy)', margin: '0 0 6px',
        }}>
          {en.wsApprovals.pageTitle}
        </h1>
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
          color: 'var(--text-secondary)', margin: 0,
        }}>
          {en.wsApprovals.pageSubtitle}
        </p>
      </div>
      <ApprovalsClient slug={slug} />
    </div>
  )
}
