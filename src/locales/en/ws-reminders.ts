/**
 * Copy for the scheduled check-in / check-out reminders.
 *
 * One audience, not two. There used to be a `wsReminders.settings` group here
 * for the Org-details fields an admin filled in, and it is gone with the screen:
 * the reminder schedule is the MEMBER's now, one pair of times per member per
 * workspace in `member_reminder_prefs`, and its copy lives with the rest of the
 * member settings strings. What survives here is what the member actually
 * receives, plus the one validation string the vestigial workspace columns still
 * need - `PATCH /api/ws/[slug]` continues to accept and store
 * `checkinReminderAt` / `checkoutReminderAt` as a pre-filled suggestion, so its
 * 'HH:MM' refusal still has to be spelled somewhere.
 *
 * Kept out of `src/locales/en.ts` deliberately: that file is shared by every
 * screen, and this feature should be editable without touching it.
 *
 *   import { wsReminders } from '@/locales/en/ws-reminders'
 */
export const wsReminders = {
  // ── What the member receives (push only - there is no in-app row) ──────────
  //
  // Both bodies name the member's OWN configured time, not a company schedule.
  // The earlier wording - "Your {ws} day starts at {time}" - was true when an
  // admin set one time for everybody, and became a lie the moment the schedule
  // moved: it would tell a member the organisation's working day begins at
  // whatever hour they personally picked for a nudge. These say whose time it
  // is. The workspace name stays because a push arrives with no surrounding
  // screen to supply it, and a member of two workspaces may get two.
  push: {
    checkinTitle: 'Time to check in',
    checkinBody: (workspaceName: string, time: string) =>
      `Your ${time} check-in reminder for ${workspaceName}. You have not checked in yet - open Venzio to record your presence.`,
    checkinTag: 'checkin-reminder',

    checkoutTitle: 'Time to check out',
    checkoutBody: (workspaceName: string, time: string) =>
      `Your ${time} check-out reminder for ${workspaceName}. You are still checked in - check out to close today's record.`,
    checkoutTag: 'checkout-reminder',
  },

  // ── API validation ─────────────────────────────────────────────────────────
  // Shared by the admin route that still writes the vestigial workspace columns
  // and by the member route that writes the real schedule, because both accept
  // the same 'HH:MM'-or-null shape and a member should not be told something
  // different about the same format.
  api: {
    invalidReminderTime: (field: string) =>
      `${field} must be a 24-hour time as "HH:MM", or null to turn the reminder off`,
    /** A body that is not JSON at all, refused before any field is looked at. */
    invalidBody: 'Send a JSON object with checkinAt and/or checkoutAt.',
  },
} as const
