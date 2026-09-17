/**
 * Copy for the one login surface at `src/app/(public)/login/page.tsx`, plus the
 * sign-out blurb on `/me/settings`.
 *
 * Kept in its own module rather than inline in `src/locales/en.ts` so the sign-up
 * flow can be edited without touching the product's long-lived string table
 * (invariant 16). `en.auth.*` and a direct
 * `import { auth } from '@/locales/en/auth'` resolve to the same object.
 *
 * There is ONE login. The page is a single state machine - email, then either a
 * password or a one-time code, then (for a new email) name and password - and
 * this module is shaped the same way, one group per step, so a step's copy can
 * be read without reading the page.
 *
 * The account-type question is gone, and so is its copy: `accountTypeHeading`
 * asked a new account to choose "Personal" or "Organisation" before it had seen
 * the product, and the answer was never stored - it only decided whether
 * `POST /api/auth/register` created a workspace in the same request. Creating one
 * is now its own deliberate act at `/ws/new`.
 */

/** Mirrors `en.brand.name`. Repeated rather than imported to keep this module a leaf. */
const brand = 'CheckMark'

export const auth = {
  /** Shared across every step. */
  common: {
    back: '← Back',
    pleaseWait: 'Please wait…',
    /** The catch-all for a network failure - never a server message. */
    genericError: 'Something went wrong. Please try again.',
  },

  email: {
    /**
     * Rendered as `${headingPrefix} ${en.brand.name}`. It used to sit beside an
     * inline wordmark image inside the <h1>; the mark now lives above the card
     * in `AuthShell`, where it stays put for all seven steps instead of
     * vanishing after the first.
     */
    headingPrefix: 'Welcome to',
    subtitle: 'Enter your email to sign in or create an account.',
    label: 'Email address',
    placeholder: 'you@company.com',
    invalid: 'Please enter a valid email address.',
    submit: 'Continue',
    otpSendFailed: 'Failed to send verification code',
  },

  password: {
    heading: 'Sign in',
    label: 'Password',
    placeholder: 'Your password',
    required: 'Please enter your password',
    submit: 'Sign in',
    incorrect: 'Incorrect password',
    forgot: 'Forgot password?',
  },

  deactivated: {
    heading: 'Account deactivated',
    notice:
      'This account was deactivated. Your data is intact - enter your password to reactivate and sign in.',
    label: 'Password',
    placeholder: 'Your password',
    required: 'Please enter your password',
    submit: 'Reactivate account',
    failed: 'Reactivation failed',
  },

  otp: {
    heading: 'Check your inbox',
    body: 'We sent a 6-digit code to',
    label: 'Verification code',
    placeholder: '123456',
    lengthError: 'Please enter the 6-digit code',
    submit: 'Verify',
    invalid: 'Invalid code',
    resend: 'Resend code',
    resending: 'Sending…',
    resent: 'New code sent',
    resendFailed: 'Failed to resend',
  },

  /**
   * The step that replaced the Personal / Organisation fork. It asks for the two
   * things an account actually needs - a name and a password - and nothing about
   * an organisation, because a workspace is created from `/ws/new` by someone who
   * has decided they want one.
   */
  createAccount: {
    heading: 'Create your account',
    nameLabel: 'Your name',
    namePlaceholder: 'Jane Doe',
    nameRequired: 'Please enter your name',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    passwordTooShort: 'Password must be at least 8 characters',
    confirmLabel: 'Confirm password',
    mismatch: 'Passwords do not match',
    submit: 'Create account',
    failed: 'Registration failed',
  },

  forgotPassword: {
    heading: 'Reset your password',
    body: "Enter your email and we'll send a reset code.",
    label: 'Email address',
    placeholder: 'your@email.com',
    invalid: 'Please enter a valid email address',
    submit: 'Send reset code',
    failed: 'Failed to send reset code',
  },

  resetPassword: {
    heading: 'Set new password',
    body: 'Choose a new password (min 8 characters).',
    label: 'New password',
    placeholder: 'New password',
    tooShort: 'Password must be at least 8 characters',
    submit: 'Set new password',
    failed: 'Reset failed',
  },

  sessionLogoutText: `Sign out of your ${brand} account on this device.`,
}
