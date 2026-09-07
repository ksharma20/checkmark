import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import PeopleClient, { AddEmployeeButton } from './PeopleClient'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { en } from '@/locales/en'
import { wsPeopleUi } from '@/locales/en/ws-people'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * The workforce directory AND the membership screen - one tab, because they
 * were always one list.
 *
 * They used to be two: /people for membership, /employees for HR records. The
 * split stopped being real when the employee directory started listing every
 * member, at which point the two screens showed the same people from opposite
 * tables and reported different headcounts (the employee side filtered out
 * anyone who had not accepted their invitation).
 *
 * The permission split survives the merge, and is the reason this is not just a
 * rename: `members:read` opens the page, `employees:read` is what reveals the
 * HR columns. GET /api/ws/[slug]/members strips those fields server-side for a
 * viewer without it - the table is not what enforces this.
 */
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

  const canAddEmployee = can(role.permissions, Resource.Employees, Action.Write)

  return (
    <div>
      <div className="row-between">
        <div>
          <h1 className="t-h1">{en.wsPeople.pageTitle}</h1>
          <p className="t-secondary page-subtitle">{wsPeopleUi.subtitle}</p>
        </div>
        {canAddEmployee && <AddEmployeeButton slug={slug} />}
      </div>
      <PeopleClient slug={slug} viewerUserId={session.sub} />
    </div>
  )
}
