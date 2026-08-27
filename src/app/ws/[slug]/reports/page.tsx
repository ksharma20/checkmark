import { notFound, redirect } from 'next/navigation'
import { FileText } from 'lucide-react'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { en } from '@/locales/en'

interface Props { params: Promise<{ slug: string }> }

/**
 * Placeholder for the Reports screen.
 *
 * The screen registry has always listed /reports (src/lib/permissions/screens.ts),
 * and owner and admin both hold `export:read`, so the sidebar renders the tab for
 * every one of them. Without this page that tab 404s.
 */
export default async function ReportsPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Gated exactly as the registry says this screen is gated. The sidebar also
  // hides the tab, but that is only a courtesy - someone typing the URL must
  // land somewhere sensible.
  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Export, Action.Read)) redirect('/me')

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '24px 20px',
        color: 'var(--text-muted)',
      }}
    >
      <FileText size={26} />
      <p
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
          margin: 0,
        }}
      >
        {en.wsReports.comingSoon}
      </p>
    </div>
  )
}
