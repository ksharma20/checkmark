import { notFound, redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth'
import { getWorkspaceBySlug } from '@/lib/db/queries/workspaces'
import { getWsRole } from '@/lib/ws-access'
import { listWorkspaceRoles, getRoleMemberCounts } from '@/lib/db/queries/roles'
import { can } from '@/lib/permissions/can'
import { RESOURCES, isSystemRole, Action, Resource } from '@/lib/permissions/catalogue'
import { en } from '@/locales/en'
import RolesClient from './RolesClient'

interface Props { params: Promise<{ slug: string }> }

export default async function RolesPage({ params }: Props) {
  const { slug } = await params
  const user = await getServerUser()
  if (!user) redirect('/login')

  const workspace = await getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  // Server-side gate. The sidebar also hides this tab, but that is only a
  // courtesy - someone typing the URL must land somewhere sensible.
  const role = await getWsRole(workspace.id, user.userId)
  if (!role || !can(role.permissions, Resource.Roles, Action.Read)) redirect('/me')

  // Fetched here rather than from the client on mount: the data is ready on
  // first paint, so there is no loading flash and no fetch-on-mount effect.
  const [roles, counts] = await Promise.all([
    listWorkspaceRoles(workspace.id),
    getRoleMemberCounts(workspace.id),
  ])

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        {en.wsRoles.pageTitle}
      </h1>
      <p
        style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
        }}
      >
        {en.wsRoles.pageSubtitle}
      </p>

      <RolesClient
        slug={slug}
        initialRoles={roles.map((r) => ({
          id: r.id,
          key: r.key,
          name: r.name,
          description: r.description,
          permissions: r.permissions,
          scope: r.scope,
          isSystem: isSystemRole(r.key),
          memberCount: counts[r.key] ?? 0,
        }))}
        resources={RESOURCES.map((r) => ({
          key: r.key,
          label: r.label,
          actions: [...r.actions],
        }))}
        viewer={{
          roleKey: role.key,
          roleName: role.name,
          permissions: role.permissions,
          canWrite: can(role.permissions, Resource.Roles, Action.Write),
          canDelete: can(role.permissions, Resource.Roles, Action.Delete),
        }}
      />
    </div>
  )
}
