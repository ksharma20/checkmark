import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import DisputesClient from './DisputesClient'

interface Props { params: Promise<{ slug: string }> }

export default async function DisputesPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700,
          color: 'var(--navy)', margin: '0 0 6px',
        }}>
          Disputes
        </h1>
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
          color: 'var(--text-secondary)', margin: 0,
        }}>
          Events that were not matched by any signal. Override individual events to count them toward attendance.
        </p>
      </div>
      <DisputesClient slug={slug} tz={workspace.display_timezone} />
    </div>
  )
}
