/**
 * Copy for the secondary `/me` screens: Timeline (and the event row it renders),
 * Workspaces, Notifications and Settings.
 *
 * A separate module from `src/locales/en.ts` for the same reason as `./me`,
 * `./marketing` and `./documents`: that file is the long-lived product string
 * table and these screens churn together. Import it directly:
 *
 *   import { meSettings } from '@/locales/en/me-settings'
 *
 * Strings that already exist in `en.meTimeline`, `en.meOrgs`,
 * `en.meWsRegularization`, `en.notifications` and `en.auth` are NOT duplicated
 * here - those screens import both modules.
 */
import type { MemberPresencePrefs } from '@/lib/presence-ladder'
import { formatHours } from './notifications'

export const meSettings = {
  // ── /me/timeline ──────────────────────────────────────────────────────────
  timeline: {
    title: 'Timeline',
    rangeFrom: 'From',
    rangeTo: 'To',
    /** "12 check-ins · 8 days" - the line under the range pickers. */
    summary: (checkins: number, days: number) =>
      `${checkins} check-in${checkins === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`,
    /**
     * Shown ONLY in the no-workspace fallback, where the rows come from the
     * unscoped `/api/events` and carry no `matched_by`.
     *
     * The verification chip is missing from every row on that reading, and an
     * unexplained absence reads as a bug. It says what is true - there is
     * nothing to verify against until a workspace has configured signals - in
     * one line, rather than leaving the reader to work it out.
     */
    personalOnlyNote:
      'This is your own record. Verification starts once you join a workspace - there is nothing to check these against yet.',
  },

  // ── the row rendered per presence event ───────────────────────────────────
  event: {
    notePlaceholder: 'Add a note…',
    noteEmpty: 'Add a note…',
    noteSave: 'Save',
    noteSaving: 'Saving…',
    noteCancel: 'Cancel',
    noteEditLabel: 'Edit note',
    detailsShow: 'Details',
    detailsHide: 'Hide details',
    checkinLabel: 'Check-in',
    checkoutLabel: 'Checkout',
    remote: 'Remote',
    locationUnknown: 'Location not captured',
    mapLinkLabel: 'Open this location on a map',
    /** Checkout happened inside the configured radius. */
    distanceInside: (metres: number) => `${metres}m from office`,
    /** Checkout happened outside it - the `checkout_outside_radius` trust flag. */
    distanceOutside: (metres: number) => `${metres}m from office · outside radius`,
  },

  // ── /me/orgs ──────────────────────────────────────────────────────────────
  orgs: {
    title: 'Workspaces',
    /** "4 in office · 2 visited · 9 not in" */
    countsInOffice: (n: number) => `${n} in office`,
    countsVisited: (n: number) => `${n} visited`,
    countsNotIn: (n: number) => `${n} not in`,

    /**
     * Leaving a workspace. The body keeps `en.meOrgs.leaveConfirm`, which names
     * the workspace - one of the documented places on `/me` where the name is
     * the information rather than decoration, because the reader is choosing
     * between workspaces rather than working inside one.
     */
    leaveTitle: 'Leave workspace',
    leaveConfirmAction: 'Leave',
    leaveBusy: 'Leaving…',
    leaveCancel: 'Cancel',

    /**
     * An invitation whose seven days have run out.
     *
     * It is shown rather than hidden, and Decline is still offered: the row is
     * still on this person's list, and refusing something you no longer want
     * must never fail. Only Accept goes, because only Accept would be refused -
     * and the copy carries the remedy, since it is the admin's to apply and not
     * the member's.
     */
    invitePendingExpiredBadge: 'Expired',
    invitePendingExpiredBody:
      'This invitation has expired. Ask an admin of this workspace to send you a new one.',
    /** The 410 INVITE_EXPIRED answer, for an invite that expired since the page loaded. */
    inviteExpiredError:
      'That invitation expired before you accepted it. Ask an admin to send you a new one.',
    inviteActionFailed: 'Could not answer that invitation. Please try again.',
  },

  // ── /me/settings ──────────────────────────────────────────────────────────
  settings: {
    title: 'Settings',
    saving: 'Please wait…',

    profile: {
      title: 'Profile',
      emailLabel: 'Email',
      nameLabel: 'Full name',
      nameEmpty: '—',
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      saved: 'Saved',
      saveError: 'Failed to save',
    },

    email: {
      title: 'Change email',
      newLabel: 'New email address',
      newPlaceholder: 'new@example.com',
      sendCode: 'Send verification code',
      codeLabel: 'Verification code',
      codePlaceholder: '6-digit code',
      confirm: 'Confirm change',
      resend: 'Resend',
      codeSent: (email: string) => `Verification code sent to ${email}`,
      sendError: 'Failed to send code',
      updated: 'Email updated. Please log in again.',
      verifyError: 'Verification failed',
    },

    password: {
      title: 'Password',
      masked: '••••••••',
      edit: 'Edit',
      currentLabel: 'Current password',
      newLabel: 'New password',
      confirmLabel: 'Confirm new password',
      save: 'Save',
      cancel: 'Cancel',
      tooShort: 'Password must be at least 8 characters',
      mismatch: 'Passwords do not match',
      updated: 'Password updated',
      saveError: 'Failed',
    },

    tokens: {
      title: 'API tokens',
      intro: 'Use tokens to record check-ins from scripts or third-party tools.',
      revealWarning: "Copy this token now - it won't be shown again.",
      nameLabel: 'Token name',
      namePlaceholder: 'e.g. Home Mac',
      create: 'Create',
      empty: 'No tokens yet.',
      createError: 'Failed',
      created: (date: string) => `Created ${date}`,
      lastUsed: (date: string) => `Last used ${date}`,
      revoke: 'Revoke',
      revokeConfirm: 'Revoke this token? Any apps using it will stop working.',
      revokeTitle: 'Revoke token',
      revokeConfirmAction: 'Revoke',
      revokeBusy: 'Revoking…',
      revokeCancel: 'Cancel',
      revokeError: 'Could not revoke this token.',
    },

    notifications: {
      title: 'Notifications',

      /** Nothing to scope to: no active membership. */
      noWorkspace: 'You are not in a workspace yet, so there is nothing here to set.',

      /**
       * Withheld rather than painted from defaults, the same rule the admin
       * switchboard follows and for a sharper reason here: every control on
       * this screen defaults to "off" or "unset", so rendering the form after a
       * failed load and letting one Save through would clear reminder times and
       * ladder rungs the member had already configured and could not see.
       */
      loadFailed: 'Your notification settings could not be loaded. Nothing has been changed.',
      loadFailedRetry: 'Try again',
      // No shared `saveError` here any more. It served the category toggles this
      // screen no longer renders; each block below now owns its own failure
      // string, because "your reminder times could not be saved" and "your
      // session nudges could not be saved" are different facts and a member
      // seeing one status line needs to know which half it is about.

      // ── Reminder times · per workspace ───────────────────────────────────
      /**
       * The daily check-in / check-out nudge, which used to be one time set by
       * an admin for the whole workspace and is now a time each member sets for
       * themselves, per workspace. The workspace is NOT named anywhere in this
       * copy - the top-bar pill above already answers "which one", and repeating
       * it inside content already scoped to it is noise.
       *
       * Three things this block has to state, because each one is a support
       * question otherwise: that nothing is sent until a time is picked (every
       * field opens empty, which without a word reads as broken rather than as
       * off); that these are push-only, so an empty notifications list is not
       * evidence they failed; and that they are already suppressed on days off,
       * because a member who fears being nagged through their holiday will
       * simply never set one.
       */
      reminderTimes: {
        title: 'Reminder times',
        hint: 'Two nudges you set for yourself: one if you have not checked in yet, one if you are still checked in at the end of the day. Both are off until you pick a time. They only ever buzz your phone — they are not added to your notifications list. And they already follow this workspace’s working days, its holiday calendar and your approved leave, so they will not reach you on a day off.',

        checkinLabel: 'Remind me to check in',
        checkinHint: 'Sent only if you have not checked in by this time. Saves when you leave the field; empty it, or use Turn off, to send nothing.',
        checkoutLabel: 'Remind me to check out',
        checkoutHint: 'Sent only if you are still checked in at this time. Saves when you leave the field; empty it, or use Turn off, to send nothing.',

        fieldIds: {
          checkin: 'me-checkin-reminder',
          checkout: 'me-checkout-reminder',
        },

        /** Stated, not inferred from an empty box - see the block comment. */
        offBadge: 'Off',
        onBadge: (time: string) => `On · ${time}`,
        clearButton: 'Turn off',
        clearAria: (which: string) => `Turn off the ${which}`,

        /**
         * The timezone is the workspace's, not the phone's, and that difference
         * is invisible until somebody travels and gets reminded at 04:00. Said
         * up front rather than discovered.
         */
        timezoneNote: (timezone: string) =>
          `Times are wall-clock in this workspace’s timezone, ${timezone} — not your phone’s.`,

        /**
         * Offered when the workspace still carries the old admin-configured
         * time, so a member is not made to invent one from nothing.
         *
         * Phrased as a SUGGESTION and in the past tense on purpose. It is not
         * this member's setting and nothing is sent on its account; presenting
         * it as a current value would tell somebody they are already covered
         * when they are not.
         */
        suggestion: (time: string) =>
          `This workspace used to remind everyone at ${time}. Use that, or pick your own.`,
        suggestionApply: 'Use this time',

        /**
         * Both halves matter. The first sets the expectation that delivery
         * drifts; the second is the part people find surprising, so it is said
         * plainly rather than left as a mystery missing notification.
         */
        approximateNote: 'Delivery is approximate — the job that sends these runs on a schedule, so a reminder can arrive a few minutes late. One that would be more than 30 minutes late is dropped rather than sent: a check-in reminder arriving at lunchtime is a nag, not a reminder.',

        invalidTime: 'Enter a time as HH:MM, or leave the field empty to turn the reminder off.',

        /**
         * Shown while the box holds something the server has not been told yet.
         *
         * This exists because the badge above it deliberately reports the SAVED
         * time rather than the typed one - so a member half way through
         * retyping 09:00 as 10:00 still sees "On · 09:00", which is the truth
         * about what will be delivered but would otherwise look like the field
         * ignoring them. The line names the gap and says exactly what closes it.
         */
        pendingHint: 'Not saved yet — this saves when you leave the field.',

        /**
         * No `save` label: unlike the session ladder below, this block commits
         * each field ON BLUR. The two times are independent, so there is
         * nothing to hold back and confirm together - whereas the ladder's four
         * numbers validate against each other and need one atomic submit.
         *
         * Blur rather than change, and rather than a debounce: an
         * `<input type="time">` emits a complete value per segment keystroke and
         * is transiently EMPTY whenever somebody clears it to retype, and empty
         * is the one value that means "turn this reminder off". A timer can only
         * shrink the window in which a half-finished edit is mistaken for a
         * deliberate silence; leaving the field is the member saying they are
         * done with it.
         */
        saving: 'Saving…',
        saved: 'Reminder times saved',
        /**
         * Separate from `saved`, because turning a reminder off is the one
         * outcome on this screen that costs the member something later and the
         * only visible difference is an empty box. It is said rather than left
         * to be noticed.
         */
        savedOff: 'Reminder turned off — nothing will be sent for it.',
        saveError: 'Your reminder times could not be saved.',
      },

      // ── Session ladder · account level ───────────────────────────────────
      /**
       * The four numbers in `member_presence_prefs`, edited as one block because
       * they are one schedule: three of them are rungs on the same ladder and
       * the fourth is where that ladder ends.
       *
       * Account-level, and the hint says why rather than just asserting it. A
       * member of two workspaces will look for this under each of them
       * otherwise, and conclude it is missing from one.
       *
       * The push-only sentence is load-bearing here in a way it is not for the
       * reminder times: `notifyPresence()` writes NO feed row at all, so a
       * member who has these on and their phone locked has no record anywhere
       * that anything was sent. Without the sentence that reads as a bug.
       */
      sessionLadder: {
        title: 'Check-in session nudges',
        hint: 'These are about your own open check-in session — how far into it you are, and when it closes. Each one is off until you give it an hour count. They only buzz your phone and never appear in your notifications list, so there is nothing to come back and read. They follow your account rather than any one workspace, because a check-in session belongs to none.',

        halfDayLabel: 'Half-day nudge after',
        halfDayHint: 'Hours since you checked in. A quiet marker with nothing to do about it. Empty means it is never sent.',

        fullDayLabel: 'Full-day nudge after',
        fullDayHint: 'Hours since you checked in. This is the one that offers to extend your session, so set it near the end of a normal day for you. Empty means it is never sent.',

        repeatLabel: 'Then repeat every',
        repeatHint: 'Hours between overtime nudges once you are past the full-day mark. They stop when your session closes. Empty means it is sent once and no more.',
        /** Shown against the field itself, before a save is ever attempted. */
        repeatNeedsFullDay: 'Set a full-day nudge first — a repeat has nothing to count from without one.',

        autoCheckoutLabel: 'Close my session after',
        /**
         * The one field with no off state, and the hint has to earn that rather
         * than assert it: an open `presence_events` row is what the day's
         * attendance is computed from, so a session that never closes leaves
         * that day wrong - for the member and for every workspace they are in -
         * until somebody notices by hand.
         */
        autoCheckoutHint: 'Hours since you checked in. This one cannot be turned off. An open session is what your attendance for the day is measured from, so a session that never closes leaves that day wrong until someone fixes it by hand. You can move it, within limits.',

        fieldIds: {
          halfDay: 'me-ladder-half-day',
          fullDay: 'me-ladder-full-day',
          repeat: 'me-ladder-repeat',
          autoCheckout: 'me-ladder-auto-checkout',
        },

        unitSuffix: 'hours',
        /** The empty state of a rung input - "off", not "0". */
        offPlaceholder: 'Off',
        clearButton: 'Turn off',
        clearAria: (which: string) => `Turn off the ${which}`,

        /**
         * The whole schedule on one line, so the member can check what they
         * built without re-reading four fields.
         *
         * Auto-checkout is always in it, because it is the only part that is
         * always true. When no rung is set the line leads with that fact rather
         * than showing a lone close time, which would read as a ladder with one
         * mysterious step.
         *
         * A repeat with no full-day mark is omitted rather than rendered: it is
         * exactly what `resolveLadder()` does with it, and a summary that
         * promised a repeat the ladder never generates is worse than a short
         * summary.
         */
        summary: (prefs: MemberPresencePrefs) => {
          const parts: string[] = []
          if (prefs.halfDayAfterH !== null)
            parts.push(`half day ${formatHours(prefs.halfDayAfterH)}h`)
          if (prefs.fullDayAfterH !== null)
            parts.push(`full day ${formatHours(prefs.fullDayAfterH)}h`)
          if (prefs.repeatEveryH !== null && prefs.fullDayAfterH !== null)
            parts.push(`then every ${formatHours(prefs.repeatEveryH)}h`)
          if (parts.length === 0) parts.push('no nudges')
          parts.push(`closes at ${formatHours(prefs.autoCheckoutAfterH)}h`)
          return parts.join(' · ')
        },

        /**
         * Save-time refusals. Each names the rule AND the reason, because every
         * one of these rejects a configuration the member deliberately typed -
         * "invalid" on its own reads as the form being fussy.
         *
         * The bounds are arguments rather than literals: they come from
         * `MIN_RUNG_H` / `MAX_RUNG_H` / `MIN_REPEAT_H` / `MIN_AUTO_CHECKOUT_H` /
         * `MAX_AUTO_CHECKOUT_H` in `src/lib/presence-ladder.ts`, which the API
         * route validates against too. Restating a number here is how the form
         * ends up promising a range the route refuses.
         */
        errorAscending: 'Your full-day nudge has to come after your half-day one — otherwise they arrive out of order, or together.',
        errorRepeatNeedsFullDay: 'A repeat needs a full-day nudge to count from. Set one, or clear the repeat.',
        errorAfterClose: 'That is after your session closes, so it would never arrive. Move it earlier, or close your session later.',
        /**
         * The repeat's own version of `errorAfterClose`, and it needs its own
         * words because the number the member typed is not the number that
         * lands too late: an interval of 50 against a full-day mark of 8 puts
         * the FIRST overtime nudge at 58 hours. Telling them "that is after your
         * session closes" about a field holding "50" reads as the form
         * misunderstanding them, so the message names the nudge rather than the
         * interval, and offers both ways out.
         */
        errorRepeatAfterClose: 'Your first overtime nudge would land after your session closes, so no repeat would ever be sent. Use a shorter repeat, move your full-day nudge earlier, or close your session later.',
        errorRange: (min: number, max: number) =>
          `Enter between ${formatHours(min)} and ${formatHours(max)} hours, or leave it empty to turn this off.`,
        errorRepeatRange: (min: number) =>
          `A repeat shorter than ${formatHours(min)} hours cannot be delivered on time.`,
        errorAutoCheckoutRange: (min: number, max: number) =>
          `Your session has to close between ${formatHours(min)} and ${formatHours(max)} hours after you check in.`,

        /**
         * The refusal for a body the route could not read at all - unparseable
         * JSON, a non-object, a value that is not a finite number, or a null
         * `autoCheckoutAfterH`. Deliberately separate from `saveError`, which
         * means "we understood you and could not store it": conflating the two
         * tells a member their schedule failed to save when what actually
         * happened is that the client sent something no screen can produce, and
         * "try again" is then the wrong advice.
         */
        errorInvalidBody: 'That request could not be read. Reload the page and set your nudges again.',

        save: 'Save session nudges',
        saving: 'Saving…',
        saved: 'Session nudges saved',
        saveError: 'Your session nudges could not be saved.',
      },

      // ── Push registration, this device only ────────────────────────────────
      pushTitle: 'Push on this device',
      /**
       * The registration is per browser and the settings above are per person,
       * which is the distinction this paragraph exists to draw: unregistering
       * silences this one browser, and it re-registers itself on the next visit,
       * so it is not a way to turn anything off permanently. The times and hour
       * counts above are.
       */
      pushBody:
        'CheckMark registers this browser for push when you open it. Unregistering stops push here immediately, but opening CheckMark again registers it back — the times and hour counts above are what decide which messages get sent at all.',
      pushUnsubscribe: 'Unregister this device',
      pushUnsubscribed: 'This device will no longer receive push notifications.',
      pushNotSubscribed: 'This device is not registered for push.',
      pushUnsupported: 'This browser does not support push notifications.',
      pushError: 'This device could not be unregistered.',
    },

    org: {
      title: 'Organisation features',
      body: "Switch to an organisation account to manage your team's attendance, view dashboards, and configure location signals for your workspace.",
      cta: 'Switch to organisation account',
    },

    session: {
      title: 'Session',
      signOut: 'Sign out',
    },

    danger: {
      title: 'Danger zone',
      expand: 'Show danger zone',
      collapse: 'Hide danger zone',
      deactivateTitle: 'Deactivate account',
      deactivateBody:
        'Your check-ins and data are preserved - your account becomes invisible to all workspaces. You can reactivate anytime by logging back in.',
      deactivateCta: 'Deactivate account',
      confirmPrompt: 'Are you sure? This will sign you out immediately.',
      confirmYes: 'Yes, deactivate',
      confirmBusy: 'Deactivating…',
      confirmNo: 'Cancel',
      /** 409 from DELETE /api/me - the account still owns admin-less workspaces. */
      blockedTitle: (count: number) =>
        count === 1
          ? "You're the only admin of this workspace."
          : `You're the only admin of ${count} workspaces.`,
      blockedBody:
        "For each active workspace below, either promote another member to admin or archive it first. Archived workspaces don't block deactivation.",
      blockedPromote: (name: string) => `${name} - promote admin`,
      blockedOr: 'or',
      blockedArchive: 'archive workspace',
    },
  },
} as const
