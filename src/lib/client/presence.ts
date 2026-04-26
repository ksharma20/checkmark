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
  // All configured signals matched → in office
  if (matchedBy === 'verified' || matchedBy === 'override') return 'in_office'
  // Signals configured but not all matched → remote
  if (matchedBy === 'partial') return 'remote'
  // No signal matched (matched_by='none') → remote regardless of event_type
  return 'remote'
}

export const PRESENCE_TAG_CONFIG: Record<PresenceTag, { label: string; color: string }> = {
  in_office: { label: 'In office', color: 'var(--teal)' },
  remote:    { label: 'Remote',    color: 'var(--amber)' },
  not_in:    { label: 'Not in',    color: 'var(--text-muted)' },
}
