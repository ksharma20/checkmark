export interface IpGeoResult {
  lat: number
  lng: number
  city: string
}

const PRIVATE_IP_PATTERNS = [
  '127.',
  '::1',
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '::ffff:127.',
]

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((prefix) => ip.startsWith(prefix))
}

export async function getIpGeo(ip: string): Promise<IpGeoResult | null> {
  if (!ip || isPrivateIp(ip)) return null

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,status`, {
      // No caching — always fresh
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      status: string
      lat: number
      lon: number
      city: string
    }

    if (data.status !== 'success') return null

    return { lat: data.lat, lng: data.lon, city: data.city }
  } catch {
    return null
  }
}

export function haversineMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function extractIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first (client IP)
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}
