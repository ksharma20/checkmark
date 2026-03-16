import { getServerUser } from '@/lib/auth'
import { getUserWorkspaces, getMembershipsByEmail, getWorkspacesByIds } from '@/lib/db/queries/workspaces'
import OrgsClient from './OrgsClient'

export default async function OrgsPage() {
  const user = await getServerUser()
  if (!user) return null

  const [activeMemberships, allMemberships] = await Promise.all([
    getUserWorkspaces(user.userId),
    getMembershipsByEmail(user.email),
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
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '20px',
        }}
      >
        Workspaces
      </h1>

      <OrgsClient
        activeMemberships={activeMemberships}
        pendingMemberships={pendingMemberships}
        wsMap={Object.fromEntries(wsMap)}
      />
    </div>
  )
}
