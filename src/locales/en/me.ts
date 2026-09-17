/**
 * Copy for the `/me` user surface (shell, home screen and the check-in card).
 *
 * Kept in its own module rather than folded into `src/locales/en.ts` so the two
 * surfaces can be edited independently. Import it directly:
 *
 *   import { me } from '@/locales/en/me'
 */
export const me = {
  // ── shell ────────────────────────────────────────────────────────────────
  nav: {
    label: 'Primary',
    timeline: 'Timeline',
    home: 'Home',
  },

  topbar: {
    switchWorkspace: 'Switch workspace',
    noWorkspace: 'No workspace',
    profileMenu: 'Profile and account menu',
    adminView: 'Switch to admin view',
  },

  switcher: {
    title: 'Your workspaces',
    empty: "You're not in a workspace yet.",
  },

  profileSheet: {
    profile: 'Profile',
    documents: 'My documents',
    linkedWorkspaces: 'Linked workspaces',
    notifications: 'Notifications',
    privacy: 'Privacy & data',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutFailed: 'Could not sign out. Please try again.',
  },

  // ── home ─────────────────────────────────────────────────────────────────
  home: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    statWfo: 'WFO days',
    statWfh: 'WFH days',
    statLeaveTaken: 'Leave taken',
    statLeaveLeft: 'Leave left',
    leaveCta: 'Leave & correction',
    leaveCtaHint: 'Balance, time off, day corrections and holidays',
    workspaceEyebrow: 'Workspace',
    inOfficeNow: (n: number) => `${n} in office right now`,
    openWorkspace: 'Open workspace presence',
  },

  /**
   * The create-or-join card, shown on `/me` home in place of the attendance
   * stat grid when the account holds no active membership.
   *
   * It replaced a dead end. The old card said "No workspace yet / Once you join
   * a workspace your attendance summary shows up here" and offered no way to
   * join one - it named the missing thing and then stopped. This one carries
   * the three routes in that actually exist: create one, accept an invitation
   * already addressed to this email, or walk into a workspace that has verified
   * the email's domain.
   *
   * `/me` is NOT blocked behind it. Check-in still works, the timeline still
   * reads back, and the copy says so - a person can record their own presence
   * without any organisation, and this is an offer rather than a gate.
   *
   * Workspace NAMES are printed here on purpose, against the `/me` rule that
   * content under the pill must not repeat it: this is the one place on the
   * surface where the reader is CHOOSING BETWEEN workspaces, so the name is the
   * information rather than decoration. The pill above says "No workspace".
   */
  joinCard: {
    title: 'Set up your workspace',
    body:
      'You can keep checking in without one - your presence and history are already yours. A workspace adds verification, leave and your team.',

    createCta: 'Create a workspace',
    createHint: "You'll be its owner, and you can create more than one.",

    invitesTitle: 'Waiting for you',
    /** Follows the workspace name on an invitation row. */
    inviteBody: 'invited you to share your presence with them.',

    domainTitle: 'Open to you',
    /** Follows the workspace name on a verified-domain row. */
    domainBody: 'has verified your email domain, so you can join without an invitation.',
    domainCta: 'Join',
  },

  // ── check-in card ────────────────────────────────────────────────────────
  checkin: {
    tapToCheckIn: 'Tap to check in',
    checkInLabel: 'CHECK IN',
    verifyHint: "We'll verify your GPS and office network",
    checkInRemotely: 'Check in remotely',
    checkInAgain: 'Check in again',
    checkingOut: 'Checking out…',
    checkOut: 'Check out',
    // signal acquisition
    locatingYou: 'Locating you…',
    gpsMatched: 'Location captured',
    verifyingNetwork: 'Verifying office network…',
    // checked-in state
    checkedIn: 'Checked in',
    checkedInAt: (time: string) => `Checked in · ${time}`,
    matchedBy: {
      verified: 'Verified',
      partial: 'Partial',
      none: 'Unverified',
      override: 'Override',
    },
    remoteSession: 'Remote',
    officeSession: 'Office',
    sessionCount: (n: number) => `Session ${n} today`,
    currentStreak: 'Current streak',
    streakDays: (n: number) => `${n} day${n === 1 ? '' : 's'}`,
    // sessions-today (checked out again) state
    sessionsToday: (n: number) => `${n} session${n === 1 ? '' : 's'} today`,
    sessionLabel: (n: number) => `Session ${n}`,
    inProgress: 'now',
    // toasts / alerts — unchanged wording, moved out of the component
    toastCheckedIn: 'Checked in!',
    toastCheckedInRemotely: 'Checked in remotely!',
    toastAlreadyCheckedIn: 'Already checked in.',
    toastNotCheckedIn: "You're not checked in.",
    toastCheckinFailed: 'Check-in failed',
    toastCheckoutFailed: 'Checkout failed',
    toastNetworkError: 'Network error. Please try again.',
    toastConnectionError:
      'Check-in failed. Please check your connection and try again.',
    toastNotification: 'Notification',
    checkedOut: 'Checked out',
    checkedOutLocationMissing: ' (location not captured)',
    autoCheckoutIn: (remaining: string) => `Auto checkout in ${remaining}`,
    locationAlert: {
      dismiss: 'Got it',
      denied: {
        title: 'Location access denied',
        message:
          'CheckMark needs your location to verify check-in. Please enable location permission in your browser settings and try again.',
      },
      timeout: {
        title: 'Location request timed out',
        message:
          "Could not get your location in time. Make sure you're not in airplane mode, then try again.",
      },
      unavailable: {
        title: 'Location unavailable',
        message:
          'Your device could not determine your location. Check that location services are enabled and try again.',
      },
    },
  },
} as const
