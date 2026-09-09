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
import type { NotificationCategory } from '@/lib/notifications/categories'

export const meSettings = {
  // ── /me/timeline ──────────────────────────────────────────────────────────
  timeline: {
    title: 'Timeline',
    rangeFrom: 'From',
    rangeTo: 'To',
    /** "12 check-ins · 8 days" - the line under the range pickers. */
    summary: (checkins: number, days: number) =>
      `${checkins} check-in${checkins === 1 ? '' : 's'} · ${days} day${days === 1 ? '' : 's'}`,
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

      /**
       * Two groups, because the two halves are keyed differently: the first is
       * per (workspace, you), the second is per account. The workspace is NOT
       * named here - the top-bar pill above already answers "which one".
       */
      workspaceGroupLabel: 'This workspace',
      workspaceGroupHint:
        'Mute a category and it stops reaching you from this workspace — the phone push and the bell alike. Switch workspaces with the pill at the top to set another one.',
      deviceGroupLabel: 'Your device',
      deviceGroupHint:
        'These follow your account rather than any one workspace, because a check-in session belongs to none.',

      /** Nothing to scope to: no active membership. */
      noWorkspace: 'You are not in a workspace yet, so there is nothing here to mute.',

      /**
       * Same withholding rule as the admin switchboard: the default state is
       * "nothing muted", so painting it after a failed load would let a toggle
       * write over mutes the member had already set.
       */
      loadFailed: 'Your notification settings could not be loaded. Nothing has been changed.',
      loadFailedRetry: 'Try again',
      saveError: 'That change could not be saved.',

      /** One entry per category; `satisfies` keeps it total against the catalogue. */
      categories: {
        reminders: {
          label: 'Daily reminders',
          hint: 'The nudge to check in or out, on working days only.',
        },
        approvals_inbox: {
          label: 'Requests to action',
          hint: 'Only reaches you if you are the one approving leave or regularizations.',
        },
        approvals_outcome: {
          label: 'Outcomes of your requests',
          hint: 'What happened to the leave, regularization or document you filed.',
        },
        announcements: {
          label: 'Announcements',
          hint: 'Workspace-wide notices — a closure, an office day, a policy change.',
        },
        presence: {
          label: 'Check-in session updates',
          hint: 'Hourly milestones and the warning before an open session is auto-closed.',
        },
      } as const satisfies Record<NotificationCategory, { label: string; hint: string }>,

      /** Keyed on `CategoryDef.lockedReason` - why a switch is not offered. */
      lockedReasons: {
        always_on_outcome:
          'Cannot be muted. Not knowing your leave was rejected is worse than one more notification.',
        always_on_announcement:
          'Cannot be muted. This is the one notice that cannot afford to be missed.',
      } as const satisfies Record<string, string>,

      /** Fallback for a locked category with no stated reason. */
      lockedGeneric: 'Cannot be muted.',

      // ── Push registration, this device only ────────────────────────────────
      pushTitle: 'Push on this device',
      pushBody:
        'Venzio registers this browser for push when you open it. Unregistering stops push here immediately, but opening Venzio again registers it back — mute the categories above to stop the messages themselves.',
      pushUnsubscribe: 'Unregister this device',
      pushUnsubscribed: 'This device will no longer receive push notifications.',
      pushNotSubscribed: 'This device is not registered for push.',
      pushUnsupported: 'This browser does not support push notifications.',
      pushError: 'This device could not be unregistered.',

      // ── What the two /api/me/.../notification-prefs routes answer with ─────
      api: {
        invalidBody: 'Send { category, muted } as JSON',
        unknownCategory: 'Unknown notification category',
        locked: (category: string) =>
          `The "${category}" category cannot be muted — it is always delivered`,
        wrongScopeWorkspace: (category: string) =>
          `"${category}" is an account-level category; set it through /api/me/notification-prefs`,
        wrongScopeAccount: (category: string) =>
          `"${category}" belongs to a workspace; set it through /api/me/ws/[slug]/notification-prefs`,
      },
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
