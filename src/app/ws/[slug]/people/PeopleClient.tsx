'use client'

import { useState, useCallback, useEffect } from 'react'

interface Member {
  member_id: string
  email: string
  full_name: string | null
  role: string
  status: string
  added_at: string
}

interface Props {
  slug: string
  currentUserId: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

function statusBadge(status: string) {
  const styles: Record<string, React.CSSProperties> = {
    active: {
      color: 'var(--teal)',
      background: 'color-mix(in srgb, var(--teal) 12%, transparent)',
      border: '1px solid var(--teal)',
    },
    pending_consent: {
      color: 'var(--amber)',
      background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
      border: '1px solid var(--amber)',
    },
    declined: {
      color: 'var(--danger)',
      background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
      border: '1px solid var(--danger)',
    },
  }
  const label: Record<string, string> = {
    active: 'Active',
    pending_consent: 'Invite sent',
    declined: 'Declined',
  }
  return (
    <span
      style={{
        fontSize: '11px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        borderRadius: '4px',
        padding: '2px 7px',
        ...(styles[status] ?? { color: 'var(--text-muted)', border: '1px solid var(--border)' }),
      }}
    >
      {label[status] ?? status}
    </span>
  )
}

// ─── Transfer Ownership Modal ─────────────────────────────────────────────────

interface TransferModalProps {
  slug: string
  target: Member
  onDone: () => void
  onCancel: () => void
}

function TransferOwnershipModal({ slug, target, onDone, onCancel }: TransferModalProps) {
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm')
  const [code, setCode] = useState('')
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function requestOtp() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', targetMemberId: target.member_id }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdminEmail(data.email)
        setStep('otp')
      } else {
        setError(data.error || 'Failed to send verification code')
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmTransfer() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', targetMemberId: target.member_id, code: code.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(`Ownership transferred to ${data.new_admin}. You are now a member.`)
        setTimeout(() => {
          onDone()
          window.location.href = '/ws'
        }, 2000)
      } else {
        setError(data.error || 'Transfer failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        maxWidth: '420px',
        width: '100%',
      }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
          Transfer ownership
        </h2>

        {success ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--teal)', lineHeight: 1.5 }}>
            {success}
          </p>
        ) : step === 'confirm' ? (
          <>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              You are about to transfer admin ownership of this workspace to{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{target.full_name ?? target.email}</strong>.
              You will become a regular member. This action requires verification.
            </p>
            {error && (
              <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={requestOtp}
                disabled={loading}
                style={{
                  flex: 1, height: '44px',
                  background: 'var(--danger)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-md)', fontSize: '14px',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Sending code…' : 'Continue — send verification code'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '44px', padding: '0 16px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Enter the 6-digit code sent to <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong> to confirm the transfer.
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && confirmTransfer()}
              style={{ ...inputStyle, marginBottom: '12px', letterSpacing: '0.15em', fontSize: '18px', textAlign: 'center' }}
              autoFocus
            />
            {error && (
              <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={confirmTransfer}
                disabled={loading || code.length < 6}
                style={{
                  flex: 1, height: '44px',
                  background: 'var(--danger)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-md)', fontSize: '14px',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                  cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer',
                  opacity: (loading || code.length < 6) ? 0.7 : 1,
                }}
              >
                {loading ? 'Transferring…' : 'Confirm transfer'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '44px', padding: '0 16px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PeopleClient({ slug, currentUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/members`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function invite() {
    const e = email.trim().toLowerCase()
    if (!e) return
    setInviting(true)
    setInviteStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmail('')
        setInviteStatus({ text: `Invite sent to ${e}`, ok: true })
        await loadMembers()
      } else {
        setInviteStatus({ text: data.error || 'Failed to send invite', ok: false })
      }
    } finally {
      setInviting(false)
    }
  }

  async function remove(memberId: string) {
    if (!confirm('Remove this member?')) return
    setRemovingId(memberId)
    const res = await fetch(`/api/ws/${slug}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.member_id !== memberId))
    }
    setRemovingId(null)
  }

  if (loading) {
    return (
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', padding: '40px 0', textAlign: 'center' }}>
        Loading…
      </p>
    )
  }

  const isAdmin = members.find(
    (m) => m.role === "admin" && m.member_id === currentUserId,
  );

  return (
    <div>
      {transferTarget && (
        <TransferOwnershipModal
          slug={slug}
          target={transferTarget}
          onDone={() => setTransferTarget(null)}
          onCancel={() => setTransferTarget(null)}
        />
      )}

      {/* Invite row */}
      <div
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--navy)",
            marginBottom: "12px",
          }}
        >
          Invite someone
        </h2>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          They&apos;ll receive an email with an accept/decline link. Their
          presence data only flows to this workspace after they accept.
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            onKeyDown={(e) => e.key === "Enter" && invite()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={invite}
            disabled={inviting}
            style={{
              height: "40px",
              padding: "0 16px",
              background: "var(--brand)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 500,
              cursor: inviting ? "not-allowed" : "pointer",
              opacity: inviting ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {inviting ? "…" : "Send invite"}
          </button>
        </div>
        {inviteStatus && (
          <p
            style={{
              marginTop: "8px",
              fontSize: "13px",
              fontFamily: "DM Sans, sans-serif",
              color: inviteStatus.ok ? "var(--teal)" : "var(--danger)",
            }}
          >
            {inviteStatus.text}
          </p>
        )}
      </div>

      {/* Member list */}
      <div
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--navy)",
            }}
          >
            Members ({members.length})
          </h2>
        </div>

        {members.length === 0 ? (
          <p
            style={{
              padding: "32px 20px",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No members yet.
          </p>
        ) : (
          members.map((m, i) => (
            <div
              key={m.member_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 20px",
                borderBottom:
                  i < members.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background:
                    "color-mix(in srgb, var(--brand) 15%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: 600,
                  color: "var(--brand)",
                  flexShrink: 0,
                }}
              >
                {(m.full_name ?? m.email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {m.full_name ?? m.email}
                </div>
                {m.full_name && (
                  <div
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.email}
                  </div>
                )}
              </div>

              {/* Role */}
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "DM Sans, sans-serif",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                {m.role}
              </span>

              {/* Status badge */}
              <div style={{ flexShrink: 0 }}>{statusBadge(m.status)}</div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {/* Transfer ownership — only for active non-admin members, shown only to current admin */}
                {m.role !== "admin" && m.status === "active" && (
                  <button
                    onClick={() => setTransferTarget(m)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      fontFamily: "DM Sans, sans-serif",
                      cursor: "pointer",
                      padding: "3px 8px",
                    }}
                  >
                    Make owner
                  </button>
                )}

                {/* Remove */}
                {m.role !== "admin" && (
                  <button
                    onClick={() => remove(m.member_id)}
                    disabled={removingId === m.member_id}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger)",
                      fontSize: "12px",
                      fontFamily: "DM Sans, sans-serif",
                      cursor:
                        removingId === m.member_id ? "not-allowed" : "pointer",
                      padding: "0 4px",
                      opacity: removingId === m.member_id ? 0.5 : 1,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
