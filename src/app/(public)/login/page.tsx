'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useIsLoggedIn } from '@/hooks/useIsLoggedIn';

import Image from 'next/image'
import { en } from '@/locales/en'
import { startProgress, stopProgress } from '@/components/shared/TopProgressBar'
import { Button, Card, Field, Input } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'email' | 'password' | 'otp' | 'accountType' | 'personal' | 'org' | 'deactivated' | 'forgotPassword' | 'resetPassword'

// ─── Shared primitives ────────────────────────────────────────────────────────
//
// These are thin adapters over src/components/ui. They exist so the eight step
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
      {loading ? 'Please wait…' : children}
    </Button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="-ml-3 mb-5 min-h-11">
      ← Back
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

  const emailInvalid = emailTouched && email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function proceed() {
    const e = email.toLowerCase().trim()
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
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
          setError(otpData.error || 'Failed to send verification code')
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <h1 className="mb-2 flex items-center gap-2 font-heading text-[26px] font-bold text-navy">
        Welcome to{' '}
        <Image
          src="/logo.png"
          alt={en.brand.name}
          width={130}
          height={38}
          className="inline-block h-auto w-[130px] object-contain align-middle"
          priority
        />
      </h1>
      <p className="mb-7 text-sm text-text-secondary">
        Enter your email to sign in or create an account.
      </p>
      <FieldGroup
        label="Email address"
        htmlFor="login-email"
        error={emailInvalid ? 'Please enter a valid email address.' : null}
      >
        <TextInput
          id="login-email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); if (error) setError(null) }}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@company.com"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && proceed()}
          hasError={emailInvalid}
          describedBy={emailInvalid ? 'login-email-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={proceed} loading={loading}>
        Continue
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
      setError('Please enter your password')
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
        setError(data.error || 'Incorrect password')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Sign in</h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>
      <FieldGroup label="Password" htmlFor="login-password" error={error}>
        <TextInput
          id="login-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
          hasError={!!error}
          describedBy={error ? 'login-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={signIn} loading={loading}>
        Sign in
      </PrimaryBtn>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForgotPassword}
        className="-ml-3 mt-1 min-h-11 underline"
      >
        Forgot password?
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
    if (!password) { setError('Please enter your password'); return }
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
        setError(data.error || 'Reactivation failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Account deactivated</h1>
      <p className="mb-5 text-[13px] text-text-secondary">{email}</p>
      <p className="mb-5 rounded-md border border-amber bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-3.5 py-3 text-[13px] leading-relaxed text-text-secondary">
        This account was deactivated. Your data is intact - enter your password to reactivate and sign in.
      </p>
      <FieldGroup label="Password" htmlFor="reactivate-password" error={error}>
        <TextInput
          id="reactivate-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && reactivate()}
          hasError={!!error}
          describedBy={error ? 'reactivate-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={reactivate} loading={loading}>
        Reactivate account
      </PrimaryBtn>
    </div>
  )
}

// ─── OTP step (new user) ──────────────────────────────────────────────────────

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
      setError('Please enter the 6-digit code')
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
        setError(data.error || 'Invalid code')
      }
    } catch {
      setError('Something went wrong. Please try again.')
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
        setResendMsg('New code sent')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to resend')
      }
    } finally {
      setResending(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Check your inbox</h1>
      <p className="mb-6 text-[13px] text-text-secondary">
        We sent a 6-digit code to <strong>{email}</strong>
      </p>
      <FieldGroup label="Verification code" htmlFor="otp-code" error={error}>
        <TextInput
          id="otp-code"
          type="text"
          value={code}
          onChange={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); if (error) setError(null) }}
          placeholder="123456"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          hasError={!!error}
          describedBy={error ? 'otp-code-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={verify} loading={loading}>
        Verify
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
        {resending ? 'Sending…' : 'Resend code'}
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
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setError('Please enter a valid email address')
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
        setError(data.error || 'Failed to send reset code')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Reset your password</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Enter your email and we&apos;ll send a reset code.
      </p>
      <FieldGroup label="Email address" htmlFor="reset-email" error={error}>
        <TextInput
          id="reset-email"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); if (error) setError(null) }}
          placeholder="your@email.com"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && sendResetCode()}
          hasError={!!error}
          describedBy={error ? 'reset-email-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={sendResetCode} loading={loading}>
        Send reset code
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
      setError('Password must be at least 8 characters')
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
        setError(data.error ?? 'Reset failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Set new password</h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>
      <p className="mb-4 text-sm text-text-secondary">
        Choose a new password (min 8 characters).
      </p>
      <FieldGroup label="New password" htmlFor="new-password" error={error}>
        <TextInput
          id="new-password"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(null) }}
          placeholder="New password"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
          hasError={!!error}
          describedBy={error ? 'new-password-error' : undefined}
        />
      </FieldGroup>
      <PrimaryBtn onClick={resetPassword} loading={loading}>
        Set new password
      </PrimaryBtn>
    </div>
  )
}

// ─── Account type selection ───────────────────────────────────────────────────

function AccountTypeStep({
  onPersonal,
  onOrg,
}: {
  onPersonal: () => void
  onOrg: () => void
}) {
  return (
    <div>
      <h1 className="mb-2 font-heading text-[22px] font-bold text-navy">
        How will you use {en.brand.name}?
      </h1>
      <p className="mb-7 text-sm text-text-secondary">
        Choose the type of account to set up.
      </p>

      <div className="stack">
        <AccountTypeCard
          title="Personal"
          description="Track your own presence. Join workspaces when invited by your org."
          onClick={onPersonal}
        />
        <AccountTypeCard
          title="Organisation"
          description="Set up a workspace for your team. See who is in the office, when."
          onClick={onOrg}
        />
      </div>
    </div>
  )
}

/**
 * A `.card` that is also a button. The hover border used to be tracked in React
 * state; `.hoverlift` does it in CSS, and only on devices that actually hover.
 */
function AccountTypeCard({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card hoverlift pressable w-full cursor-pointer text-left"
    >
      <p className="mb-1 font-heading text-[15px] font-semibold text-navy">{title}</p>
      <p className="text-[13px] text-text-secondary">{description}</p>
    </button>
  )
}

// ─── Personal setup ───────────────────────────────────────────────────────────

function PersonalSetupStep({
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
    if (!fullName.trim()) { setError('Please enter your name'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
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
          accountType: 'personal',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/me')
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Create your account</h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>

      <FieldGroup label="Your name" htmlFor="personal-name">
        <TextInput id="personal-name" value={fullName} onChange={setFullName} placeholder="Jane Doe" autoFocus />
      </FieldGroup>
      <FieldGroup label="Password" htmlFor="personal-password">
        <TextInput
          id="personal-password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password" htmlFor="personal-confirm">
        <TextInput
          id="personal-confirm"
          type="password"
          value={confirm}
          onChange={setConfirm}
          onKeyDown={(e) => e.key === 'Enter' && register()}
        />
      </FieldGroup>

      <PrimaryBtn onClick={register} loading={loading}>
        Create account
      </PrimaryBtn>
      <ErrorMsg text={error} />
    </div>
  )
}

// ─── Org setup ────────────────────────────────────────────────────────────────

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

function useSlugCheck(slug: string): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!slug || slug.length < 2) {
      setStatus('idle')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/.test(slug)) {
      setStatus('invalid')
      return
    }
    setStatus('checking')
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/workspace/check-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        })
        const data = await res.json()
        setStatus(data.available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [slug])

  return status
}

function SlugHint({ status }: { status: SlugStatus }) {
  const hints: Record<SlugStatus, { text: string; className: string }> = {
    idle: { text: 'Lowercase letters, numbers, hyphens', className: 'text-text-muted' },
    checking: { text: 'Checking availability…', className: 'text-text-secondary' },
    available: { text: '✓ Available', className: 'text-brand' },
    taken: { text: '✗ Already taken', className: 'text-danger' },
    invalid: { text: 'Only lowercase letters, numbers and hyphens', className: 'text-amber' },
  }
  const hint = hints[status]
  return (
    <p
      id="org-slug-hint"
      /* Availability arrives after a debounce, so it has to be announced. */
      aria-live="polite"
      className={`mt-1.5 text-[12.5px] ${hint.className}`}
    >
      {hint.text}
    </p>
  )
}

function OrgSetupStep({
  email,
  onBack,
  onSuccess,
}: {
  email: string
  onBack: () => void
  onSuccess: (redirect: string) => void
}) {
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [orgDomain, setOrgDomain] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugStatus = useSlugCheck(orgSlug)

  function handleOrgName(name: string) {
    setOrgName(name)
    const auto = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48)
    setOrgSlug(auto)
  }

  async function register() {
    if (!orgName.trim()) { setError('Organisation name is required'); return }
    if (!orgSlug || slugStatus !== 'available') {
      setError('Please choose a valid, available URL handle')
      return
    }
    if (!fullName.trim()) { setError('Your name is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
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
          accountType: 'org',
          orgName: orgName.trim(),
          orgSlug,
          orgDomain: orgDomain.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.redirect ?? '/ws')
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      stopProgress()
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 className="mb-1 font-heading text-[22px] font-bold text-navy">Set up your organisation</h1>
      <p className="mb-6 text-[13px] text-text-secondary">{email}</p>

      {/* Org section */}
      <h2 className="t-eyebrow mb-3">Organisation</h2>

      <FieldGroup label="Organisation name" htmlFor="org-name">
        <TextInput id="org-name" value={orgName} onChange={handleOrgName} placeholder="Acme Corp" autoFocus />
      </FieldGroup>

      <div className="mb-4">
        <label className="field-label" htmlFor="org-slug">
          URL handle
        </label>
        {/* A composite control, so it borrows `.input`'s border and fill rather
            than being one: the `/ws/` prefix sits inside the same frame. */}
        <div className="flex h-12 items-center overflow-hidden rounded-md border border-border bg-surface-2 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--ring)]">
          <span className="flex h-full shrink-0 items-center whitespace-nowrap border-r border-border bg-surface-1 px-2.5 text-[13px] text-text-secondary">
            /ws/
          </span>
          <input
            id="org-slug"
            type="text"
            value={orgSlug}
            onChange={(e) =>
              setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
            placeholder="acme-corp"
            aria-describedby="org-slug-hint"
            className="h-full min-w-0 flex-1 border-none bg-transparent px-3 font-mono text-sm text-text-primary outline-none"
          />
        </div>
        <SlugHint status={slugStatus} />
      </div>

      <FieldGroup
        label="Company email domain (optional)"
        htmlFor="org-domain"
        hint="Employees with this domain are auto-enrolled when they sign up."
      >
        <TextInput id="org-domain" value={orgDomain} onChange={setOrgDomain} placeholder="acme.com" />
      </FieldGroup>

      <div className="divider" role="separator" />

      {/* Personal section */}
      <h2 className="t-eyebrow mb-3">Your account</h2>

      <FieldGroup label="Your name" htmlFor="org-owner-name">
        <TextInput id="org-owner-name" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
      </FieldGroup>
      <FieldGroup label="Password" htmlFor="org-owner-password">
        <TextInput
          id="org-owner-password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password" htmlFor="org-owner-confirm">
        <TextInput
          id="org-owner-confirm"
          type="password"
          value={confirm}
          onChange={setConfirm}
          onKeyDown={(e) => e.key === 'Enter' && register()}
        />
      </FieldGroup>

      <PrimaryBtn onClick={register} loading={loading}>
        Create organisation
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

  const isLoggedIn = useIsLoggedIn();
  useEffect(() => {
     if (isLoggedIn) {
      router.replace('/me');
      return;
    }
  },[isLoggedIn, router])

  function handleSuccess(redirect: string) {
    const invite = searchParams.get('invite')
    if (invite) {
      router.push(`/join/${invite}`)
    } else {
      router.push(redirect)
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-surface-1 px-4 py-6">
      {/* Ambient glow and grid - the same treatment as the landing page hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-10%] z-0 h-[500px] w-[700px] -translate-x-1/2"
        style={{ background: 'radial-gradient(ellipse at center, var(--brand-glow) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(27,77,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(27,77,255,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)',
        }}
      />
      {/* No elevation: `.card` is an inline surface, and the design system
          reserves --shadow-* for overlays. */}
      <Card className="relative z-[1] w-full max-w-[420px]" style={{ padding: '32px 28px' }}>
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
            onVerified={() => {
              if (isResetFlow) {
                setStep('resetPassword')
              } else {
                setStep('accountType')
              }
            }}
          />
        )}
        {step === 'accountType' && (
          <AccountTypeStep
            onPersonal={() => setStep('personal')}
            onOrg={() => setStep('org')}
          />
        )}
        {step === 'personal' && (
          <PersonalSetupStep
            email={email}
            onBack={() => setStep('accountType')}
            onSuccess={handleSuccess}
          />
        )}
        {step === 'org' && (
          <OrgSetupStep
            email={email}
            onBack={() => setStep('accountType')}
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
      </Card>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  )
}
