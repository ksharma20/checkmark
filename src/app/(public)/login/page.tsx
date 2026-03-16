'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'email' | 'password' | 'otp' | 'setup'

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        height: '48px',
        padding: '0 14px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
        fontSize: '15px',
        fontFamily: 'DM Sans, sans-serif',
        outline: 'none',
        boxSizing: 'border-box',
        ...props.style,
      }}
    />
  )
}

function Button({
  children,
  loading,
  variant = 'primary',
  type = 'submit',
  onClick,
  disabled,
}: {
  children: React.ReactNode
  loading?: boolean
  variant?: 'primary' | 'ghost'
  type?: 'submit' | 'button'
  onClick?: () => void
  disabled?: boolean
}) {
  const isPrimary = variant === 'primary'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: '100%',
        height: '48px',
        background: isPrimary ? 'var(--brand)' : 'transparent',
        color: isPrimary ? '#fff' : 'var(--text-secondary)',
        border: isPrimary ? 'none' : '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '15px',
        fontWeight: 600,
        fontFamily: 'DM Sans, sans-serif',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.7 : 1,
        transition: 'background 0.15s',
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null
  return (
    <p
      style={{
        color: 'var(--danger)',
        fontSize: '13px',
        margin: '8px 0 0',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {message}
    </p>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        cursor: 'pointer',
        padding: '0',
        marginBottom: '20px',
        fontFamily: 'DM Sans, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      ← Back
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-secondary)',
        marginBottom: '6px',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {children}
    </label>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: 'Syne, sans-serif',
        fontSize: '22px',
        fontWeight: 700,
        color: 'var(--navy)',
        margin: '0 0 6px',
      }}
    >
      {children}
    </h1>
  )
}

function Subtext({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: 'var(--text-secondary)',
        fontSize: '14px',
        margin: '0 0 24px',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {children}
    </p>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

function EmailStep({
  email,
  setEmail,
  error,
  loading,
  onSubmit,
}: {
  email: string
  setEmail: (v: string) => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <Heading>Welcome to CheckMark</Heading>
      <Subtext>Enter your email to continue.</Subtext>
      <div style={{ marginBottom: '16px' }}>
        <Label>Email address</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
          autoComplete="email"
        />
        <ErrorMessage message={error} />
      </div>
      <Button loading={loading}>Continue</Button>
    </form>
  )
}

function PasswordStep({
  email,
  password,
  setPassword,
  error,
  loading,
  onSubmit,
  onBack,
}: {
  email: string
  password: string
  setPassword: (v: string) => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <BackButton onClick={onBack} />
      <Heading>Welcome back</Heading>
      <Subtext>
        Signing in as{' '}
        <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{email}</span>
      </Subtext>
      <div style={{ marginBottom: '16px' }}>
        <Label>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
          autoFocus
          autoComplete="current-password"
        />
        <ErrorMessage message={error} />
      </div>
      <Button loading={loading}>Sign in</Button>
      <p
        style={{
          textAlign: 'center',
          marginTop: '16px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Forgot your password?{' '}
        <span style={{ color: 'var(--text-secondary)' }}>Contact support.</span>
      </p>
    </form>
  )
}

function OtpStep({
  email,
  otp,
  setOtp,
  error,
  loading,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string
  otp: string
  setOtp: (v: string) => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onResend: () => void
  onBack: () => void
}) {
  const [resent, setResent] = useState(false)

  function handleResend() {
    onResend()
    setResent(true)
    setTimeout(() => setResent(false), 30000)
  }

  return (
    <form onSubmit={onSubmit}>
      <BackButton onClick={onBack} />
      <Heading>Check your inbox</Heading>
      <Subtext>
        We sent a 6-digit code to{' '}
        <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{email}</span>
      </Subtext>
      <div style={{ marginBottom: '16px' }}>
        <Label>Verification code</Label>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          required
          autoFocus
          autoComplete="one-time-code"
          style={{
            letterSpacing: '6px',
            fontSize: '22px',
            fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'center',
          }}
        />
        <ErrorMessage message={error} />
      </div>
      <Button loading={loading} disabled={otp.length !== 6}>
        Verify code
      </Button>
      <p
        style={{
          textAlign: 'center',
          marginTop: '16px',
          fontSize: '13px',
          color: 'var(--text-muted)',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {resent ? (
          <span style={{ color: 'var(--teal)' }}>Code resent!</span>
        ) : (
          <>
            Didn&apos;t receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand)',
                cursor: 'pointer',
                fontSize: '13px',
                padding: 0,
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Resend code
            </button>
          </>
        )}
      </p>
    </form>
  )
}

function SetupStep({
  fullName,
  setFullName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  loading,
  onSubmit,
}: {
  fullName: string
  setFullName: (v: string) => void
  password: string
  setPassword: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  error: string
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit}>
      <Heading>Create your account</Heading>
      <Subtext>Almost there. Set up your profile and choose a password.</Subtext>
      <div style={{ marginBottom: '12px' }}>
        <Label>Full name</Label>
        <Input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          required
          autoFocus
          autoComplete="name"
        />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <Label>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          autoComplete="new-password"
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <Label>Confirm password</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
          required
          autoComplete="new-password"
        />
        <ErrorMessage message={error} />
      </div>
      <Button loading={loading}>Create account</Button>
    </form>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function LoginSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-1)',
      }}
    />
  )
}

// ─── Main form (uses useSearchParams — must be inside Suspense) ───────────────

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invite = searchParams.get('invite')

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pre-fill email from URL param (e.g. ?email=...)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(emailParam)
  }, [searchParams])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }
      if (data.exists) {
        setStep('password')
      } else {
        const otpRes = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const otpData = await otpRes.json()
        if (!otpRes.ok) {
          setError(otpData.error || 'Failed to send verification code')
          return
        }
        setStep('otp')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid credentials')
        return
      }
      router.push(data.redirect || '/me')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid or expired code')
        return
      }
      setStep('setup')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          password: newPassword,
          otpVerified: true,
          invite,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }
      router.push(data.redirect || '/me')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    try {
      await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // silently ignore
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-1)',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '26px',
              fontWeight: 700,
              color: 'var(--brand)',
            }}
          >
            CheckMark
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
          }}
        >
          {step === 'email' && (
            <EmailStep
              email={email}
              setEmail={setEmail}
              error={error}
              loading={loading}
              onSubmit={handleEmailSubmit}
            />
          )}
          {step === 'password' && (
            <PasswordStep
              email={email}
              password={password}
              setPassword={setPassword}
              error={error}
              loading={loading}
              onSubmit={handlePasswordSubmit}
              onBack={() => { setStep('email'); setError('') }}
            />
          )}
          {step === 'otp' && (
            <OtpStep
              email={email}
              otp={otp}
              setOtp={setOtp}
              error={error}
              loading={loading}
              onSubmit={handleOtpSubmit}
              onResend={handleResendOtp}
              onBack={() => { setStep('email'); setError(''); setOtp('') }}
            />
          )}
          {step === 'setup' && (
            <SetupStep
              fullName={fullName}
              setFullName={setFullName}
              password={newPassword}
              setPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              error={error}
              loading={loading}
              onSubmit={handleSetupSubmit}
            />
          )}
        </div>

        {/* Progress dots */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '24px',
          }}
        >
          {(['email', 'password', 'otp', 'setup'] as Step[]).map((s) => {
            const steps: Step[] = ['email', 'password', 'otp', 'setup']
            const currentIdx = steps.indexOf(step)
            const dotIdx = steps.indexOf(s)
            const active = s === step
            const done = dotIdx < currentIdx

            // Skip password/otp dots — show only the current relevant ones
            if (s === 'password' || s === 'otp') return null

            return (
              <div
                key={s}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: active || done ? 'var(--brand)' : 'var(--border)',
                  opacity: active ? 1 : done ? 0.5 : 1,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
