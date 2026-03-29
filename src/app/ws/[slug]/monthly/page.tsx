import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getPlanLimits } from '@/lib/plans'
import Link from 'next/link'
import MonthlyClient from './MonthlyClient'

interface Props { params: Promise<{ slug: string }> }

export default async function MonthlyPage({ params }: Props) {
  const { slug } = await params
  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const planLimits = getPlanLimits(workspace.plan)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700,
          color: 'var(--navy)', margin: 0,
        }}>
          Monthly
        </h1>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '4px', padding: '2px 8px', color: 'var(--text-muted)',
        }}>
          {workspace.plan}
        </span>
      </div>

      <MonthlyClient
        slug={slug}
        tz={workspace.display_timezone}
        canExport={planLimits.csvExport}
        historyMonths={planLimits.historyMonths}
      />

      {!planLimits.csvExport && (
        <div style={{
          marginTop: '20px',
          background: 'color-mix(in srgb, var(--brand) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          flexWrap: 'wrap',
        }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            CSV export is available on Starter and Growth plans.
          </p>
          <Link href="/pricing" style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
            color: 'var(--brand)', textDecoration: 'none',
          }}>
            View pricing →
          </Link>
        </div>
      )}
    </div>
  )
}
