'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { en } from '@/locales/en'

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '16px',
      }}
    >
      <h2
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--navy)',
          marginBottom: '16px',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

function FieldInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          fontFamily: 'DM Sans, sans-serif',
          marginBottom: '5px',
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 12px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontFamily: 'DM Sans, sans-serif',
          background: 'var(--surface-2)',
          color: 'var(--text-primary)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function Btn({
  children,
  onClick,
  loading,
  variant = 'primary',
  danger,
}: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  variant?: 'primary' | 'outline'
  danger?: boolean
}) {
  const bg = danger ? 'var(--danger)' : variant === 'primary' ? 'var(--brand)' : 'transparent'
  const color = variant === 'primary' || danger ? '#fff' : 'var(--text-secondary)'
  const border = variant === 'outline' && !danger ? '1px solid var(--border)' : 'none'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        height: '44px',
        padding: '0 20px',
        background: bg,
        color,
        border,
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

function StatusMsg({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <p
      style={{
        fontSize: '13px',
        fontFamily: 'DM Sans, sans-serif',
        color: msg.ok ? 'var(--teal)' : 'var(--danger)',
        marginTop: '8px',
      }}
    >
      {msg.text}
    </p>
  )
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setFullName(d.user?.fullName ?? '')
        setEmail(d.user?.email ?? '')
      })
      .catch(() => {})
  }, [])

  async function save() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      })
      setStatus(res.ok ? { text: 'Name updated', ok: true } : { text: 'Update failed', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Profile">
      {email && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', marginBottom: '5px' }}>
            Email
          </label>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-primary)', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            {email}
          </p>
        </div>
      )}
      <FieldInput label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" />
      <Btn onClick={save} loading={loading}>
        Save
      </Btn>
      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Email change section ──────────────────────────────────────────────────────

function EmailSection() {
  const [step, setStep] = useState<'idle' | 'otp'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  async function requestOtp() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setStep('otp')
        setStatus({ text: `Verification code sent to ${newEmail}`, ok: true })
      } else {
        setStatus({ text: data.error || 'Failed to send code', ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmChange() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, code }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ text: 'Email updated. Please log in again.', ok: true })
        setTimeout(() => { window.location.href = '/login' }, 1500)
      } else {
        setStatus({ text: data.error || 'Verification failed', ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Change email">
      <FieldInput
        label="New email address"
        type="email"
        value={newEmail}
        onChange={(v) => { setNewEmail(v); setStep('idle'); setStatus(null) }}
        placeholder="new@example.com"
      />
      {step === 'idle' && (
        <Btn onClick={requestOtp} loading={loading}>
          Send verification code
        </Btn>
      )}
      {step === 'otp' && (
        <>
          <FieldInput label="Verification code" value={code} onChange={setCode} placeholder="6-digit code" />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn onClick={confirmChange} loading={loading}>
              Confirm change
            </Btn>
            <Btn variant="outline" onClick={() => { setStep('idle'); setCode(''); setStatus(null) }}>
              Resend
            </Btn>
          </div>
        </>
      )}
      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  async function changePassword() {
    setStatus(null)
    if (next !== confirm) {
      setStatus({ text: 'New passwords do not match', ok: false })
      return
    }
    if (next.length < 8) {
      setStatus({ text: 'Password must be at least 8 characters', ok: false })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      if (res.ok) {
        setStatus({ text: 'Password changed', ok: true })
        setCurrent('')
        setNext('')
        setConfirm('')
      } else {
        const data = await res.json()
        setStatus({ text: data.error || 'Failed', ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Password">
      <FieldInput label="Current password" type="password" value={current} onChange={setCurrent} />
      <FieldInput label="New password" type="password" value={next} onChange={setNext} placeholder="At least 8 characters" />
      <FieldInput label="Confirm new password" type="password" value={confirm} onChange={setConfirm} />
      <Btn onClick={changePassword} loading={loading}>
        Change password
      </Btn>
      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── API Tokens section ───────────────────────────────────────────────────────

interface ApiToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

function TokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => {})
  }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    setStatus(null)
    setNewToken(null)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setTokens((prev) => [data.token, ...prev])
        setNewToken(data.plain_token)
        setNewName('')
      } else {
        setStatus({ text: data.error || 'Failed', ok: false })
      }
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this token? Any apps using it will stop working.')) return
    const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    if (res.ok) setTokens((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <SectionCard title="API Tokens">
      <p
        style={{
          fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--text-secondary)',
          marginBottom: '14px',
        }}
      >
        Use tokens to record check-ins from scripts or third-party tools.
      </p>

      {/* New token revealed */}
      {newToken && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--teal) 10%, transparent)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              fontSize: '12px',
              color: 'var(--teal)',
              fontFamily: 'DM Sans, sans-serif',
              marginBottom: '6px',
            }}
          >
            Copy this token now — it won&apos;t be shown again.
          </p>
          <code
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
            }}
          >
            {newToken}
          </code>
        </div>
      )}

      {/* Create token */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Token name (e.g. Home Mac)"
          onKeyDown={(e) => e.key === 'Enter' && create()}
          style={{
            flex: 1,
            height: '40px',
            padding: '0 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
            background: 'var(--surface-2)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <Btn onClick={create} loading={creating}>
          Create
        </Btn>
      </div>
      <StatusMsg msg={status} />

      {/* Token list */}
      {tokens.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>
          No tokens yet.
        </p>
      ) : (
        tokens.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-primary)' }}>
                {t.name}
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                Created {new Date(t.created_at).toLocaleDateString()}
                {t.last_used_at && ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={() => revoke(t.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontSize: '12px',
                fontFamily: 'DM Sans, sans-serif',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Revoke
            </button>
          </div>
        ))
      )}
    </SectionCard>
  )
}

// ─── Organisation features section ────────────────────────────────────────────

function OrgSection() {
  const [activeWs, setActiveWs] = useState<{ id: string; slug: string; name: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/workspace')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setActiveWs(d.active ?? []) })
      .catch(() => setActiveWs([]))
  }, [])

  // Still loading — render nothing to avoid flash
  if (activeWs === null) return null

  // Has active workspace — don't show "Switch" prompt
  if (activeWs.length > 0) return null

  return (
    <SectionCard title="Organisation features">
      <p
        style={{
          fontSize: "13px",
          fontFamily: "DM Sans, sans-serif",
          color: "var(--text-secondary)",
          marginBottom: "16px",
          lineHeight: 1.5,
        }}
      >
        Switch to an organisation account to manage your team&apos;s attendance,
        view dashboards, and configure location signals for your workspace.
      </p>
      <Link
        href="/ws"
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: "44px",
          padding: "0 20px",
          background: "var(--brand)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-md)",
          fontSize: "14px",
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Switch to organisation account →
      </Link>
    </SectionCard>
  )
}

// ─── Logout section ───────────────────────────────────────────────────────────

function LogoutSection() {
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <SectionCard title="Session">
      <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
        {en.auth.sessionLogoutText}
      </p>
      <Btn onClick={logout} loading={loading} variant="outline">
        Sign out
      </Btn>
    </SectionCard>
  )
}

// ─── Danger zone (collapsed accordion) ────────────────────────────────────────

function DeactivateCard() {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [blockedBy, setBlockedBy] = useState<
    { slug: string; name: string }[] | null
  >(null);

  async function deactivateAccount() {
    setLoading(true);
    setBlockedBy(null);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/login";
      } else if (res.status === 409) {
        const data = await res.json();
        setBlockedBy(data.workspaces ?? []);
        setConfirming(false);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px",
        background: "color-mix(in srgb, var(--danger) 4%, transparent)",
      }}
    >
      <p
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 4px",
        }}
      >
        Deactivate account
      </p>
      <p
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          margin: "0 0 12px",
        }}
      >
        Your check-ins and data are preserved — your account becomes invisible
        to all workspaces. You can reactivate anytime by logging back in.
      </p>

      {/* Sole-admin blocker */}
      {blockedBy && blockedBy.length > 0 && (
        <div
          style={{
            background: "color-mix(in srgb, var(--amber) 10%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--amber) 40%, transparent)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
            marginBottom: "12px",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 4px",
            }}
          >
            You&apos;re the only admin of{" "}
            {blockedBy.length === 1
              ? "this workspace"
              : `${blockedBy.length} workspaces`}
            .
          </p>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              margin: "0 0 8px",
            }}
          >
            For each active workspace below, either promote another member to
            admin or archive it first. Archived workspaces don&apos;t block
            deactivation.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {blockedBy.map((ws) => (
              <div
                key={ws.slug}
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                <a
                  href={`/ws/${ws.slug}/people`}
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "12px",
                    color: "var(--brand)",
                    textDecoration: "none",
                  }}
                >
                  {ws.name} — promote admin
                </a>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  or
                </span>
                <a
                  href={`/ws/${ws.slug}/settings`}
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                  }}
                >
                  archive workspace
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            height: "34px",
            padding: "0 14px",
            border:
              "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            color: "var(--danger)",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Deactivate account
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "var(--danger)",
              margin: 0,
            }}
          >
            Are you sure? This will sign you out immediately.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              disabled={loading}
              onClick={deactivateAccount}
              style={{
                height: "34px",
                padding: "0 14px",
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Deactivating…" : "Yes, deactivate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              style={{
                height: "34px",
                padding: "0 14px",
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerSection() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Accordion trigger — intentionally quiet */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: open
            ? "var(--radius-md) var(--radius-md) 0 0"
            : "var(--radius-md)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
          }}
        >
          Danger zone
        </span>
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            display: "inline-block",
            lineHeight: 1,
          }}
        >
          ›
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderTop: "none",
            borderRadius: "0 0 var(--radius-md) var(--radius-md)",
            padding: "14px",
            background: "var(--surface-0)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <DeactivateCard />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
      <h1
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: "22px",
          fontWeight: 700,
          color: "var(--navy)",
          marginBottom: "20px",
        }}
      >
        Settings
      </h1>
      <ProfileSection />
      <EmailSection />
      <PasswordSection />
      <TokensSection />
      <OrgSection />
      <LogoutSection />
      <DangerSection />
    </div>
  );
}

