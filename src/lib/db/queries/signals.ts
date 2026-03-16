import { db } from '../index'

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

export async function getWorkspaceSignals(workspaceId: string): Promise<WorkspaceSignalConfig[]> {
  return db.query<WorkspaceSignalConfig>(
    `SELECT * FROM workspace_signal_config
     WHERE workspace_id = ? AND is_active = 1
     ORDER BY created_at ASC`,
    [workspaceId]
  )
}

export async function createSignal(params: {
  workspaceId: string
  signalType: 'wifi' | 'gps' | 'ip'
  locationName?: string | null
  wifiSsidHash?: string | null
  wifiSsidDisplay?: string | null
  gpsLat?: number | null
  gpsLng?: number | null
  gpsRadiusM?: number | null
  ipGeoLat?: number | null
  ipGeoLng?: number | null
  ipProximityM?: number | null
}): Promise<WorkspaceSignalConfig> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_signal_config
       (id, workspace_id, signal_type, location_name,
        wifi_ssid_hash, wifi_ssid_display,
        gps_lat, gps_lng, gps_radius_m,
        ip_geo_lat, ip_geo_lng, ip_proximity_m)
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

export async function deactivateSignal(signalId: string, workspaceId: string): Promise<void> {
  await db.execute(
    'UPDATE workspace_signal_config SET is_active = 0 WHERE id = ? AND workspace_id = ?',
    [signalId, workspaceId]
  )
}

export async function countActiveSignalLocations(workspaceId: string): Promise<number> {
  const result = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM workspace_signal_config
     WHERE workspace_id = ? AND is_active = 1`,
    [workspaceId]
  )
  return result?.count ?? 0
}
