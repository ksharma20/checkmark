import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import { en } from '@/locales/en'
import { wsOrg } from '@/locales/en/ws-people'
import OrgTreeClient from './OrgTreeClient'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * The reporting structure, as a chart.
 *
 * This tab used to be the Employees directory, which showed the same rows as
 * People from the other table and disagreed with it on the headcount. The
 * directory moved into People; the slot now answers a question People cannot:
 * who reports to whom.
 */
export default async function OrgPage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Employees, Action.Read)) {
    redirect('/me')
  }

  return (
    <div>
      <h1 className="t-h1">{en.wsNav.screens.organisation}</h1>
      <p className="t-secondary page-subtitle">{wsOrg.subtitle}</p>
      <OrgTreeClient slug={slug} viewerUserId={session.sub} />
    </div>
  )
}
