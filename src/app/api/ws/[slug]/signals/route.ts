import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getSignalConfigs, addSignalConfig, updateWorkspace } from '@/lib/db/queries/workspaces'
import { timezoneFromCoords } from '@/lib/timezone-server'
import { getIpGeo, extractIp } from '@/lib/geo'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const signals = await getSignalConfigs(ctx.workspace.id)
  return NextResponse.json({ signals })
}

export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: {
    signal_type?: string
    location_name?: string
    gps_lat?: number
    gps_lng?: number
    gps_radius_m?: number
    wifi_ssid?: string
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const signalType = body.signal_type
  if (!signalType || !['gps', 'ip'].includes(signalType)) {
    return NextResponse.json({ error: 'signal_type must be gps or ip', code: 'INVALID_SIGNAL_TYPE' }, { status: 400 })
  }

  let signalParams: Parameters<typeof addSignalConfig>[0] = {
    workspaceId: ctx.workspace.id,
    signalType,
    locationName: body.location_name,
  }

  if (signalType === 'gps') {
    if (!body.gps_lat || !body.gps_lng) {
      return NextResponse.json({ error: 'gps_lat and gps_lng required for GPS signal', code: 'MISSING_GPS' }, { status: 400 })
    }
    signalParams = {
      ...signalParams,
      gpsLat: body.gps_lat,
      gpsLng: body.gps_lng,
      gpsRadiusM: body.gps_radius_m ?? 300,
    }

    // Auto-detect timezone from GPS coordinates
    const detectedTz = timezoneFromCoords(body.gps_lat, body.gps_lng)
    if (detectedTz && detectedTz !== 'UTC') {
      await updateWorkspace(ctx.workspace.id, { display_timezone: detectedTz })
    }
  }

  if (signalType === 'ip') {
    const ip = extractIp(request)
    const geo = await getIpGeo(ip)
    if (!geo) {
      return NextResponse.json({ error: 'Could not determine IP location (localhost or private IP)', code: 'IP_UNRESOLVABLE' }, { status: 400 })
    }
    signalParams = { ...signalParams, ipGeoLat: geo.lat, ipGeoLng: geo.lng }
  }

  const signal = await addSignalConfig(signalParams)

  return NextResponse.json({ signal })
}
