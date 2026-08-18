'use client'

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { KeyRound, Search, Trash2 } from "lucide-react";
import type { ApprovalItem } from "@/lib/approvals";
import { ApprovalRow } from "@/components/ws/ApprovalRow";
import { en } from "@/locales/en";

interface Member {
  member_id: string
  email: string
  full_name: string | null
  role: string
  status: string
  added_at: string
  user_id: string | null
  employee_record_id: string | null
  employee_id: string | null
  designation: string | null
  department: string | null
  work_mode: string | null
  date_of_joining: string | null
  probation_end_date: string | null
}

const AVATAR_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4']
function avatarColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const WM_LABEL: Record<string, string> = { office: 'On-site', remote: 'Remote', hybrid: 'Hybrid' }

function empStatus(doj: string | null, probEnd: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (doj && new Date(doj) > today) return { label: 'Onboarding', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' }
  if (probEnd && new Date(probEnd) >= today) return { label: 'Probation', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' }
  return { label: 'Active', color: 'var(--teal)', bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' }
}

function formatDateOfJoining(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

      {/* Unified people table */}
      <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Header: title + search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 600, color: 'var(--navy)' }}>
            People ({pagination?.total ?? members.length})
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="search"
              placeholder="Search name or email"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              style={{ height: '36px', padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', background: 'var(--surface-0)', color: 'var(--text-primary)', outline: 'none', minWidth: '220px' }}
            />
            <button type="button" onClick={applySearch} title="Search" style={{ height: '36px', width: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-0)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Search size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '16px 20px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ ...skBase, width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...skBase, height: '13px', width: '160px', marginBottom: '6px' }} />
                  <div style={{ ...skBase, height: '11px', width: '120px' }} />
                </div>
                <div style={{ ...skBase, height: '11px', width: '100px' }} />
                <div style={{ ...skBase, height: '11px', width: '80px' }} />
                <div style={{ ...skBase, height: '20px', width: '60px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No members yet.</p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>Use the invite form above to add your team.</p>
          </div>
        ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Employee', 'Designation', 'Department', 'Work mode', 'Joined', 'Status', ''].map((h, idx) => (
                    <th key={idx} style={{ padding: '10px 16px', textAlign: idx === 6 ? 'right' : 'left', fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const name = m.full_name ?? m.email
                  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  const color = avatarColor(m.user_id ?? m.email)
                  const st = m.employee_record_id
                    ? empStatus(m.date_of_joining, m.probation_end_date)
                    : m.status === 'pending_consent'
                      ? { label: 'Invite sent', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' }
                      : m.status === 'declined'
                        ? { label: 'Declined', color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)' }
                        : { label: 'Active', color: 'var(--teal)', bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' }
                  return (
                    <tr key={m.member_id} style={{ borderBottom: i < members.length - 1 || loadingMore ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* Employee column — takes remaining space */}
                      <td style={{ padding: '12px 16px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#fff', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}>
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={m.user_id ? `/ws/${slug}/members/${m.user_id}` : '#'}
                              style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
                            >
                              {name}
                            </Link>
                            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {m.employee_id ?? m.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Designation */}
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', }}>{m.designation ?? '—'}</td>
                      {/* Department */}
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{m.department ?? '—'}</td>
                      {/* Work mode */}
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{m.work_mode ? (WM_LABEL[m.work_mode] ?? m.work_mode) : '—'}</td>
                      {/* Joined */}
                      <td style={{ padding: '12px 16px', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateOfJoining(m.date_of_joining)}</td>
                      {/* Status */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: st.color, background: st.bg, border: `1px solid ${st.color}`, borderRadius: '4px', padding: '2px 8px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                          {st.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {m.user_id && m.status === 'active' && !m.employee_record_id && (
                            <Link href={`/ws/${slug}/people/${m.user_id}/details`} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--brand)', textDecoration: 'none' }}>+ Set up</Link>
                          )}
                          {m.user_id && m.status === 'active' && m.employee_record_id && (
                            <Link href={`/ws/${slug}/people/${m.user_id}/details`} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>Edit</Link>
                          )}
                          {m.role !== 'admin' && m.status === 'active' && (
                            <button onClick={() => setTransferTarget(m)} title="Make owner" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <KeyRound size={13} /> Owner
                            </button>
                          )}
                          {m.role !== 'admin' && (
                            <button onClick={() => remove(m.member_id)} disabled={removingId === m.member_id} title="Remove" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: removingId === m.member_id ? 'not-allowed' : 'pointer', opacity: removingId === m.member_id ? 0.5 : 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {loadingMore && [1,2,3].map(k => (
                  <tr key={`sk-${k}`}>
                    <td colSpan={7} style={{ padding: '14px 16px', borderBottom: k < 3 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ ...skBase, width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ ...skBase, height: '13px', width: '160px' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>

      {canViewMore && (
        <div style={{ marginTop: '12px' }}>
          <button type="button" onClick={() => loadMembers({ append: true })} disabled={loadingMore} style={{ height: '44px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-0)', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer' }}>
            {loadingMore ? en.wsPeople.loadingMore : en.wsPeople.viewMore}
          </button>
        </div>
      )}

      <RegularizationRequestsSection slug={slug} />
    </div>
  );
}

// ─── Regularization requests (pending queue, echoed from the Approvals page) ──

function RegularizationRequestsSection({ slug }: { slug: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals?type=regularization`)
      if (res.ok) {
        const data = await res.json()
        setItems((data.items ?? []) as ApprovalItem[])
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  async function action(id: string, act: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/regularization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, rejection_reason: rejectionReason }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setDecliningId(null)
      }
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && items.length === 0) return null

  return (
    <div style={{ marginTop: '20px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', margin: 0 }}>{en.wsPeople.regularizationSectionTitle}</p>
        {!!items.length && (
          <span style={{ background: 'color-mix(in srgb, var(--amber) 16%, transparent)', color: '#9a6200', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>
            {items.length}
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ height: '52px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite' }} />
        </div>
      ) : (
        items.map((item) => (
          <ApprovalRow
            key={item.id}
            item={item}
            busy={busyId === item.id}
            declining={decliningId === item.id}
            onApprove={() => action(item.id, 'approve')}
            onDeclineStart={() => setDecliningId(item.id)}
            onDeclineCancel={() => setDecliningId(null)}
            onDeclineConfirm={(reason) => action(item.id, 'reject', reason)}
          />
        ))
      )}
    </div>
  )
}
