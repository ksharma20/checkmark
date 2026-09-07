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
    leave: 'Leave',
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
    workspaceEyebrow: 'Workspace',
    inOfficeNow: (n: number) => `${n} in office right now`,
    openWorkspace: 'Open workspace presence',
    noWorkspaceTitle: 'No workspace yet',
    noWorkspaceBody:
      'Once you join a workspace your attendance summary shows up here.',
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
