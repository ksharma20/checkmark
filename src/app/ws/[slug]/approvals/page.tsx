import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { en } from '@/locales/en'
import ApprovalsClient from './ApprovalsClient'

interface Props { params: Promise<{ slug: string }> }

export default async function ApprovalsPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Mirrors requireWsAccess(request, slug, Resource.Approvals, Action.Read),
  // which the /api/ws/:slug/approvals route enforces independently.
  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Approvals, Action.Read)) redirect('/me')

  const canAction = can(role.permissions, Resource.Approvals, Action.Write)

  return (
    <div>
      <div className="fx-spring">
        <h1 className="t-h1">{en.wsApprovals.pageTitle}</h1>
        <p className="t-secondary" style={{ marginTop: '2px' }}>{en.wsApprovals.pageSubtitle}</p>
      </div>
      <ApprovalsClient slug={slug} canAction={canAction} />
    </div>
  )
}
