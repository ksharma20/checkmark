'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
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
  rejection_reason: string | null
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

// ─── Opening Balances ─────────────────────────────────────────────────────────

interface OpeningBalanceRow {
  id: string
  user_id: string
  leave_type_id: string
  balance_days: number
  note: string | null
  user_email: string
  user_full_name: string | null
  leave_type_name: string
  member_record_id: string
}

function OpeningBalancesSection({ slug }: { slug: string }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [balances, setBalances] = useState<OpeningBalanceRow[]>([])
  const [loadingBalances, setLoadingBalances] = useState(true)
  const [editState, setEditState] = useState<Record<string, { balance_days: string; note: string; saving: boolean; saved: boolean }>>({})
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([])
  const [members, setMembers] = useState<{ member_id: string; user_id: string; email: string; full_name: string | null }[]>([])
  const [cutover, setCutover] = useState<{ date: string; saving: boolean; msg: { text: string; ok: boolean } | null }>({ date: '', saving: false, msg: null })
  const [addForm, setAddForm] = useState<{ show: boolean; memberId: string; typeId: string; balance: string; note: string; saving: boolean; msg: { text: string; ok: boolean } | null }>({ show: false, memberId: '', typeId: '', balance: '', note: '', saving: false, msg: null })
  const [importState, setImportState] = useState<{ loading: boolean; msg: { text: string; ok: boolean } | null; errors: { row: number; reason: string }[] }>({ loading: false, msg: null, errors: [] })

  const loadAll = useCallback(async () => {
    setLoadingBalances(true)
    const [wsRes, balRes, typesRes] = await Promise.all([
      fetch(`/api/ws/${slug}`),
      fetch(`/api/ws/${slug}/leave-balances`),
      fetch(`/api/ws/${slug}/leave-types`),
    ])
    if (wsRes.ok) {
      const d = await wsRes.json() as { leave_cutover_date?: string | null }
      setCutover((p) => ({ ...p, date: d.leave_cutover_date ?? '' }))
    }
    if (balRes.ok) {
      const d = await balRes.json() as { balances: OpeningBalanceRow[] }
      setBalances(d.balances ?? [])
    }
    if (typesRes.ok) {
      const d = await typesRes.json() as { leaveTypes: LeaveTypeRow[] }
      setLeaveTypes(d.leaveTypes ?? [])
    }
    setLoadingBalances(false)
  }, [slug])

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/members?limit=200`)
    if (res.ok) {
      const d = await res.json() as { members: { member_id: string; user_id: string; email: string; full_name: string | null }[] }
      setMembers((d.members ?? []).filter((m) => m.user_id && m.member_id))
    }
  }, [slug])

  useEffect(() => { void loadAll() }, [loadAll])

  async function saveCutoverDate() {
    const date = cutover.date
    setCutover((p) => ({ ...p, saving: true, msg: null }))
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveCutoverDate: date || null }),
      })
      if (res.ok) {
        setCutover((p) => ({ ...p, msg: { text: date ? en.wsOpeningBalances.cutoverDateSaved : en.wsOpeningBalances.cutoverDateCleared, ok: true } }))
      } else {
        const d = await res.json() as { error?: string }
        setCutover((p) => ({ ...p, msg: { text: d.error ?? 'Failed to save', ok: false } }))
      }
    } finally {
      setCutover((p) => ({ ...p, saving: false }))
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportState({ loading: true, msg: null, errors: [] })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ws/${slug}/leave-balances/import`, { method: 'POST', body: fd })
      const d = await res.json() as { imported?: number; errors?: { row: number; reason: string }[] }
      const imported = d.imported ?? 0
      const errors = d.errors ?? []
      setImportState({ loading: false, msg: { text: en.wsOpeningBalances.importSuccess(imported) + (errors.length > 0 ? ` · ${en.wsOpeningBalances.importErrors(errors.length)}` : ''), ok: errors.length === 0 }, errors })
      if (imported > 0) void loadAll()
    } finally {
      setImportState((p) => ({ ...p, loading: false }))
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function startEdit(row: OpeningBalanceRow) {
    setEditState((prev) => ({
      ...prev,
      [row.id]: { balance_days: String(row.balance_days), note: row.note ?? '', saving: false, saved: false },
    }))
  }

  async function saveRow(row: OpeningBalanceRow) {
    const state = editState[row.id]
    if (!state) return
    const days = parseFloat(state.balance_days)
    if (isNaN(days) || days < 0) return
    setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: true, saved: false } }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${row.member_record_id}/leave-balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ leave_type_id: row.leave_type_id, balance_days: days, note: state.note || null }]),
      })
      if (res.ok) {
        setBalances((prev) => prev.map((b) => b.id === row.id ? { ...b, balance_days: days, note: state.note || null } : b))
        setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: true } }))
      } else {
        setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
      }
    } catch {
      setEditState((prev) => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
    }
  }

  // addForm.memberId stores the workspace member record id (not user_id)
  async function addBalance_submit() {
    const { memberId, typeId, balance, note } = addForm
    if (!memberId || !typeId) return
    const days = parseFloat(balance)
    if (isNaN(days) || days < 0) return
    setAddForm((p) => ({ ...p, saving: true, msg: null }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${memberId}/leave-balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ leave_type_id: typeId, balance_days: days, note: note || null }]),
      })
      if (res.ok) {
        setAddForm({ show: false, memberId: '', typeId: '', balance: '', note: '', saving: false, msg: null })
        void loadAll()
      } else {
        const d = await res.json() as { error?: string }
        setAddForm((p) => ({ ...p, msg: { text: d.error ?? 'Failed to add', ok: false } }))
      }
    } finally {
      setAddForm((p) => ({ ...p, saving: false }))
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '4px' }
  const hintStyle: React.CSSProperties = { fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }

  return (
    <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px' }}>
        {en.wsOpeningBalances.sectionTitle}
      </h2>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
        {en.wsOpeningBalances.sectionDescription}
      </p>

      {/* Cutover date */}
      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <label style={labelStyle}>{en.wsOpeningBalances.cutoverDateLabel}</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={cutover.date}
            onChange={(e) => setCutover((p) => ({ ...p, date: e.target.value }))}
            style={{ ...inputStyle, height: '40px', width: '180px', flex: '0 0 180px' }}
          />
          <PrimaryBtn small onClick={() => void saveCutoverDate()} loading={cutover.saving}>
            {en.wsOpeningBalances.cutoverDateSave}
          </PrimaryBtn>
        </div>
        <p style={hintStyle}>{en.wsOpeningBalances.cutoverDateHint}</p>
        <StatusLine msg={cutover.msg} />
      </div>

      {/* CSV import */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={(e) => void handleFileImport(e)} />
        <PrimaryBtn small onClick={() => fileRef.current?.click()} loading={importState.loading}>
          {en.wsOpeningBalances.importBtn}
        </PrimaryBtn>
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
          {en.wsOpeningBalances.importHint}
        </span>
      </div>
      <StatusLine msg={importState.msg} />
      {importState.errors.length > 0 && (
        <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', maxHeight: '140px', overflowY: 'auto' }}>
          {importState.errors.map((e, i) => (
            <p key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--danger)', margin: i === 0 ? 0 : '4px 0 0' }}>
              {e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}
            </p>
          ))}
        </div>
      )}

      {/* Balances table */}
      <div style={{ marginTop: '16px' }}>
        {loadingBalances ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: '40px', borderRadius: '6px', background: 'var(--surface-2)', animation: 'cm-pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0' }}>
            {en.wsOpeningBalances.emptyNoBalances}
          </p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--surface-0)' }}>
            <div style={{ minWidth: '640px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 80px', padding: '10px 14px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '10px' }}>
                {[en.wsOpeningBalances.colEmployee, en.wsOpeningBalances.colLeaveType, en.wsOpeningBalances.colBalance, en.wsOpeningBalances.colNote, ''].map((h, i) => (
                  <span key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              {balances.map((row, idx) => {
                const editing = editState[row.id]
                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 1fr 80px', padding: '10px 14px', gap: '10px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.user_full_name ?? row.user_email}
                      </p>
                      {row.user_full_name && (
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.user_email}
                        </p>
                      )}
                    </div>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.leave_type_name}
                    </span>
                    {editing ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={editing.balance_days}
                        onChange={(e) => setEditState((prev) => ({ ...prev, [row.id]: { ...editing, balance_days: e.target.value } }))}
                        style={{ ...inputStyle, height: '34px', fontSize: '13px' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {row.balance_days}
                      </span>
                    )}
                    {editing ? (
                      <input
                        type="text"
                        value={editing.note}
                        onChange={(e) => setEditState((prev) => ({ ...prev, [row.id]: { ...editing, note: e.target.value } }))}
                        placeholder={en.wsOpeningBalances.addPlaceholderNote}
                        style={{ ...inputStyle, height: '34px', fontSize: '13px' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.note ?? '—'}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {editing ? (
                        <button
                          type="button"
                          disabled={editing.saving}
                          onClick={() => void saveRow(row)}
                          style={{ height: '28px', padding: '0 10px', background: editing.saved ? 'var(--teal)' : 'var(--brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: editing.saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {editing.saving ? en.wsOpeningBalances.savingRow : editing.saved ? en.wsOpeningBalances.rowSaved : en.wsOpeningBalances.saveRow}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          style={{ height: '28px', padding: '0 10px', background: 'none', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add new balance */}
      <div style={{ marginTop: '12px' }}>
        {!addForm.show ? (
          <button
            type="button"
            onClick={() => { setAddForm((p) => ({ ...p, show: true })); void loadMembers() }}
            style={{ height: '36px', padding: '0 14px', background: 'none', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            + {en.wsOpeningBalances.addBtn}
          </button>
        ) : (
          <div style={{ padding: '14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colEmployee}</label>
                <select value={addForm.memberId} onChange={(e) => setAddForm((p) => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
                  <option value="">Select employee…</option>
                  {members.map((m) => (
                    <option key={m.member_id} value={m.member_id}>{m.full_name ?? m.email} ({m.email})</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colLeaveType}</label>
                <select value={addForm.typeId} onChange={(e) => setAddForm((p) => ({ ...p, typeId: e.target.value }))} style={{ ...inputStyle, height: '40px', cursor: 'pointer' }}>
                  <option value="">Select leave type…</option>
                  {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 0 100px' }}>
                <label style={labelStyle}>Days</label>
                <input type="number" min={0} step={0.5} value={addForm.balance} onChange={(e) => setAddForm((p) => ({ ...p, balance: e.target.value }))} placeholder="0" style={{ ...inputStyle, height: '40px' }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={labelStyle}>{en.wsOpeningBalances.colNote}</label>
                <input type="text" value={addForm.note} onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))} placeholder={en.wsOpeningBalances.addPlaceholderNote} style={{ ...inputStyle, height: '40px' }} />
              </div>
              <PrimaryBtn small onClick={() => void addBalance_submit()} loading={addForm.saving} disabled={!addForm.memberId || !addForm.typeId || !addForm.balance}>
                {en.wsOpeningBalances.saveRow}
              </PrimaryBtn>
              <button type="button" onClick={() => setAddForm((p) => ({ ...p, show: false, msg: null }))} style={{ height: '40px', padding: '0 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                {en.wsLeaves.cancelBtn}
              </button>
            </div>
            <StatusLine msg={addForm.msg} />
          </div>
        )}
      </div>
    </div>
  )
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

type Filter = 'pending' | 'active' | 'all' | 'upcoming' | 'past'

const FILTER_LABELS: Record<Filter, string> = {
  pending: en.wsLeaves.filterPending,
  active: en.wsLeaves.filterActive,
  all: en.wsLeaves.filterAll,
  upcoming: en.wsLeaves.filterUpcoming,
  past: en.wsLeaves.filterPast,
}

function statusStyle(status: string): { color: string; background: string; label: string } {
  if (status === 'approved') return { color: 'var(--teal)', background: 'rgba(0,212,170,0.12)', label: en.wsLeaves.statusApproved }
  if (status === 'rejected') return { color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', label: en.wsLeaves.statusRejected }
  return { color: 'var(--amber)', background: 'rgba(245,158,11,0.12)', label: en.wsLeaves.statusPending }
}

function LeaveRequestsSection({ slug }: { slug: string }) {
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [activeRow, setActiveRow] = useState<{ id: string; mode: 'viewing' | 'rejecting' | 'approving' | 'rejecting-submitting' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

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

  async function handleApprove(id: string) {
    if (!confirm(en.wsLeaves.approveConfirm)) return
    setActiveRow({ id, mode: 'approving' })
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) => r.id === id ? { ...r, status: 'approved' } : r))
        setActiveRow(null)
      } else {
        setActiveRow({ id, mode: 'viewing' })
      }
    } catch {
      setActiveRow({ id, mode: 'viewing' })
    }
  }

  async function handleReject(id: string) {
    const trimmed = rejectReason.trim()
    if (!trimmed) return
    setActiveRow({ id, mode: 'rejecting-submitting' })
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: trimmed }),
      })
      if (res.ok) {
        setRows((prev) => prev.map((r) =>
          r.id === id ? { ...r, status: 'rejected', rejection_reason: trimmed } : r,
        ))
        setRejectReason('')
        setActiveRow(null)
      } else {
        setActiveRow({ id, mode: 'rejecting' })
      }
    } catch {
      setActiveRow({ id, mode: 'rejecting' })
    }
  }

  const today = todayStr()
  const searchQuery = search.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (filter === 'pending') { if (r.status !== 'pending') return false }
    else if (filter === 'active') { if (r.status !== 'approved' || r.start_date > today || r.end_date < today) return false }
    else if (filter === 'upcoming') { if (r.start_date <= today || r.status === 'pending') return false }
    else if (filter === 'past') { if (r.end_date >= today || r.status === 'pending') return false }
    if (!searchQuery) return true
    return (r.user_full_name ?? '').toLowerCase().includes(searchQuery) || r.user_email.toLowerCase().includes(searchQuery)
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h2
  style={{
    fontFamily: 'Syne, sans-serif',
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--navy)',
    margin: 0,
  }}
>
  {en.wsLeaves.title}
  {!loading && (
    <span
      style={{
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '15px',
        color: 'var(--text-muted)',
        marginLeft: '4px',
      }}
    >
      ({filtered.length})
    </span>
  )}
</h2>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'pending', 'active', 'upcoming', 'past'] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={{
              height: '30px', padding: '0 12px',
              border: filter === f ? '1px solid var(--brand)' : '1px solid var(--border)',
              borderRadius: '20px',
              background: filter === f ? 'rgba(27,77,255,0.08)' : 'var(--surface-0)',
              color: filter === f ? 'var(--brand)' : 'var(--text-secondary)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer',
            }}>
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={en.wsLeaves.searchPlaceholder}
        style={{ ...inputStyle, height: '36px', marginBottom: '12px', fontSize: '13px' }}
      />

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', background: 'var(--surface-0)' }}>
        <div style={{ minWidth: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px 140px', padding: '10px 16px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border)', gap: '12px' }}>
            {['Employee Name', 'Leave Type', 'Dates', 'Days', 'Status', 'Actions'].map((h) => (
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
              {searchQuery ? 'No results match your search.' : `No ${filter === 'all' ? '' : FILTER_LABELS[filter].toLowerCase() + ' '}leave requests yet.`}
            </p>
          ) : (
            filtered.map((r, idx) => {
              const isPast = r.end_date < today
              const days = leaveDays(r.start_date, r.end_date)
              const statusBadge = statusStyle(r.status)
              const isExpanded = activeRow?.id === r.id
              const isRejecting = activeRow?.id === r.id && (activeRow.mode === 'rejecting' || activeRow.mode === 'rejecting-submitting')
              const isActioning = activeRow?.id === r.id && (activeRow.mode === 'approving' || activeRow.mode === 'rejecting-submitting')

              return (
                <React.Fragment key={r.id}>
                  {/* Main row */}
                  <div
                    onClick={() => setActiveRow(isExpanded ? null : { id: r.id, mode: 'viewing' })}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 60px 80px 140px', padding: '12px 16px', gap: '12px', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'var(--surface-1)' : 'transparent' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user_full_name ?? r.user_email}
                      </p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user_email}
                      </p>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', color: statusBadge.color, background: statusBadge.background }}>
                      {statusBadge.label}
                    </span>
                    {/* Actions — stop click propagation so row expand doesn't trigger */}
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => void handleApprove(r.id)}
                            style={{ height: '28px', padding: '0 10px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {isActioning && !isRejecting ? en.wsLeaves.approving : en.wsLeaves.approveBtn}
                          </button>
                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => { setActiveRow(isRejecting ? { id: r.id, mode: 'viewing' } : { id: r.id, mode: 'rejecting' }); setRejectReason('') }}
                            style={{ height: '28px', padding: '0 10px', background: 'none', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {en.wsLeaves.rejectBtn}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{ padding: '14px 16px 16px', background: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: isRejecting ? '14px' : 0 }}>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Employee</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.user_full_name ?? '—'}</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{r.user_email}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Leave Type</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.leave_type_name}</p>
                        </div>
                        <div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Duration</p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{formatRange(r.start_date, r.end_date)} · {days} day{days !== 1 ? 's' : ''}</p>
                        </div>
                        {r.reason && (
                          <div>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Reason</p>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>{r.reason}</p>
                          </div>
                        )}
                        {r.status === 'rejected' && r.rejection_reason && (
                          <div>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: '0 0 3px' }}>Rejection Reason</p>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--danger)', margin: 0 }}>{r.rejection_reason}</p>
                          </div>
                        )}
                      </div>

                      {/* Inline reject form */}
                      {isRejecting && (
                        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                            {en.wsLeaves.rejectReasonLabel} <span style={{ color: 'var(--danger)' }}>*</span>
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder={en.wsLeaves.rejectReasonPlaceholder}
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', background: 'var(--surface-0)', color: 'var(--text-primary)', resize: 'vertical', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              disabled={!rejectReason.trim() || isActioning}
                              onClick={() => void handleReject(r.id)}
                              style={{ height: '32px', padding: '0 14px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, cursor: (!rejectReason.trim() || isActioning) ? 'not-allowed' : 'pointer', opacity: (!rejectReason.trim() || isActioning) ? 0.6 : 1 }}
                            >
                              {isActioning ? en.wsLeaves.rejecting : en.wsLeaves.confirmRejectBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActiveRow(prev => prev ? { ...prev, mode: 'viewing' } : null); setRejectReason('') }}
                              style={{ height: '32px', padding: '0 14px', background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
                            >
                              {en.wsLeaves.cancelBtn}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </React.Fragment>
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
      <OpeningBalancesSection slug={slug} />
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
