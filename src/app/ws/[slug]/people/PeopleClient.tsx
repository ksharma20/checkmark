'use client'

import { useState, useCallback, useEffect, useRef } from "react";
import { KeyRound, Search, Trash2 } from "lucide-react";
import { en } from "@/locales/en";

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
                {loading ? 'Sending code…' : 'Send verification code'}
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

export default function PeopleClient({ slug }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState<{
    nextOffset: number | null;
    total: number;
  } | null>(null);
  const paginationNextRef = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [email, setEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [transferTarget, setTransferTarget] = useState<Member | null>(null);

  const loadMembers = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append;
      if (append) setLoadingMore(true);
      else setLoading(true);

      if (!append) paginationNextRef.current = null;
      const nextOffset = append ? (paginationNextRef.current ?? 0) : 0;
      const res = await fetch(
        `/api/ws/${slug}/members?limit=10&offset=${nextOffset}&search=${encodeURIComponent(search)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const nextMembers = (data.members ?? []) as Member[];
        const nextCursor = data.pagination?.nextOffset ?? null;
        paginationNextRef.current = nextCursor;
        setMembers((prev) =>
          append ? [...prev, ...nextMembers] : nextMembers,
        );
        setPagination((prev) => ({
          nextOffset: nextCursor,
          total: data.total ?? prev?.total ?? 0,
        }));
      }
      if (append) setLoadingMore(false);
      else setLoading(false);
    },
    [slug, search],
  );

  useEffect(() => {
    setMembers([]);
    setPagination(null);
    paginationNextRef.current = null;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, search]);

  // useEffect(() => {
  //   const handle = window.setTimeout(() => {
  //     const next = searchDraft.trim();
  //     if (next !== search) setSearch(next);
  //   }, 300);
  //   return () => window.clearTimeout(handle);
  // }, [searchDraft, search]);

  function applySearch() {
    const next = searchDraft.trim();
    if (next !== search) setSearch(next);
  }

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

  const skBase: React.CSSProperties = {
    background:
      "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)",
    backgroundSize: "600px 100%",
    animation: "shimmer 1.4s ease-in-out infinite",
    borderRadius: "6px",
  };

  const canViewMore = pagination?.nextOffset != null;

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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
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
        </div>
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
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
            Members ({pagination?.total ?? members.length})
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="search"
              placeholder="Search name or email"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              style={{
                height: "36px",
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                fontFamily: "DM Sans, sans-serif",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                outline: "none",
                minWidth: "220px",
                flex: "0 1 260px",
              }}
            />
            <button
              type="button"
              onClick={applySearch}
              title="Apply search"
              style={{
                height: "36px",
                width: "36px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "16px 20px" }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 0",
                  borderBottom: i < 3 ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    ...skBase,
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      ...skBase,
                      height: "13px",
                      width: "140px",
                      marginBottom: "6px",
                    }}
                  />
                  <div style={{ ...skBase, height: "11px", width: "180px" }} />
                </div>
                <div
                  style={{
                    ...skBase,
                    height: "20px",
                    width: "48px",
                    borderRadius: "4px",
                  }}
                />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "15px",
                color: "var(--text-secondary)",
                marginBottom: "4px",
              }}
            >
              No members yet.
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Use the invite form above to add your team.
            </p>
          </div>
        ) : (
          <>
            {members.map((m, i) => (
              <div
                key={m.member_id}
                className="member-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 20px",
                  borderBottom:
                    i < members.length - 1 || loadingMore
                      ? "1px solid var(--border)"
                      : "none",
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

                {/* Role + Status + Actions - wraps below name on mobile */}
                <div
                  className="member-meta"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "DM Sans, sans-serif",
                      color: "var(--text-muted)",
                    }}
                  >
                    {m.role}
                  </span>

                  <span className="member-status-badge">
                    {statusBadge(m.status)}
                  </span>
                  <span
                    className="member-status-dot"
                    title={
                      m.status === "active"
                        ? "Active"
                        : m.status === "pending_consent"
                          ? "Invite sent"
                          : "Declined"
                    }
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      background:
                        m.status === "active"
                          ? "var(--teal)"
                          : m.status === "pending_consent"
                            ? "var(--amber)"
                            : "var(--danger)",
                      display: "none",
                    }}
                  />

                  {m.role !== "admin" && m.status === "active" && (
                    <button
                      onClick={() => setTransferTarget(m)}
                      title="Make owner"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)",
                        fontSize: "11px",
                        fontFamily: "DM Sans, sans-serif",
                        cursor: "pointer",
                        padding: "3px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <KeyRound className="member-btn-icon" size={14} />
                      <span className="member-btn-label">Make owner</span>
                    </button>
                  )}

                  {m.role !== "admin" && (
                    <button
                      onClick={() => remove(m.member_id)}
                      disabled={removingId === m.member_id}
                      title="Remove member"
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger)",
                        fontSize: "12px",
                        fontFamily: "DM Sans, sans-serif",
                        cursor:
                          removingId === m.member_id
                            ? "not-allowed"
                            : "pointer",
                        padding: "0 4px",
                        opacity: removingId === m.member_id ? 0.5 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Trash2 className="member-btn-icon" size={13} />
                      <span className="member-btn-label">Remove</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loadingMore &&
              [1, 2, 3].map((k) => (
                <div
                  key={`sk-more-${k}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 20px",
                    borderBottom: k < 3 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div
                    style={{
                      ...skBase,
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        ...skBase,
                        height: "13px",
                        width: "140px",
                        marginBottom: "6px",
                      }}
                    />
                    <div
                      style={{ ...skBase, height: "11px", width: "180px" }}
                    />
                  </div>
                  <div
                    style={{
                      ...skBase,
                      height: "20px",
                      width: "48px",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              ))}
          </>
        )}
      </div>

      {canViewMore && (
        <div style={{ marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => loadMembers({ append: true })}
            disabled={loadingMore}
            style={{
              height: "44px",
              width: "100%",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loadingMore ? "default" : "pointer",
            }}
          >
            {loadingMore ? en.wsPeople.loadingMore : en.wsPeople.viewMore}
          </button>
        </div>
      )}
    </div>
  );
}
