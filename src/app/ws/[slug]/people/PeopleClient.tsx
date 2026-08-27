'use client'

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Lock, Search, Trash2 } from "lucide-react";
import type { ApprovalItem } from "@/lib/approvals";
import { ApprovalRow } from "@/components/ws/ApprovalRow";
import { en } from "@/locales/en";
import { canManage } from '@/lib/permissions/ranks'

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

interface RoleOption {
  key: string
  name: string
  description: string | null
  /**
   * Not a plain role assignment. Today only `owner`, which routes into the
   * OTP-gated transfer flow rather than PATCH .../role. Rendered greyed with a
   * padlock so it reads as special before it is picked.
   */
  restricted?: boolean
}

/**
 * What the VIEWER may do, resolved server-side from their role grid and
 * returned by GET /api/ws/[slug]/members. Deny-by-default until it loads, so
 * an owner-only action never flashes for an admin on first paint.
 */
interface ViewerPermissions {
  transferOwnership: boolean
  removeMembers: boolean
}

const AVATAR_COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4']
function avatarColor(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const WM_LABEL: Record<string, string> = {
  office: en.wsPeople.workModeOffice,
  remote: en.wsPeople.workModeRemote,
  hybrid: en.wsPeople.workModeHybrid,
}

function empStatus(doj: string | null, probEnd: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (doj && new Date(doj) > today) return { label: en.wsPeople.statusOnboarding, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' }
  if (probEnd && new Date(probEnd) >= today) return { label: en.wsPeople.statusProbation, color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' }
  return { label: en.wsPeople.statusActive, color: 'var(--teal)', bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' }
}

function formatDateOfJoining(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  slug: string
  /** The signed-in user, so their own row never offers a role dropdown. */
  viewerUserId: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
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
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Factor 1: the account password. The server re-checks it and only then
  // issues the code, so a hijacked session with inbox access is not enough.
  async function requestOtp() {
    if (!password) {
      setError(en.wsTransferOwnership.errorPasswordRequired)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', targetMemberId: target.member_id, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdminEmail(data.email)
        // Don't keep it in state while the OTP step is open.
        setPassword('')
        setStep('otp')
      } else {
        setError(data.error || en.wsTransferOwnership.errorRequestFailed)
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
        setSuccess(en.wsTransferOwnership.successMsg(data.new_admin))
        setTimeout(() => {
          onDone()
          // Not /ws: the outgoing owner is now a plain member, so they no longer
          // match getAdminWorkspacesForUser and would land on an empty picker
          // with no explanation. /me is the surface they still have.
          window.location.href = '/me'
        }, 2000)
      } else {
        setError(data.error || en.wsTransferOwnership.errorTransferFailed)
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
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
          {en.wsTransferOwnership.title}
        </h2>

        {success ? (
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--teal)', lineHeight: 1.5 }}>
            {success}
          </p>
        ) : step === 'confirm' ? (
          <>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              {en.wsTransferOwnership.confirmBodyPrefix}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{target.full_name ?? target.email}</strong>.
            </p>

            {/* Destructive warning - stays on screen while they type the
                password, so the consequence is visible at the moment they
                authorise it rather than on a screen they already clicked past. */}
            <div style={{
              border: '1px solid var(--danger)',
              background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
            }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
                {en.wsTransferOwnership.warningTitle}
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  en.wsTransferOwnership.warningTheyGain,
                  en.wsTransferOwnership.warningYouLose,
                  en.wsTransferOwnership.warningNoUndo,
                ].map((line) => (
                  <li key={line} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <label
              htmlFor="transfer-password"
              style={{ display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}
            >
              {en.wsTransferOwnership.passwordLabel}
            </label>
            <input
              id="transfer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={en.wsTransferOwnership.passwordPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
              autoComplete="current-password"
              style={{ ...inputStyle, marginBottom: '12px' }}
              autoFocus
            />

            {error && (
              <p style={{ fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={requestOtp}
                disabled={loading || !password}
                style={{
                  flex: 1, height: '44px',
                  background: 'var(--danger)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-md)', fontSize: '14px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500,
                  cursor: (loading || !password) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !password) ? 0.7 : 1,
                }}
              >
                {loading ? en.wsTransferOwnership.continuingBtn : en.wsTransferOwnership.continueBtn}
              </button>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '44px', padding: '0 16px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {en.wsTransferOwnership.cancelBtn}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              {en.wsTransferOwnership.otpBodyPrefix} <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong> {en.wsTransferOwnership.otpBodySuffix}
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={en.wsTransferOwnership.otpPlaceholder}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && confirmTransfer()}
              style={{ ...inputStyle, marginBottom: '12px', letterSpacing: '0.15em', fontSize: '18px', textAlign: 'center' }}
              autoFocus
            />
            {error && (
              <p style={{ fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
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
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500,
                  cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer',
                  opacity: (loading || code.length < 6) ? 0.7 : 1,
                }}
              >
                {loading ? en.wsTransferOwnership.transferringBtn : en.wsTransferOwnership.confirmBtn}
              </button>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  height: '44px', padding: '0 16px',
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {en.wsTransferOwnership.cancelBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PeopleClient({ slug, viewerUserId }: Props) {
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

  // Role assignment. `assignableRoles` is server-filtered to roles the viewer
  // is allowed to grant, so the dropdown can never offer something the API
  // would reject - the API re-checks regardless.
  const [roleOptions, setRoleOptions] = useState<{ assignableRoles: RoleOption[]; roleNames: Record<string, string> }>({ assignableRoles: [], roleNames: {} });
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>({ transferOwnership: false, removeMembers: false });
  const [viewerRoleKey, setViewerRoleKey] = useState<string>('member');
  const [roleModal, setRoleModal] = useState<{ member: Member; roleKey: string; saving: boolean; error: string | null } | null>(null);

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
        setRoleOptions({
          assignableRoles: (data.assignableRoles ?? []) as RoleOption[],
          roleNames: (data.roleNames ?? {}) as Record<string, string>,
        });
        setViewerPermissions({
          transferOwnership: data.permissions?.transferOwnership === true,
          removeMembers: data.permissions?.removeMembers === true,
        });
        setViewerRoleKey(data.viewerRole?.key ?? 'member');
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
        setInviteStatus({ text: en.wsPeople.inviteSuccess(e), ok: true })
        await loadMembers()
      } else {
        setInviteStatus({ text: data.error || en.wsPeople.inviteError, ok: false })
      }
    } finally {
      setInviting(false)
    }
  }

  async function remove(memberId: string) {
    if (!confirm(en.wsPeople.removeConfirm)) return
    setRemovingId(memberId)
    const res = await fetch(`/api/ws/${slug}/members/${memberId}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.member_id !== memberId))
    }
    setRemovingId(null)
  }

  async function saveRole() {
    if (!roleModal) return
    setRoleModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev))
    const res = await fetch(
      `/api/ws/${slug}/members/${roleModal.member.member_id}/role`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleModal.roleKey }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      const key = roleModal.roleKey
      setMembers((prev) =>
        prev.map((m) =>
          m.member_id === roleModal.member.member_id ? { ...m, role: key } : m,
        ),
      )
      setRoleModal(null)
    } else {
      setRoleModal((prev) => (prev ? { ...prev, saving: false, error: data.error ?? en.wsPeople.roleChangeFailed } : prev))
    }
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

      {roleModal && (() => {
        const name = roleModal.member.full_name ?? roleModal.member.email
        const roleName = roleOptions.roleNames[roleModal.roleKey] ?? roleModal.roleKey
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '28px', maxWidth: '440px', width: '100%' }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
                {en.wsPeople.roleModalTitle(name)}
              </h2>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {en.wsPeople.roleModalTo(roleName)}
              </p>

              {/* Name the consequence, not the mechanism. */}
              <div style={{ border: '1px solid var(--border)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', lineHeight: 1.55 }}>
                {roleModal.roleKey === 'admin' ? (
                  <>
                    <div style={{ color: 'var(--teal)', marginBottom: '6px' }}>+ {en.wsPeople.roleAdminGains}</div>
                    <div style={{ color: 'var(--danger)' }}>− {en.wsPeople.roleAdminLimits}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--danger)' }}>− {en.wsPeople.roleMemberEffect}</div>
                )}
              </div>

              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {en.wsPeople.roleAppliesImmediately}
              </p>

              {roleModal.error && (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--danger)', marginBottom: '12px' }}>{roleModal.error}</p>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={saveRole}
                  disabled={roleModal.saving}
                  style={{ flex: 1, height: '44px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500, cursor: roleModal.saving ? 'not-allowed' : 'pointer', opacity: roleModal.saving ? 0.7 : 1 }}
                >
                  {roleModal.saving ? en.wsPeople.roleSavingButton : en.wsPeople.roleConfirmButton}
                </button>
                <button
                  type="button"
                  onClick={() => setRoleModal(null)}
                  style={{ height: '44px', padding: '0 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'Plus Jakarta Sans, sans-serif', cursor: 'pointer' }}
                >
                  {en.wsPeople.roleCancelButton}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              fontFamily: "Playfair Display, serif",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--navy)",
              marginBottom: "12px",
            }}
          >
            {en.wsPeople.inviteSectionTitle}
          </h2>
        </div>
        <p
          style={{
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          {en.wsPeople.inviteHelperText}
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={en.wsPeople.invitePlaceholder}
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
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontWeight: 500,
              cursor: inviting ? "not-allowed" : "pointer",
              opacity: inviting ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            {inviting ? en.wsPeople.inviteSubmitting : en.wsPeople.inviteSubmit}
          </button>
        </div>
        {inviteStatus && (
          <p
            style={{
              marginTop: "8px",
              fontSize: "13px",
              fontFamily: "Plus Jakarta Sans, sans-serif",
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
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '15px', fontWeight: 600, color: 'var(--navy)' }}>
            {en.wsPeople.peopleCount(pagination?.total ?? members.length)}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="search"
              placeholder={en.wsPeople.searchPlaceholder}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              style={{ height: '36px', padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', background: 'var(--surface-0)', color: 'var(--text-primary)', outline: 'none', minWidth: '220px' }}
            />
            <button type="button" onClick={applySearch} title={en.wsPeople.searchButtonTitle} style={{ height: '36px', width: '36px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-0)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
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
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{en.wsPeople.emptyTitle}</p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>{en.wsPeople.emptyBody}</p>
          </div>
        ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[en.wsPeople.colEmployee, en.wsPeople.colDesignation, en.wsPeople.colDepartment, en.wsPeople.colWorkMode, en.wsPeople.colJoined, en.wsPeople.roleColumn, en.wsPeople.colStatus, ''].map((h, idx) => (
                    <th key={idx} style={{ padding: '10px 16px', textAlign: idx === 7 ? 'right' : 'left', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
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
                      ? { label: en.wsPeople.statusInviteSent, color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' }
                      : m.status === 'declined'
                        ? { label: en.wsPeople.statusDeclined, color: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)' }
                        : { label: en.wsPeople.statusActive, color: 'var(--teal)', bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' }
                  return (
                    <tr key={m.member_id} style={{ borderBottom: i < members.length - 1 || loadingMore ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* Employee column — takes remaining space */}
                      <td style={{ padding: '12px 16px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#fff', flexShrink: 0, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={m.user_id ? `/ws/${slug}/members/${m.user_id}` : '#'}
                              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}
                            >
                              {name}
                            </Link>
                            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {m.employee_id ?? m.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Designation */}
                      <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', }}>{m.designation ?? '—'}</td>
                      {/* Department */}
                      <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{m.department ?? '—'}</td>
                      {/* Work mode */}
                      <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{m.work_mode ? (WM_LABEL[m.work_mode] ?? m.work_mode) : '—'}</td>
                      {/* Joined */}
                      <td style={{ padding: '12px 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDateOfJoining(m.date_of_joining)}</td>
                      {/* Role - a dropdown when this viewer may reassign this
                          person, otherwise a plain locked label. */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const isSelf = !!m.user_id && m.user_id === viewerUserId
                          const canReassign =
                            roleOptions.assignableRoles.length > 0 &&
                            m.status === 'active' &&
                            !isSelf &&
                            m.role !== 'owner' &&
                            roleOptions.assignableRoles.some((r) => r.key === m.role)
                          const label = roleOptions.roleNames[m.role] ?? m.role

                          if (!canReassign) {
                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px' }}>
                                {label}
                                {m.role === 'owner' && <Lock size={11} />}
                              </span>
                            )
                          }

                          return (
                            <select
                              value={m.role}
                              onChange={(e) => {
                                const next = e.target.value
                                if (next === m.role) return
                                // Ownership is a TRANSFER, not an assignment: it
                                // swaps two rows and demotes the person doing it,
                                // so it goes through the OTP flow instead of the
                                // role-change modal. PATCH .../role rejects
                                // 'owner' outright, so this is the only path.
                                // The select is controlled by m.role, so it snaps
                                // back on the re-render if the modal is cancelled.
                                if (next === 'owner') {
                                  if (viewerPermissions.transferOwnership) setTransferTarget(m)
                                  return
                                }
                                setRoleModal({ member: m, roleKey: next, saving: false, error: null })
                              }}
                              aria-label={en.wsPeople.roleSelectAria}
                              style={{ height: '32px', minWidth: '104px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-0)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--navy)', padding: '0 6px', cursor: 'pointer' }}
                            >
                              {roleOptions.assignableRoles.map((r) => (
                                <option
                                  key={r.key}
                                  value={r.key}
                                  // A native <option> cannot host an SVG, so the
                                  // padlock is a text glyph. Grey marks it as
                                  // set apart from the ordinary roles above it.
                                  style={r.restricted
                                    ? { color: 'var(--text-muted)' }
                                    : undefined}
                                >
                                  {r.restricted
                                    ? en.wsPeople.restrictedRoleOption(r.name)
                                    : r.name}
                                </option>
                              ))}
                            </select>
                          )
                        })()}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500, color: st.color, background: st.bg, border: `1px solid ${st.color}`, borderRadius: '4px', padding: '2px 8px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                          {st.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {m.user_id && m.status === 'active' && !m.employee_record_id && (
                            <Link href={`/ws/${slug}/people/${m.user_id}/details`} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--brand)', textDecoration: 'none' }}>{en.wsPeople.setUpLink}</Link>
                          )}
                          {m.user_id && m.status === 'active' && m.employee_record_id && (
                            <Link href={`/ws/${slug}/people/${m.user_id}/details`} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>{en.wsPeople.editLink}</Link>
                          )}
                          {/* Two independent conditions, both required: does
                              this viewer hold members:delete at all, and does
                              rank let them act on THIS person? Testing the
                              target's role alone showed the button to roles
                              that cannot use it, and hid it from roles that
                              can. DELETE re-checks both. */}
                          {viewerPermissions.removeMembers &&
                            canManage(viewerRoleKey, m.role) &&
                            m.user_id !== viewerUserId && (
                            <button onClick={() => remove(m.member_id)} disabled={removingId === m.member_id} title={en.wsPeople.removeTitle} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: removingId === m.member_id ? 'not-allowed' : 'pointer', opacity: removingId === m.member_id ? 0.5 : 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}>
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
                    <td colSpan={8} style={{ padding: '14px 16px', borderBottom: k < 3 ? '1px solid var(--border)' : 'none' }}>
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
          <button type="button" onClick={() => loadMembers({ append: true })} disabled={loadingMore} style={{ height: '44px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-0)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600, cursor: loadingMore ? 'default' : 'pointer' }}>
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
        <p style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '15px', margin: 0 }}>{en.wsPeople.regularizationSectionTitle}</p>
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
