import { Chip, type ChipTone } from '@/components/ui'
import { resolvePresenceTag, PRESENCE_TAG_CONFIG, type PresenceTag } from '@/lib/client/presence'
import { wsAdmin } from '@/locales/en/ws-overview'

/**
 * Presence tag -> chip tone. `not_in` uses the neutral `leave` tone rather than
 * `none`: not having checked in yet is not a failed verification.
 */
const TONE_FOR_TAG: Record<PresenceTag, ChipTone> = {
  in_office: 'verified',
  remote: 'partial',
  not_in: 'leave',
}

export interface PresenceChipInput {
  presence_status: 'present' | 'visited' | 'notIn'
  latest_event: {
    matched_by: string
    event_type: string
    trust_flags: string[]
  } | null
}

/**
 * The one place a member's presence turns into a chip, so the Overview's
 * "recent activity" list and the Attendance roster can never label the same
 * person differently.
 *
 * Precedence mirrors the domain rules: an admin override wins over signal
 * matching (CLAUDE.md invariant 7), and a trust flag is surfaced above
 * everything because it is the reason an admin is looking at the row at all.
 */
export default function PresenceChip({ member }: { member: PresenceChipInput }) {
  const event = member.latest_event

  if (event && event.trust_flags.length > 0) {
    return <Chip tone="none">{wsAdmin.attendance.statusSuspicious}</Chip>
  }
  if (event?.matched_by === 'override') {
    return <Chip tone="override">{wsAdmin.attendance.statusOverride}</Chip>
  }

  const tag = resolvePresenceTag(member.presence_status, event?.matched_by, event?.event_type)
  return <Chip tone={TONE_FOR_TAG[tag]}>{PRESENCE_TAG_CONFIG[tag].label}</Chip>
}
