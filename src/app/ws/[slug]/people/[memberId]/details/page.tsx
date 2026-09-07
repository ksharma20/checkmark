import { notFound, redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/auth'
import {
  getWorkspaceBySlug,
  getMemberByEmailWithUser,
  getMemberWithUserByRecordId,
} from '@/lib/db/queries/workspaces'
import { findEmployeeByUserId, findEmployeeByWorkEmail, getEmployee } from '@/lib/db/queries/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import { loadReportingTree } from '@/lib/db/queries/hierarchy'
import { subtreeOf } from '@/lib/hierarchy'
import { listWorkspaceRoles } from '@/lib/db/queries/roles'
import { canGrant } from '@/lib/permissions/ranks'
import DetailsClient from './DetailsClient'
import { isPersonTabKey } from '@/components/ws/employee/person-tabs'
import { getWsRole } from '@/lib/ws-access'
import { can } from '@/lib/permissions/can'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props {
  params: Promise<{ slug: string; memberId: string }>
  searchParams: Promise<{ tab?: string }>
}

/**
 * One person: their record, their documents, their leave, their access.
 *
 * Keyed on `workspace_members.id`, NOT on a user id. An invited person has no
 * user row at all, so a userId-keyed route could not address them - and they
 * are exactly the people an admin most needs to open, to finish their profile
 * or chase the invitation.
 */
export default async function PersonDetailsPage({ params, searchParams }: Props) {
  const { slug, memberId } = await params
  const { tab } = await searchParams

  const session = await getSessionFromCookies()
  if (!session) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Gated on `members:read`, same as the directory it is reached from. The HR
  // record is gated separately below - a viewer without `employees:read` gets
  // the Access tab and nothing else.
  const viewerRole = await getWsRole(workspace.id, session.sub)
  if (!viewerRole || !can(viewerRole.permissions, Resource.Members, Action.Read)) {
    redirect('/me')
  }

  // The segment is a membership id. It can also arrive as an EMPLOYEE id: the
  // approvals queue deep-links a pending document, and a document belongs to an
  // employee record, which may not have a membership behind it yet. Resolving
  // both here keeps one route instead of two that drift.
  let member = await getMemberWithUserByRecordId(memberId, workspace.id)
  let employeeById: EmployeePublic | null = null
  if (!member) {
    employeeById = await getEmployee(memberId, workspace.id)
    if (employeeById) {
      const viaEmail = await getMemberByEmailWithUser(workspace.id, employeeById.work_email)
      member = viaEmail
    }
  }
  if (!member) notFound()

  const canReadEmployees = can(viewerRole.permissions, Resource.Employees, Action.Read)
  const canWriteEmployees = can(viewerRole.permissions, Resource.Employees, Action.Write)

  // Two lookups because there are two ways in. Once they have accepted, the
  // employee row carries their user id. Before that it carries only their work
  // email, which is what the add-employee flow wrote.
  const employee = !canReadEmployees
    ? null
    : employeeById
      ?? (member.user_id
        ? await findEmployeeByUserId(workspace.id, member.user_id)
        : await findEmployeeByWorkEmail(workspace.id, member.email))

  // Reporting-manager options.
  //
  // Anyone in this person's own subtree is excluded, because picking them would
  // close a loop - their manager would end up reporting to them. Computed on
  // the server so the tree never has to ship to the browser; PATCH /hierarchy
  // re-checks with wouldCreateCycle regardless, since a hidden option is still
  // a craftable request.
  let managerOptions: Array<{ userId: string; name: string; email: string }> = []
  let currentManagerUserId: string | null = null
  if (canWriteEmployees && member.user_id) {
    const { tree, members: hierarchyMembers } = await loadReportingTree(workspace.id)
    const ownSubtree = new Set(subtreeOf(tree, member.user_id))
    managerOptions = hierarchyMembers
      .filter(m => !ownSubtree.has(m.user_id))
      .map(m => ({ userId: m.user_id, name: m.full_name ?? m.email, email: m.email }))
    currentManagerUserId =
      hierarchyMembers.find(m => m.user_id === member.user_id)?.manager_user_id ?? null
  }

  // Only roles this viewer may actually hand out. The dropdown therefore never
  // offers something PATCH .../role would reject - and it re-checks anyway,
  // because a hidden option is still a craftable request.
  const mayAssignRoles = can(viewerRole.permissions, Resource.AssignRoles, Action.Write)
  const mayTransferOwnership = can(viewerRole.permissions, Resource.Ownership, Action.Write)
  const allRoles = await listWorkspaceRoles(workspace.id)
  const assignableRoles = mayAssignRoles
    ? allRoles
        .filter(r => canGrant(viewerRole.key, r.key))
        .map(r => ({ key: r.key, name: r.name, restricted: false }))
    : []
  // `owner` can never arrive via canGrant (it requires STRICTLY greater rank),
  // so it is appended for holders of `ownership:write`. Picking it does not
  // assign a role at all - it opens the OTP-gated transfer.
  const ownerRole = mayTransferOwnership ? allRoles.find(r => r.key === 'owner') : undefined
  if (ownerRole) assignableRoles.push({ key: ownerRole.key, name: ownerRole.name, restricted: true })

  return (
    <DetailsClient
      slug={slug}
      // Every tab key is deep-linkable now, not just the approvals queue's two.
      // Validated here rather than in the browser so a bogus `?tab=` never
      // reaches `visiblePersonTabs` at all.
      initialTab={isPersonTabKey(tab) ? tab : undefined}
      viewerUserId={session.sub}
      viewerRoleKey={viewerRole.key}
      // The grid itself, not a fan-out of booleans. `visiblePersonTabs` takes a
      // `can(resource, action)` callback and the panels below it re-ask the same
      // question, so shipping one grid is what stops the tab strip and the
      // controls inside it disagreeing about what this viewer may do. It is the
      // same data the sidebar already ships (`readableResources`), and the
      // routes re-check every call regardless - hiding a control is a courtesy,
      // never the enforcement.
      permissions={viewerRole.permissions}
      member={{
        member_id: member.member_id,
        user_id: member.user_id,
        email: member.email,
        full_name: member.full_name,
        role: member.role,
        status: member.status,
      }}
      employee={employee}
      canTransferOwnership={mayTransferOwnership}
      assignableRoles={assignableRoles}
      roleNames={Object.fromEntries(allRoles.map(r => [r.key, r.name]))}
      managerOptions={managerOptions}
      currentManagerUserId={currentManagerUserId}
    />
  )
}
