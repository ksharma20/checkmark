import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import {
  getWorkspaceBySlug,
  getWorkspaceMember,
  getActiveMemberWithDetails,
} from '@/lib/db/queries/workspaces'
import { findEmployeeByUserId } from '@/lib/db/queries/employees'
import DetailsClient from './DetailsClient'

interface Props {
  params: Promise<{ slug: string; userId: string }>
}

export default async function EmployeeDetailsPage({ params }: Props) {
  const { slug, userId } = await params

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  const adminMembership = await getWorkspaceMember(workspace.id, session.sub)
  if (
    !adminMembership ||
    adminMembership.role !== 'admin' ||
    adminMembership.status !== 'active'
  ) {
    redirect('/me')
  }

  const member = await getActiveMemberWithDetails(workspace.id, userId)
  if (!member) notFound()

  const employee = await findEmployeeByUserId(workspace.id, userId)

  return <DetailsClient slug={slug} member={member} employee={employee} />
}
