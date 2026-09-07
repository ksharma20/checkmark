import { getServerUser } from '@/lib/auth'
import { getUserWorkspaces, getMembershipsByEmail, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import { getRoleNamesForUser } from '@/lib/db/queries/roles'
import { meSettings } from '@/locales/en/me-settings'
import OrgsClient from './OrgsClient'

export default async function OrgsPage() {
  const user = await getServerUser()
  if (!user) return null

  const [activeMemberships, allMemberships, roleNames] = await Promise.all([
    getUserWorkspaces(user.userId),
    getMembershipsByEmail(user.email),
    getRoleNamesForUser(user.userId),
  ])

  const pendingMemberships = allMemberships.filter((m) => m.status === 'pending_consent')

  // Fetch all relevant workspace details
  const allWorkspaceIds = [
    ...new Set([
      ...activeMemberships.map((m) => m.workspace_id),
      ...pendingMemberships.map((m) => m.workspace_id),
    ]),
  ]
  const workspaces = await getWorkspacesByIds(allWorkspaceIds)
  const wsMap = new Map(workspaces.map((w) => [w.id, w]))

  return (
    <div className="stack">
      <h1 className="t-h1" style={{ color: 'var(--navy)', margin: 0 }}>
        {meSettings.orgs.title}
      </h1>

      <OrgsClient
        activeMemberships={activeMemberships}
        pendingMemberships={pendingMemberships}
        wsMap={Object.fromEntries(wsMap)}
        roleNames={roleNames}
      />
    </div>
  )
}
