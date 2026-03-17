/**
 * Server-only: reverse geocodes GPS coordinates to a human-readable location label.
 * Called once at check-in time and stored in presence_events.location_label.
 * Never called from client components — avoids 429s from repeated browser-side requests.
 */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CheckMark/1.0 (presence-platform)',
          'Accept-Language': 'en',
        },
        cache: 'no-store',
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.address) return null

    const a = data.address

    // Tier 1 — named place (university, park, mall, hospital, etc.)
    const place = a.amenity ?? a.leisure ?? a.tourism ?? a.shop ?? a.office ?? a.building ?? null

    // Tier 2 — street-level
    const street = a.road ?? a.pedestrian ?? a.footway ?? null
    const houseNum = a.house_number ?? null

    // Tier 3 — area / locality
    const locality = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village ?? a.town ?? a.city_district ?? null

    // Tier 4 — city
    const city = a.city ?? a.county ?? a.state_district ?? a.state ?? null

    let primary: string
    let secondary: string | null = city

    if (place) {
      primary = place
      secondary = locality ? `${locality}, ${city ?? ''}`.trim().replace(/,$/, '') : city
    } else if (street) {
      primary = houseNum ? `${houseNum} ${street}` : street
      secondary = locality ? `${locality}, ${city ?? ''}`.trim().replace(/,$/, '') : city
    } else if (locality) {
      primary = locality
      secondary = city
    } else {
      const fallback = data.display_name?.split(',').slice(0, 2).map((s: string) => s.trim()).join(', ')
      return fallback ?? null
    }

    const parts = [primary, secondary].filter(Boolean)
    return parts.join(', ') || null
  } catch {
    return null
  }
}
