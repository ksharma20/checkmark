import { find } from 'geo-tz'

/**
 * Returns the IANA timezone string for given GPS coordinates.
 * Server-only - geo-tz uses Node.js fs and cannot be bundled for the browser.
 * e.g. timezoneFromCoords(28.6139, 77.2090) → 'Asia/Kolkata'
 */
export function timezoneFromCoords(lat: number, lng: number): string {
  const zones = find(lat, lng)
  return zones[0] || 'UTC'
}
