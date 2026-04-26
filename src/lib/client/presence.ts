export type PresenceTag = 'in_office' | 'remote' | 'not_in'

/**
 * Single source of truth for user presence tag.
 * - not checked in today        → 'not_in'
 * - event_type = remote_checkin → 'remote'
 * - any other event_type        → 'in_office'
 * Falls back to matched_by when event_type is unavailable (legacy data).
 */
export function resolvePresenceTag(
  presenceStatus: 'present' | 'visited' | 'notIn',
  matchedBy: string | null | undefined,
  eventType?: string | null
): PresenceTag {
  if (presenceStatus === 'notIn') return 'not_in'
  // Location verified by a signal → always office
  if (matchedBy === 'wifi' || matchedBy === 'gps' || matchedBy === 'ip' || matchedBy === 'override') return 'in_office'
  // Signals configured but location didn't match → remote regardless of what user clicked
  if (matchedBy === 'unverified') return 'remote'
  // Config-light (matched_by='none'): trust event_type
  if (eventType != null) return eventType === 'remote_checkin' ? 'remote' : 'in_office'
  // Legacy fallback
  return 'remote'
}

export const PRESENCE_TAG_CONFIG: Record<PresenceTag, { label: string; color: string }> = {
  in_office: { label: 'In office', color: 'var(--teal)' },
  remote:    { label: 'Remote',    color: 'var(--amber)' },
  not_in:    { label: 'Not in',    color: 'var(--text-muted)' },
}
