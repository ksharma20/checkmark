'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'email' | 'password' | 'otp' | 'accountType' | 'personal' | 'org' | 'deactivated'

// ─── Shared primitives ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '12px',
        fontFamily: 'DM Sans, sans-serif',
        color: 'var(--text-secondary)',
        marginBottom: '5px',
      }}
    >
      {children}
    </label>
  )
}

function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
  onKeyDown,
}: {
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      style={{
        width: '100%',
        height: '48px',
        padding: '0 14px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        fontSize: '15px',
        fontFamily: 'DM Sans, sans-serif',
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

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
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: '100%',
        height: '48px',
        padding: '0 24px',
        background: 'var(--brand)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: '15px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--text-secondary)',
        fontSize: '13px',
        fontFamily: 'DM Sans, sans-serif',
        cursor: 'pointer',
        padding: '0',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      ← Back
    </button>
  )
}

function ErrorMsg({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p
      style={{
        fontSize: '13px',
        fontFamily: 'DM Sans, sans-serif',
        color: 'var(--danger)',
        marginTop: '10px',
      }}
    >
      {text}
    </p>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <Label>{label}</Label>
      {children}
    </div>
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

  async function proceed() {
    const e = email.toLowerCase().trim()
    if (!e || !e.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError(null)
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
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '8px',
        }}
      >
        Welcome to CheckMark
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '28px',
        }}
      >
        Enter your email to sign in or create an account.
      </p>
      <FieldGroup label="Email address">
        <Input
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && proceed()}
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
}: {
  email: string
  onBack: () => void
  onSuccess: (redirect: string) => void
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
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        Sign in
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}
      >
        {email}
      </p>
      <FieldGroup label="Password">
        <Input
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && signIn()}
        />
      </FieldGroup>
      <PrimaryBtn onClick={signIn} loading={loading}>
        Sign in
      </PrimaryBtn>
      <ErrorMsg text={error} />
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
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
        Account deactivated
      </h1>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
        {email}
      </p>
      <div style={{
        background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
        border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        marginBottom: '20px',
        fontSize: '13px',
        fontFamily: 'DM Sans, sans-serif',
        color: 'var(--text-secondary)',
        lineHeight: 1.5,
      }}>
        This account was deactivated. Your data is intact — enter your password to reactivate and sign in.
      </div>
      <FieldGroup label="Password">
        <Input
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="Your password"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && reactivate()}
        />
      </FieldGroup>
      <PrimaryBtn onClick={reactivate} loading={loading}>
        Reactivate account
      </PrimaryBtn>
      <ErrorMsg text={error} />
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
    }
  }

  async function resend() {
    setResending(true)
    setResendMsg(null)
    setError(null)
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
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        Check your inbox
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}
      >
        We sent a 6-digit code to <strong>{email}</strong>
      </p>
      <FieldGroup label="Verification code">
        <Input
          type="text"
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && verify()}
        />
      </FieldGroup>
      <PrimaryBtn onClick={verify} loading={loading}>
        Verify
      </PrimaryBtn>
      <ErrorMsg text={error} />
      {resendMsg && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--teal)',
            fontFamily: 'DM Sans, sans-serif',
            marginTop: '10px',
          }}
        >
          {resendMsg}
        </p>
      )}
      <button
        type="button"
        onClick={resend}
        disabled={resending}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif',
          cursor: 'pointer',
          padding: '0',
          marginTop: '14px',
          display: 'block',
        }}
      >
        {resending ? 'Sending…' : 'Resend code'}
      </button>
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
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '8px',
        }}
      >
        How will you use CheckMark?
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '28px',
        }}
      >
        Choose the type of account to set up.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

function AccountTypeCard({
  title,
  description,
  onClick,
}: {
  title: string
  description: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface-0)',
        border: `1px solid ${hovered ? 'var(--brand)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        textAlign: 'left',
        cursor: 'pointer',
        width: '100%',
        transition: 'border-color 0.15s',
      }}
    >
      <p
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        {description}
      </p>
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
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName: fullName.trim(),
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
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        Create your account
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}
      >
        {email}
      </p>

      <FieldGroup label="Your name">
        <Input value={fullName} onChange={setFullName} placeholder="Jane Doe" autoFocus />
      </FieldGroup>
      <FieldGroup label="Password">
        <Input
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password">
        <Input
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
  const hints: Record<SlugStatus, { text: string; color: string }> = {
    idle: { text: 'Lowercase letters, numbers, hyphens', color: 'var(--text-muted)' },
    checking: { text: 'Checking availability…', color: 'var(--text-secondary)' },
    available: { text: '✓ Available', color: 'var(--teal)' },
    taken: { text: '✗ Already taken', color: 'var(--danger)' },
    invalid: { text: 'Only lowercase letters, numbers and hyphens', color: 'var(--amber)' },
  }
  const hint = hints[status]
  return (
    <p
      style={{
        fontSize: '12px',
        fontFamily: 'DM Sans, sans-serif',
        color: hint.color,
        marginTop: '5px',
      }}
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
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName: fullName.trim(),
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
    }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '4px',
        }}
      >
        Set up your organisation
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}
      >
        {email}
      </p>

      {/* Org section */}
      <p
        style={{
          fontSize: '11px',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '12px',
        }}
      >
        Organisation
      </p>

      <FieldGroup label="Organisation name">
        <Input value={orgName} onChange={handleOrgName} placeholder="Acme Corp" autoFocus />
      </FieldGroup>

      <div style={{ marginBottom: '16px' }}>
        <Label>URL handle</Label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
            overflow: 'hidden',
            height: '48px',
          }}
        >
          <span
            style={{
              padding: '0 10px',
              fontSize: '13px',
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-secondary)',
              borderRight: '1px solid var(--border)',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              background: 'var(--surface-1)',
              flexShrink: 0,
            }}
          >
            /ws/
          </span>
          <input
            type="text"
            value={orgSlug}
            onChange={(e) =>
              setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }
            placeholder="acme-corp"
            style={{
              flex: 1,
              height: '100%',
              border: 'none',
              outline: 'none',
              padding: '0 12px',
              fontSize: '14px',
              fontFamily: 'JetBrains Mono, monospace',
              background: 'transparent',
              color: 'var(--text-primary)',
              minWidth: 0,
            }}
          />
        </div>
        <SlugHint status={slugStatus} />
      </div>

      <FieldGroup label="Company email domain (optional)">
        <Input value={orgDomain} onChange={setOrgDomain} placeholder="acme.com" />
      </FieldGroup>
      <p
        style={{
          fontSize: '12px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--text-muted)',
          marginTop: '-10px',
          marginBottom: '20px',
        }}
      >
        Employees with this domain are auto-enrolled when they sign up.
      </p>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 20px' }} />

      {/* Personal section */}
      <p
        style={{
          fontSize: '11px',
          fontFamily: 'Syne, sans-serif',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '12px',
        }}
      >
        Your account
      </p>

      <FieldGroup label="Your name">
        <Input value={fullName} onChange={setFullName} placeholder="Jane Doe" />
      </FieldGroup>
      <FieldGroup label="Password">
        <Input
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password">
        <Input
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

  function handleSuccess(redirect: string) {
    const invite = searchParams.get('invite')
    if (invite) {
      router.push(`/join/${invite}`)
    } else {
      router.push(redirect)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-1)',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--surface-0)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
        }}
      >
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
          />
        )}
        {step === 'otp' && (
          <OtpStep
            email={email}
            onBack={() => setStep('email')}
            onVerified={() => setStep('accountType')}
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
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  )
}
