'use client'

/**
 * The one login.
 *
 * There is a single door into the product and a single state machine behind it:
 *
 *   email ─┬─ existing account ──── password ──────────────────┐
 *          ├─ deactivated account ─ deactivated (reactivate) ──┤
 *          └─ new email ─────────── otp ─── createAccount ─────┤
 *                                                              ├─▶ handleSuccess
 *   password ─ "Forgot password?" ─ forgotPassword ─ otp ─ resetPassword ──┘
 *
 * `otp` is shared by the two flows that need a code, and `isResetFlow` is what
 * tells them apart on the way out - reset goes to `resetPassword`, a new email
 * goes to `createAccount`.
 *
 * **Sign-up no longer asks what KIND of account this is.** The Personal /
 * Organisation cards, the whole `OrgSetupStep` with its live slug checker, and
 * the `accountType` / `orgName` / `orgSlug` / `orgDomain` half of
 * `POST /api/auth/register` are gone. The answer was never stored: it only
 * decided whether a workspace was created in the same request, which is a
 * question nobody can answer before they have seen the product. Creating a
 * workspace is now its own act at `/ws/new`, and `/me` stands on its own without
 * one - a person can record their own presence and read their own history with
 * no organisation at all.
 *
 * All copy lives in `src/locales/en/auth.ts` (invariant 16).
 */

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useIsLoggedIn } from '@/hooks/useIsLoggedIn';

import { en } from '@/locales/en'
import { auth } from '@/locales/en/auth'
import { startProgress, stopProgress } from '@/components/shared/TopProgressBar'
import { Button, Field, Input, Skeleton } from '@/components/ui'
import AuthShell from '@/components/marketing/AuthShell'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'email'
  | 'password'
  | 'otp'
  | 'createAccount'
  | 'deactivated'
  | 'forgotPassword'
  | 'resetPassword'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Shared primitives ────────────────────────────────────────────────────────
//
// These are thin adapters over src/components/ui. They exist so the step
// components below keep the prop shapes they were written against - `onChange`
// takes a string, not an event - while the actual markup, focus ring, invalid
// border and label wiring all come from the design system.

/**
 * Label + control + message, from the design system's `Field`.
 *
 * `htmlFor` is required rather than optional: before the re-skin none of these
 * labels were associated with their input at all, so clicking a label did
 * nothing and screen readers announced the controls unnamed.
 */
function FieldGroup({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Field className="mb-4" label={label} htmlFor={htmlFor} error={error || undefined} hint={hint}>
      {children}
    </Field>
  )
}

function TextInput({
  id,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  autoFocus,
  onKeyDown,
  hasError,
  describedBy,
}: {
  id: string
  type?: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
  hasError?: boolean
  describedBy?: string
}) {
  return (
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      invalid={hasError}
      aria-describedby={describedBy}
      className="h-12"
    />
  )
}

/**
 * `Button` sizes to the design system's 42px, which suits the pointer-driven
 * /ws surface. This is a page people reach on a phone, so the project's 44px
 * touch minimum is restored with `min-h-11`.
 */
function PrimaryBtn({
  children,
  onClick,
  loading,
}: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
}) {
  return (
    <Button block loading={loading} onClick={onClick} className="min-h-11">
      {loading ? auth.common.pleaseWait : children}
    </Button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="-ml-3 mb-5 min-h-11">
      {auth.common.back}
    </Button>
  )
}

/** Form-level error - field-level messages go through `FieldGroup`'s `error`. */
function ErrorMsg({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p role="alert" className="field-error mt-2.5">
      {text}
    </p>
  )
}

// ─── Email step ───────────────────────────────────────────────────────────────

function EmailStep({
  onExisting,
  onNew,
  onDeactivated,
}: {
  onExisting: (email: string) => void
  onNew: (email: string) => void
  onDeactivated: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailTouched, setEmailTouched] = useState(false)

  const emailInvalid = emailTouched && email.trim() !== '' && !EMAIL_RE.test(email.trim())

  async function proceed() {
    const e = email.toLowerCase().trim()
    if (!e || !EMAIL_RE.test(e)) {
      setEmailTouched(true)
      return
    }
    setLoading(true)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (data.exists && data.deactivated) {
        onDeactivated(e)
      } else if (data.exists) {
        onExisting(e)
      } else {
        const otpRes = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e }),
        })
        if (otpRes.ok) {
          onNew(e)
        } else {
          const otpData = await otpRes.json()
          setError(otpData.error || auth.email.otpSendFailed)
        }
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-heading text-[26px] font-bold text-navy">
        {auth.email.headingPrefix} {en.brand.name}
      </h1>
      <p className="mb-7 text-sm text-text-secondary">{auth.email.subtitle}</p>
      <FieldGroup
        label={auth.email.label}
        htmlFor="login-email"
        error={emailInvalid ? auth.email.invalid : null}
      >
        <TextInput
          id="login-email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); if (error) setError(null) }}
          onBlur={() => setEmailTouched(true)}
          placeholder={auth.email.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && proceed()}
          hasError={emailInvalid}
          describedBy={emailInvalid ? 'login-email-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={proceed} loading={loading}>
        {auth.email.submit}
      </PrimaryBtn>
      <ErrorMsg text={error} />
    </div>
  )
}

// ─── Password step (existing user) ────────────────────────────────────────────

function PasswordStep({
  email,
  onBack,
  onSuccess,
  onForgotPassword,
}: {
  email: string
  onBack: () => void
  onSuccess: (redirect: string) => void
  onForgotPassword: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (!password) {
      setError(auth.password.required)
      return
    }
    setLoading(true)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/me')
      } else {
        setError(data.error || auth.password.incorrect)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">{auth.password.heading}</h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>
      <FieldGroup label={auth.password.label} htmlFor="login-password" error={error}>
        <TextInput
          id="login-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder={auth.password.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
          hasError={!!error}
          describedBy={error ? 'login-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={signIn} loading={loading}>
        {auth.password.submit}
      </PrimaryBtn>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForgotPassword}
        className="-ml-3 mt-1 min-h-11 underline"
      >
        {auth.password.forgot}
      </Button>
    </div>
  )
}

// ─── Deactivated step ─────────────────────────────────────────────────────────

function DeactivatedStep({
  email,
  onBack,
  onSuccess,
}: {
  email: string
  onBack: () => void
  onSuccess: (redirect: string) => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reactivate() {
    if (!password) { setError(auth.deactivated.required); return }
    setLoading(true)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/me/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/me')
      } else {
        setError(data.error || auth.deactivated.failed)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">
        {auth.deactivated.heading}
      </h1>
      <p className="mb-5 text-[13px] text-text-secondary">{email}</p>
      <p className="mb-5 rounded-md border border-amber bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-3.5 py-3 text-[13px] leading-relaxed text-text-secondary">
        {auth.deactivated.notice}
      </p>
      <FieldGroup label={auth.deactivated.label} htmlFor="reactivate-password" error={error}>
        <TextInput
          id="reactivate-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder={auth.deactivated.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && reactivate()}
          hasError={!!error}
          describedBy={error ? 'reactivate-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={reactivate} loading={loading}>
        {auth.deactivated.submit}
      </PrimaryBtn>
    </div>
  )
}

// ─── OTP step (new user, and the reset flow) ──────────────────────────────────

function OtpStep({
  email,
  onBack,
  onVerified,
}: {
  email: string
  onBack: () => void
  onVerified: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendMsg, setResendMsg] = useState<string | null>(null)

  async function verify() {
    const c = code.trim()
    if (c.length !== 6) {
      setError(auth.otp.lengthError)
      return
    }
    setLoading(true)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: c }),
      })
      if (res.ok) {
        onVerified()
      } else {
        const data = await res.json()
        setError(data.error || auth.otp.invalid)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  async function resend() {
    setResending(true)
    setResendMsg(null)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setResendMsg(auth.otp.resent)
      } else {
        const data = await res.json()
        setError(data.error || auth.otp.resendFailed)
      }
    } finally {
      setResending(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">{auth.otp.heading}</h1>
      <p className="mb-6 text-[13px] text-text-secondary">
        {auth.otp.body} <strong>{email}</strong>
      </p>
      <FieldGroup label={auth.otp.label} htmlFor="otp-code" error={error}>
        <TextInput
          id="otp-code"
          type="text"
          value={code}
          onChange={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); if (error) setError(null) }}
          placeholder={auth.otp.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          hasError={!!error}
          describedBy={error ? 'otp-code-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={verify} loading={loading}>
        {auth.otp.submit}
      </PrimaryBtn>
      {resendMsg && (
        <p role="status" className="mt-2.5 text-[13px] text-brand">
          {resendMsg}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={resend}
        loading={resending}
        className="-ml-3 mt-3 min-h-11"
      >
        {resending ? auth.otp.resending : auth.otp.resend}
      </Button>
    </div>
  )
}

// ─── Forgot password step ─────────────────────────────────────────────────────

function ForgotPasswordStep({
  email: initialEmail,
  onBack,
  onCodeSent,
}: {
  email: string
  onBack: () => void
  onCodeSent: (email: string) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendResetCode() {
    const e = email.toLowerCase().trim()
    if (!e || !EMAIL_RE.test(e)) {
      setError(auth.forgotPassword.invalid)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      if (res.ok) {
        onCodeSent(e)
      } else {
        const data = await res.json()
        setError(data.error || auth.forgotPassword.failed)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">
        {auth.forgotPassword.heading}
      </h1>
      <p className="mb-6 text-sm text-text-secondary">{auth.forgotPassword.body}</p>
      <FieldGroup label={auth.forgotPassword.label} htmlFor="reset-email" error={error}>
        <TextInput
          id="reset-email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); if (error) setError(null) }}
          placeholder={auth.forgotPassword.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && sendResetCode()}
          hasError={!!error}
          describedBy={error ? 'reset-email-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={sendResetCode} loading={loading}>
        {auth.forgotPassword.submit}
      </PrimaryBtn>
    </div>
  )
}

// ─── Reset password step ──────────────────────────────────────────────────────

function ResetPasswordStep({
  email,
  onSuccess,
}: {
  email: string
  onSuccess: (redirect: string) => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resetPassword() {
    if (password.length < 8) {
      setError(auth.resetPassword.tooShort)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: password }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/me')
      } else {
        setError(data.error ?? auth.resetPassword.failed)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">
        {auth.resetPassword.heading}
      </h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>
      <p className="mb-4 text-sm text-text-secondary">{auth.resetPassword.body}</p>
      <FieldGroup label={auth.resetPassword.label} htmlFor="new-password" error={error}>
        <TextInput
          id="new-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder={auth.resetPassword.placeholder}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
          hasError={!!error}
          describedBy={error ? 'new-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={resetPassword} loading={loading}>
        {auth.resetPassword.submit}
      </PrimaryBtn>
    </div>
  )
}

// ─── Create account ───────────────────────────────────────────────────────────

/**
 * The last step of sign-up, and the only one. It asks for a name and a password
 * and nothing about an organisation: `POST /api/auth/register` no longer creates
 * a workspace, and a person who wants one goes to `/ws/new` once they are in.
 */
function CreateAccountStep({
  email,
  onBack,
  onSuccess,
}: {
  email: string
  onBack: () => void
  onSuccess: (redirect: string) => void
}) {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function register() {
    if (!fullName.trim()) { setError(auth.createAccount.nameRequired); return }
    if (password.length < 8) { setError(auth.createAccount.passwordTooShort); return }
    if (password !== confirm) { setError(auth.createAccount.mismatch); return }
    setLoading(true)
    setError(null)
    startProgress()
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName.trim(),
          password,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/me')
      } else {
        setError(data.error || auth.createAccount.failed)
      }
    } catch {
      setError(auth.common.genericError)
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">
        {auth.createAccount.heading}
      </h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>

      <FieldGroup label={auth.createAccount.nameLabel} htmlFor="signup-name">
        <TextInput
          id="signup-name"
          value={fullName}
          onChange={setFullName}
          placeholder={auth.createAccount.namePlaceholder}
          autoFocus
        />
      </FieldGroup>
      <FieldGroup label={auth.createAccount.passwordLabel} htmlFor="signup-password">
        <TextInput
          id="signup-password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder={auth.createAccount.passwordPlaceholder}
        />
      </FieldGroup>
      <FieldGroup label={auth.createAccount.confirmLabel} htmlFor="signup-confirm">
        <TextInput
          id="signup-confirm"
          type="password"
          value={confirm}
          onChange={setConfirm}
          onKeyDown={(e) => e.key === 'Enter' && register()}
        />
      </FieldGroup>

      <PrimaryBtn onClick={register} loading={loading}>
        {auth.createAccount.submit}
      </PrimaryBtn>
      <ErrorMsg text={error} />
    </div>
  )
}

// ─── Main flow ────────────────────────────────────────────────────────────────

function LoginFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [isResetFlow, setIsResetFlow] = useState(false)

  // `?invite=<slug>` is the whole reason somebody signed in, so it outranks the
  // redirect the API suggests - both here and for a session that already exists.
  const invite = searchParams.get('invite')

  const isLoggedIn = useIsLoggedIn();
  useEffect(() => {
    if (!isLoggedIn) return
    // Landing here already signed in with an invitation in hand used to drop the
    // invitation on the floor and go to `/me`, leaving the person on a screen
    // that says nothing about the workspace that asked for them.
    router.replace(invite ? `/join/${invite}` : '/me');
  }, [isLoggedIn, invite, router])

  function handleSuccess(redirect: string) {
    if (invite) {
      router.push(`/join/${invite}`)
    } else {
      router.push(redirect)
    }
  }

  return (
    <>
        {step === 'email' && (
          <EmailStep
            onExisting={(e) => { setEmail(e); setStep('password') }}
            onNew={(e) => { setEmail(e); setStep('otp') }}
            onDeactivated={(e) => { setEmail(e); setStep('deactivated') }}
          />
        )}
        {step === 'password' && (
          <PasswordStep
            email={email}
            onBack={() => setStep('email')}
            onSuccess={handleSuccess}
            onForgotPassword={() => { setIsResetFlow(false); setStep('forgotPassword') }}
          />
        )}
        {step === 'otp' && (
          <OtpStep
            email={email}
            onBack={() => setStep(isResetFlow ? 'forgotPassword' : 'email')}
            onVerified={() => setStep(isResetFlow ? 'resetPassword' : 'createAccount')}
          />
        )}
        {step === 'createAccount' && (
          <CreateAccountStep
            email={email}
            onBack={() => setStep('email')}
            onSuccess={handleSuccess}
          />
        )}
        {step === 'deactivated' && (
          <DeactivatedStep
            email={email}
            onBack={() => setStep('email')}
            onSuccess={handleSuccess}
          />
        )}
        {step === 'forgotPassword' && (
          <ForgotPasswordStep
            email={email}
            onBack={() => setStep('password')}
            onCodeSent={(e) => {
              setEmail(e)
              setIsResetFlow(true)
              setStep('otp')
            }}
          />
        )}
        {step === 'resetPassword' && (
          <ResetPasswordStep
            email={email}
            onSuccess={handleSuccess}
          />
        )}
    </>
  )
}

/**
 * Stands in for whichever step is about to mount, at the shape of the one that
 * almost always is: heading, subtitle, one labelled field, one full-width
 * button. Skeletons, not a spinner - the design system has no spinner, and this
 * one has a job beyond politeness (see below).
 */
function LoginSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton width={200} height={26} radius={8} />
      <div className="mt-3">
        <Skeleton width={260} height={14} />
      </div>
      <div className="mt-7">
        <Skeleton width={110} height={12} />
      </div>
      <div className="mt-2">
        <Skeleton height={48} radius={10} />
      </div>
      <div className="mt-5">
        <Skeleton height={44} radius={10} />
      </div>
    </div>
  )
}

/**
 * `AuthShell` is OUTSIDE the Suspense boundary, and that placement is the whole
 * point of this component existing separately from `LoginFlow`.
 *
 * `LoginFlow` reads `useSearchParams` (for `?invite=`), which opts its subtree
 * out of the static prerender. With the boundary wrapped around the entire page
 * - and with no fallback, as it was - the prerendered HTML for `/login` was
 * EMPTY: the first screen after the landing page painted nothing at all until
 * the JavaScript arrived and hydrated.
 *
 * Hoisting the frame above the boundary means the brand mark, the ambient wash
 * and the card are in the server HTML, and only the step machine waits. The
 * fallback then has something to sit inside, so the page goes
 * frame -> skeleton -> form rather than blank -> form.
 */
export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginFlow />
      </Suspense>
    </AuthShell>
  )
}
