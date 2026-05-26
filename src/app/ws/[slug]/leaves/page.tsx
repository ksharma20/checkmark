'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { en } from '@/locales/en'

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
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
}

function PrimaryBtn({ children, onClick, loading, small, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        height: small ? '40px' : '44px',
        padding: small ? '0 14px' : '0 20px',
        background: 'var(--brand)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: small ? '13px' : '14px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        opacity: (loading || disabled) ? 0.7 : 1,
        flexShrink: 0,
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function StatusLine({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: msg.ok ? 'var(--teal)' : 'var(--danger)', marginTop: '8px' }}>
      {msg.text}
    </p>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AcrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: AcrualFrequency
  accrual_credits: number
}

interface LeaveRow {
  id: string
  user_full_name: string | null
  user_email: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatRange(start: string, end: string) {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const s = new Date(sy, sm - 1, sd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  const e = new Date(ey, em - 1, ed).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return start === end ? e : `${s} – ${e}`
}

function leaveDays(start: string, end: string) {
  return Math.floor((new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) / 86400000) + 1
}

// ─── Leave Types config ───────────────────────────────────────────────────────

function LeaveTypesSection({ slug }: { slug: string }) {
  const [types, setTypes] = useState<LeaveTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AcrualFrequency>('monthly')
  const [credits, setCredits] = useState('1')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const loadTypes = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/leave-types`)
    if (res.ok) {
      const data = await res.json()
      setTypes(data.leaveTypes ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadTypes() }, [loadTypes])

  async function addType() {
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    setAddStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, accrual_frequency: frequency, accrual_credits: Math.max(1, parseInt(credits, 10) || 1) }),
      })
      const data = await res.json()
      if (res.ok) {
        setTypes((prev) => [...prev, data.leaveType as LeaveTypeRow])
        setName('')
        setFrequency('monthly')
        setCredits('1')
        setAddStatus({ text: `"${(data.leaveType as LeaveTypeRow).name}" added`, ok: true })
      } else {
        setAddStatus({ text: (data as { error?: string }).error ?? 'Failed to add', ok: false })
      }
    } finally {
      setAdding(false)
    }
  }

  async function deleteType(id: string) {
    if (!confirm(en.wsLeaveTypes.deleteConfirm)) return
    const res = await fetch(`/api/ws/${slug}/leave-types/${id}`, { method: 'DELETE' })
    if (res.ok) setTypes((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 6px' }}>
        {en.wsLeaveTypes.sectionTitle}
      </h2>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        {en.wsLeaveTypes.sectionDescription}
      </p>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>Loading…</p>
      ) : types.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginBottom: '14px' }}>
          {en.wsLeaveTypes.emptyNoTypes}
        </p>
      ) : (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {types.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {t.name}
                </span>
                <span style={{ marginLeft: '8px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)' }}>
                  {`${t.accrual_credits} credit${t.accrual_credits !== 1 ? 's' : ''}/${
                    t.accrual_frequency === 'monthly' ? 'month'
                    : t.accrual_frequency === 'quarterly' ? 'quarter'
                    : t.accrual_frequency === 'half-yearly' ? '6 months'
                    : 'year'
                  }`}
                </span>
              </div>
              <button type="button" onClick={() => deleteType(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelName}
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={en.wsLeaveTypes.placeholderName}
            onKeyDown={(e) => { if (e.key === 'Enter') void addType() }} style={{ ...inputStyle, height: '40px' }} />
        </div>
        <div style={{ flex: '0 0 120px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelFrequency}
          </label>
          <select value={frequency} onChange={(e) => { setFrequency(e.target.value as AcrualFrequency); setCredits('1') }}
            style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
            <option value="monthly">{en.wsLeaveTypes.optionMonthly}</option>
            <option value="quarterly">{en.wsLeaveTypes.optionQuarterly}</option>
            <option value="half-yearly">{en.wsLeaveTypes.optionHalfYearly}</option>
            <option value="yearly">{en.wsLeaveTypes.optionYearly}</option>
          </select>
        </div>
<div style={{ flex: '0 0 80px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {en.wsLeaveTypes.labelCredits}
          </label>
          <input type="number" min={1} max={365} value={credits}
            onChange={(e) => setCredits(e.target.value)}
            style={{ ...inputStyle, height: '40px' }} />
        </div>
        <PrimaryBtn small onClick={() => void addType()} loading={adding} disabled={!name.trim()}>
          {en.wsLeaveTypes.addType}
        </PrimaryBtn>
      </div>
      <StatusLine msg={addStatus} />
    </div>
  )
}

// ─── Leave requests table ─────────────────────────────────────────────────────

type Filter = 'all' | 'upcoming' | 'past'

function LeaveRequestsSection({ slug }: { slug: string }) {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/leaves`)
    if (res.ok) {
      const d = await res.json() as { leaveRequests: LeaveRow[] }
      setRows(d.leaveRequests ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    void load()
  }, [load])

  const today = todayStr()
  const filtered = rows.filter((r) => {
    if (filter === 'upcoming') return r.start_date >= today
    if (filter === 'past') return r.end_date < today
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
          Leave Requests
        </h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(['all', 'upcoming', 'past'] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              height: '30px', padding: '0 12px',
              border: filter === f ? '1px solid var(--brand)' : '1px solid var(--border)',
              borderRadius: '20px',
              background: filter === f ? 'rgba(27,77,255,0.08)' : 'var(--surface-0)',
              color: filter === f ? 'var(--brand)' : 'var(--text-secondary)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {f}
            </button>
          ))}
          {!loading && (
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
              {filtered.length} request{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--surface-0)' }}>
        <div style={{ minWidth: '520px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px', padding: '10px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '12px' }}>
            {['Member', 'Leave Type', 'Dates', 'Days', 'Status'].map((h) => (
              <span key={h} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {h}
              </span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: '44px', borderRadius: '6px', background: 'var(--surface-2)', animation: 'cm-pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
              No leave requests{filter !== 'all' ? ` (${filter})` : ''} yet.
            </p>
          ) : (
            filtered.map((r, idx) => {
              const isPast = r.end_date < today
              const isActive = r.start_date <= today && r.end_date >= today
              const days = leaveDays(r.start_date, r.end_date)
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px', padding: '12px 16px', gap: '12px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', background: isActive ? 'rgba(0,212,170,0.03)' : 'transparent' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.user_full_name ?? r.user_email}
                    </p>
                    {r.reason && (
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                        {r.reason}
                      </p>
                    )}
                  </div>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.leave_type_name}
                  </span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: isPast ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatRange(r.start_date, r.end_date)}
                  </span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: isPast ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {days}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', color: isActive ? 'var(--teal)' : isPast ? 'var(--text-muted)' : 'var(--brand)', background: isActive ? 'rgba(0,212,170,0.12)' : isPast ? 'var(--surface-2)' : 'rgba(27,77,255,0.1)' }}>
                    {isActive ? 'Active' : isPast ? 'Past' : 'Upcoming'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLeavesPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="leaves-page">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
          Leaves
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Configure leave types and review all member leave requests.
        </p>
      </div>

      <LeaveTypesSection slug={slug} />
      <LeaveRequestsSection slug={slug} />

      <style>{`
        @keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .leaves-page{
          width:100%;
          max-width:900px;
          margin:0 auto;
          padding:20px 16px;
          box-sizing:border-box;
        }
        @media(min-width:640px){
          .leaves-page{padding:28px 32px;}
        }
      `}</style>
    </div>
  )
}
