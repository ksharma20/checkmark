import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'
import NewEmployeeClient from './NewEmployeeClient'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Add an employee.
 *
 * A route rather than a view flag on the directory, so it is deep-linkable. It
 * replaced the old inline "invite someone" email box on the People screen: an
 * email address on its own was never enough to run payroll, holidays or
 * documents against, and it left every new joiner as a row nobody had filled in.
 *
 * It no longer takes `?draft=`. That existed to resume a five-step wizard that
 * saved as it went; the form is now three fields, so there is nothing to
 * resume - the record is created in one request and finished on the person
 * screen, a tab at a time.
 *
 * Inviting is a separate permission from creating the record - a role may be
 * trusted to keep HR data without being trusted to hand out workspace access -
 * and the offer now lives on that person's Access tab, gated there.
 */
export default async function NewEmployeePage({ params }: Props) {
  const { slug } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const role = await getWsRole(workspace.id, session.sub)
  if (!role || !can(role.permissions, Resource.Employees, Action.Write)) {
    redirect('/me')
  }

  return <NewEmployeeClient slug={slug} />
}
