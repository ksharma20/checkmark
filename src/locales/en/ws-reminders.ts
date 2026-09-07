/**
 * Copy for the scheduled check-in / check-out reminders.
 *
 * Two audiences in one file, because they describe one feature:
 *   `wsReminders.settings`  - the Org details fields an admin configures.
 *   `wsReminders.push`      - what the member actually receives.
 *
 * Kept out of `src/locales/en.ts` deliberately: that file is shared by every
 * screen, and this feature should be editable without touching it.
 *
 *   import { wsReminders } from '@/locales/en/ws-reminders'
 */
export const wsReminders = {
  // ── /ws/[slug]/settings → Org details ──────────────────────────────────────
  settings: {
    sectionTitle: 'Daily reminders',
    sectionHint:
      'Push a reminder to members at a fixed time each working day. Times are wall-clock in the workspace timezone above, and are skipped on non-working days, holidays and approved leave.',

    checkinLabel: 'Check-in reminder',
    checkinHint: 'Sent to members who have not checked in yet. Leave empty to send no check-in reminder.',
    checkoutLabel: 'Check-out reminder',
    checkoutHint: 'Sent to members who are still checked in. Leave empty to send no check-out reminder.',

    fieldIds: {
      checkin: 'org-checkin-reminder',
      checkout: 'org-checkout-reminder',
    },

    /** Shown under each field so "empty = off" is stated, not inferred. */
    offBadge: 'Off',
    onBadge: (time: string) => `On · ${time}`,
    clearButton: 'Turn off',
    clearAria: (which: string) => `Turn off the ${which}`,

    approximateNote:
      'Reminders are sent by a scheduled job that runs every 30 minutes, so delivery can be a few minutes later than the time you set.',

    invalidTime: 'Enter a time as HH:MM, or leave the field empty to turn the reminder off.',
  },

  // ── What the member receives (push + in-app feed) ──────────────────────────
  push: {
    checkinTitle: 'Time to check in',
    checkinBody: (workspaceName: string, time: string) =>
      `Your ${workspaceName} day starts at ${time} and you have not checked in yet. Open CheckMark to record your presence.`,
    checkinTag: 'checkin-reminder',

    checkoutTitle: 'Time to check out',
    checkoutBody: (workspaceName: string, time: string) =>
      `Your ${workspaceName} day ends at ${time} and you are still checked in. Check out to close today's record.`,
    checkoutTag: 'checkout-reminder',
  },

  // ── API validation ─────────────────────────────────────────────────────────
  api: {
    invalidReminderTime: (field: string) =>
      `${field} must be a 24-hour time as "HH:MM", or null to turn the reminder off`,
  },
} as const
