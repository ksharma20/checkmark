import { db } from '../index'

export interface Workspace {
  id: string
  slug: string
  name: string
  plan: string
  display_timezone: string
  domain_verified: number
  verification_token: string | null
  verification_token_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkspaceDomain {
  id: string
  workspace_id: string
  domain: string
  verified_at: string | null
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string | null
  email: string
  role: string
  status: string
  consent_token: string | null
  consent_token_expires_at: string | null
  added_at: string
}

export interface AdminOverride {
  id: string
  workspace_id: string
  presence_event_id: string
  admin_user_id: string
  note: string | null
  created_at: string
}

// ─── Workspace CRUD ───────────────────────────────────────────────────────────

export async function createWorkspace(params: {
  slug: string
  name: string
  creatorUserId: string
  creatorEmail: string
  domains?: string[]
}): Promise<Workspace> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)`,
    [id, params.slug, params.name]
  )

  // Add creator as admin
  const memberId = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_members (id, workspace_id, user_id, email, role, status)
     VALUES (?, ?, ?, ?, 'admin', 'active')`,
    [memberId, id, params.creatorUserId, params.creatorEmail]
  )

  // Add domains if provided
  if (params.domains) {
    for (const domain of params.domains) {
      const domainId = crypto.randomUUID().replace(/-/g, '')
      await db.execute(
        `INSERT INTO workspace_domains (id, workspace_id, domain) VALUES (?, ?, ?)`,
        [domainId, id, domain.toLowerCase()]
      )
    }
  }

  return db.queryOne<Workspace>('SELECT * FROM workspaces WHERE id = ?', [id]) as Promise<Workspace>
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return db.queryOne<Workspace>('SELECT * FROM workspaces WHERE slug = ?', [slug])
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  return db.queryOne<Workspace>('SELECT * FROM workspaces WHERE id = ?', [id])
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'display_timezone'>>
): Promise<void> {
  const fields = Object.keys(updates).map((k) => `${k} = ?`)
  const values = Object.values(updates)
  if (fields.length === 0) return
  await db.execute(
    `UPDATE workspaces SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    [...values, workspaceId]
  )
}

// ─── Domains ──────────────────────────────────────────────────────────────────

export async function getWorkspaceDomains(workspaceId: string): Promise<WorkspaceDomain[]> {
  return db.query<WorkspaceDomain>(
    'SELECT * FROM workspace_domains WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId]
  )
}

export async function addWorkspaceDomain(workspaceId: string, domain: string): Promise<WorkspaceDomain> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    'INSERT INTO workspace_domains (id, workspace_id, domain) VALUES (?, ?, ?)',
    [id, workspaceId, domain.toLowerCase()]
  )
  return db.queryOne<WorkspaceDomain>('SELECT * FROM workspace_domains WHERE id = ?', [id]) as Promise<WorkspaceDomain>
}

export async function markDomainVerified(domainId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_domains SET verified_at = datetime('now') WHERE id = ?`,
    [domainId]
  )
}

/**
 * Find active users whose email matches a domain and are NOT already
 * active members of the given workspace. Used for auto-enrolment on domain verify.
 */
export async function getUsersMatchingDomainNotInWorkspace(
  workspaceId: string,
  domain: string
): Promise<{ id: string; email: string }[]> {
  return db.query<{ id: string; email: string }>(
    `SELECT u.id, u.email FROM users u
     WHERE u.email LIKE ? AND u.email_verified = 1
     AND u.id NOT IN (
       SELECT user_id FROM workspace_members
       WHERE workspace_id = ? AND user_id IS NOT NULL AND status = 'active'
     )`,
    [`%@${domain}`, workspaceId]
  )
}

export async function getVerifiedDomainsForEmail(email: string): Promise<string[]> {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return []

  const rows = await db.query<{ workspace_id: string }>(
    `SELECT workspace_id FROM workspace_domains
     WHERE domain = ? AND verified_at IS NOT NULL`,
    [domain]
  )
  return rows.map((r) => r.workspace_id)
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY added_at ASC',
    [workspaceId]
  )
}

export async function getActiveMemberIds(workspaceId: string): Promise<string[]> {
  const rows = await db.query<{ user_id: string }>(
    `SELECT user_id FROM workspace_members
     WHERE workspace_id = ? AND status = 'active' AND user_id IS NOT NULL`,
    [workspaceId]
  )
  return rows.map((r) => r.user_id)
}

export async function getWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [workspaceId, userId]
  )
}

export async function getWorkspaceMemberByEmail(
  workspaceId: string,
  email: string
): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE workspace_id = ? AND email = ?',
    [workspaceId, email]
  )
}

export async function addWorkspaceMember(params: {
  workspaceId: string
  userId?: string | null
  email: string
  role?: string
  status?: string
  consentToken?: string | null
  consentTokenExpiresAt?: string | null
}): Promise<WorkspaceMember> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_members
       (id, workspace_id, user_id, email, role, status, consent_token, consent_token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.workspaceId,
      params.userId ?? null,
      params.email,
      params.role ?? 'member',
      params.status ?? 'active',
      params.consentToken ?? null,
      params.consentTokenExpiresAt ?? null,
    ]
  )
  return db.queryOne<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE id = ?',
    [id]
  ) as Promise<WorkspaceMember>
}

export async function updateWorkspaceMember(
  memberId: string,
  workspaceId: string,
  updates: Partial<Pick<WorkspaceMember, 'role' | 'status' | 'user_id'>>
): Promise<void> {
  const fields = Object.keys(updates).map((k) => `${k} = ?`)
  const values = Object.values(updates)
  if (fields.length === 0) return
  await db.execute(
    `UPDATE workspace_members SET ${fields.join(', ')} WHERE id = ? AND workspace_id = ?`,
    [...values, memberId, workspaceId]
  )
}

export async function removeWorkspaceMember(memberId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?',
    [memberId, workspaceId]
  )
}

export async function linkMemberToUser(email: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET user_id = ?, status = 'active'
     WHERE email = ? AND status = 'pending_consent'`,
    [userId, email]
  )
}

export async function getAdminWorkspacesForUser(userId: string): Promise<Workspace[]> {
  return db.query<Workspace>(
    `SELECT w.* FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE wm.user_id = ? AND wm.role = 'admin' AND wm.status = 'active'
     ORDER BY w.created_at ASC`,
    [userId]
  )
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE user_id = ? AND status = 'active'`,
    [userId]
  )
}

export async function getWorkspacesByIds(ids: string[]): Promise<Workspace[]> {
  if (ids.length === 0) return []
  const placeholders = ids.map(() => '?').join(', ')
  return db.query<Workspace>(`SELECT * FROM workspaces WHERE id IN (${placeholders})`, ids)
}

export async function getMembershipsByEmail(email: string): Promise<WorkspaceMember[]> {
  return db.query<WorkspaceMember>(
    'SELECT * FROM workspace_members WHERE email = ? ORDER BY added_at DESC',
    [email.toLowerCase()]
  )
}

export async function leaveWorkspace(workspaceId: string, userId: string): Promise<boolean> {
  // Cannot leave if you are the sole admin
  const admins = await db.query<{ user_id: string }>(
    `SELECT user_id FROM workspace_members WHERE workspace_id = ? AND role = 'admin' AND status = 'active'`,
    [workspaceId]
  )
  if (admins.length === 1 && admins[0].user_id === userId) return false
  await db.execute(
    `UPDATE workspace_members SET status = 'revoked' WHERE workspace_id = ? AND user_id = ?`,
    [workspaceId, userId]
  )
  return true
}

export async function acceptConsent(memberId: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET status = 'active', user_id = ? WHERE id = ?`,
    [userId, memberId]
  )
}

export async function declineConsent(memberId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET status = 'declined' WHERE id = ?`,
    [memberId]
  )
}

// ─── Overrides ────────────────────────────────────────────────────────────────

export async function createAdminOverride(params: {
  workspaceId: string
  presenceEventId: string
  adminUserId: string
  note?: string | null
}): Promise<AdminOverride> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO admin_overrides (id, workspace_id, presence_event_id, admin_user_id, note)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.presenceEventId, params.adminUserId, params.note ?? null]
  )
  return db.queryOne<AdminOverride>(
    'SELECT * FROM admin_overrides WHERE id = ?',
    [id]
  ) as Promise<AdminOverride>
}

export async function getWorkspaceOverrides(workspaceId: string): Promise<AdminOverride[]> {
  return db.query<AdminOverride>(
    'SELECT * FROM admin_overrides WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspaceId]
  )
}

export interface MemberWithUser {
  member_id: string
  workspace_id: string
  user_id: string
  email: string
  role: string
  full_name: string | null
}

export async function getActiveMembersWithDetails(workspaceId: string): Promise<MemberWithUser[]> {
  return db.query<MemberWithUser>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, u.full_name
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? AND wm.status = 'active' AND wm.user_id IS NOT NULL
     ORDER BY u.full_name ASC, wm.email ASC`,
    [workspaceId]
  )
}

export async function getOverrideEventIds(workspaceId: string): Promise<Set<string>> {
  const rows = await db.query<{ presence_event_id: string }>(
    'SELECT presence_event_id FROM admin_overrides WHERE workspace_id = ?',
    [workspaceId]
  )
  return new Set(rows.map((r) => r.presence_event_id))
}

// ─── New query functions (Part C) ─────────────────────────────────────────────

export async function getMemberByConsentToken(token: string): Promise<WorkspaceMember | null> {
  return db.queryOne<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE consent_token = ?`,
    [token]
  )
}

export async function upsertInvitedMember(params: {
  workspaceId: string
  email: string
  consentToken: string
  consentTokenExpiresAt: string
}): Promise<WorkspaceMember> {
  const existing = await db.queryOne<WorkspaceMember>(
    `SELECT * FROM workspace_members WHERE workspace_id = ? AND email = ?`,
    [params.workspaceId, params.email.toLowerCase()]
  )

  if (existing && existing.status !== 'active') {
    await db.execute(
      `UPDATE workspace_members
       SET consent_token = ?, consent_token_expires_at = ?
       WHERE id = ?`,
      [params.consentToken, params.consentTokenExpiresAt, existing.id]
    )
    return db.queryOne<WorkspaceMember>(
      'SELECT * FROM workspace_members WHERE id = ?',
      [existing.id]
    ) as Promise<WorkspaceMember>
  }

  if (!existing) {
    const id = crypto.randomUUID().replace(/-/g, '')
    await db.execute(
      `INSERT INTO workspace_members
         (id, workspace_id, user_id, email, role, status, consent_token, consent_token_expires_at)
       VALUES (?, ?, NULL, ?, 'member', 'pending_consent', ?, ?)`,
      [id, params.workspaceId, params.email.toLowerCase(), params.consentToken, params.consentTokenExpiresAt]
    )
    return db.queryOne<WorkspaceMember>(
      'SELECT * FROM workspace_members WHERE id = ?',
      [id]
    ) as Promise<WorkspaceMember>
  }

  return existing
}

export interface MemberWithUserFull {
  member_id: string
  workspace_id: string
  user_id: string | null
  email: string
  role: string
  status: string
  full_name: string | null
  added_at: string
}

export async function getAllMembersWithDetails(workspaceId: string): Promise<MemberWithUserFull[]> {
  return db.query<MemberWithUserFull>(
    `SELECT wm.id as member_id, wm.workspace_id, wm.user_id, wm.email, wm.role, wm.status, wm.added_at, u.full_name
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ?
     ORDER BY wm.added_at DESC`,
    [workspaceId]
  )
}

/**
 * Returns true if the domain has been verified by any workspace other than excludeWorkspaceId.
 * Prevents the same domain being claimed by two organisations.
 */
export async function isDomainVerifiedElsewhere(domain: string, excludeWorkspaceId: string): Promise<boolean> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_domains
     WHERE domain = ? AND verified_at IS NOT NULL AND workspace_id != ?`,
    [domain.toLowerCase(), excludeWorkspaceId]
  )
  return (row?.count ?? 0) > 0
}

export async function removeWorkspaceDomain(domainId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_domains WHERE id = ? AND workspace_id = ?',
    [domainId, workspaceId]
  )
}

export async function linkUserToMemberRecord(email: string, userId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_members SET user_id = ?
     WHERE email = ? AND status = 'pending_consent' AND user_id IS NULL`,
    [userId, email.toLowerCase()]
  )
}

// ─── Signal config ─────────────────────────────────────────────────────────────

export interface WorkspaceSignalConfig {
  id: string
  workspace_id: string
  signal_type: string
  location_name: string | null
  wifi_ssid_hash: string | null
  wifi_ssid_display: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number | null
  ip_geo_lat: number | null
  ip_geo_lng: number | null
  ip_proximity_m: number | null
  is_active: number
  created_at: string
}

export async function getSignalConfigs(workspaceId: string): Promise<WorkspaceSignalConfig[]> {
  return db.query<WorkspaceSignalConfig>(
    'SELECT * FROM workspace_signal_config WHERE workspace_id = ? AND is_active = 1 ORDER BY created_at ASC',
    [workspaceId]
  )
}

export async function addSignalConfig(params: {
  workspaceId: string
  signalType: string
  locationName?: string
  wifiSsidHash?: string
  wifiSsidDisplay?: string
  gpsLat?: number
  gpsLng?: number
  gpsRadiusM?: number
  ipGeoLat?: number
  ipGeoLng?: number
  ipProximityM?: number
}): Promise<WorkspaceSignalConfig> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_signal_config
       (id, workspace_id, signal_type, location_name, wifi_ssid_hash, wifi_ssid_display,
        gps_lat, gps_lng, gps_radius_m, ip_geo_lat, ip_geo_lng, ip_proximity_m)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.workspaceId,
      params.signalType,
      params.locationName ?? null,
      params.wifiSsidHash ?? null,
      params.wifiSsidDisplay ?? null,
      params.gpsLat ?? null,
      params.gpsLng ?? null,
      params.gpsRadiusM ?? 300,
      params.ipGeoLat ?? null,
      params.ipGeoLng ?? null,
      params.ipProximityM ?? 500,
    ]
  )
  return db.queryOne<WorkspaceSignalConfig>(
    'SELECT * FROM workspace_signal_config WHERE id = ?',
    [id]
  ) as Promise<WorkspaceSignalConfig>
}

export async function deleteSignalConfig(signalId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'DELETE FROM workspace_signal_config WHERE id = ? AND workspace_id = ?',
    [signalId, workspaceId]
  )
}
