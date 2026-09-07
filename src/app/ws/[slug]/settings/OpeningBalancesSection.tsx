'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button, Card, DataTable, Dropzone, EmptyState, Field, Input, Select, SkeletonText,
  type Column,
} from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import type { LeaveTypeRow } from './LeaveTypesSection'

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

interface MemberOption {
  member_id: string
  user_id: string
  email: string
  full_name: string | null
}

type EditState = Record<string, { balance_days: string; note: string; saving: boolean; saved: boolean }>

/**
 * Opening balances carried over from whatever system the workspace used
 * before CheckMark, plus the cutover date they were measured at.
 *
 * Re-skinned only: the cutover PATCH, the per-row PUT, the "add a balance"
 * PUT and the CSV/XLSX import all hit the same endpoints with the same bodies
 * as the original page. The import is the reason this section exists at all,
 * so it stays a first-class control rather than a hidden link.
 *
 * `canWrite` is `leaves:write`, resolved server-side. Without it the balances
 * and the cutover date are still shown - they are worth reading - but nothing
 * that would 403 is offered. The routes enforce it independently regardless.
 */
export default function OpeningBalancesSection({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  const [balances, setBalances] = useState<OpeningBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editState, setEditState] = useState<EditState>({})
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])

  const [cutover, setCutover] = useState<{ date: string; saving: boolean; msg: { text: string; ok: boolean } | null }>(
    { date: '', saving: false, msg: null },
  )
  const [addForm, setAddForm] = useState({
    show: false, memberId: '', typeId: '', balance: '', note: '', saving: false,
    msg: null as { text: string; ok: boolean } | null,
  })
  const [importState, setImportState] = useState<{
    loading: boolean
    msg: { text: string; ok: boolean } | null
    errors: { row: number; reason: string }[]
  }>({ loading: false, msg: null, errors: [] })

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [wsRes, balRes, typesRes] = await Promise.all([
      fetch(`/api/ws/${slug}`),
      fetch(`/api/ws/${slug}/leave-balances`),
      fetch(`/api/ws/${slug}/leave-types`),
    ])
    if (wsRes.ok) {
      const d = await wsRes.json() as { leave_cutover_date?: string | null }
      setCutover(p => ({ ...p, date: d.leave_cutover_date ?? '' }))
    }
    if (balRes.ok) {
      const d = await balRes.json() as { balances: OpeningBalanceRow[] }
      setBalances(d.balances ?? [])
    }
    if (typesRes.ok) {
      const d = await typesRes.json() as { leaveTypes: LeaveTypeRow[] }
      setLeaveTypes(d.leaveTypes ?? [])
    }
    setLoading(false)
  }, [slug])

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/members?limit=200`)
    if (res.ok) {
      const d = await res.json() as { members: MemberOption[] }
      setMembers((d.members ?? []).filter(m => m.user_id && m.member_id))
    }
  }, [slug])

  useEffect(() => { void loadAll() }, [loadAll])

  async function saveCutoverDate() {
    const date = cutover.date
    setCutover(p => ({ ...p, saving: true, msg: null }))
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveCutoverDate: date || null }),
      })
      if (res.ok) {
        setCutover(p => ({
          ...p,
          msg: {
            text: date ? en.wsOpeningBalances.cutoverDateSaved : en.wsOpeningBalances.cutoverDateCleared,
            ok: true,
          },
        }))
      } else {
        const d = await res.json() as { error?: string }
        setCutover(p => ({ ...p, msg: { text: d.error ?? 'Failed to save', ok: false } }))
      }
    } finally {
      setCutover(p => ({ ...p, saving: false }))
    }
  }

  async function handleFileImport(file: File) {
    setImportState({ loading: true, msg: null, errors: [] })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ws/${slug}/leave-balances/import`, { method: 'POST', body: fd })
      const d = await res.json() as { imported?: number; errors?: { row: number; reason: string }[] }
      const imported = d.imported ?? 0
      const errors = d.errors ?? []
      setImportState({
        loading: false,
        msg: {
          text: en.wsOpeningBalances.importSuccess(imported) +
            (errors.length > 0 ? ` · ${en.wsOpeningBalances.importErrors(errors.length)}` : ''),
          ok: errors.length === 0,
        },
        errors,
      })
      if (imported > 0) void loadAll()
    } finally {
      setImportState(p => ({ ...p, loading: false }))
    }
  }

  function startEdit(row: OpeningBalanceRow) {
    setEditState(prev => ({
      ...prev,
      [row.id]: { balance_days: String(row.balance_days), note: row.note ?? '', saving: false, saved: false },
    }))
  }

  async function saveRow(row: OpeningBalanceRow) {
    const state = editState[row.id]
    if (!state) return
    const days = parseFloat(state.balance_days)
    if (isNaN(days) || days < 0) return
    setEditState(prev => ({ ...prev, [row.id]: { ...state, saving: true, saved: false } }))
    try {
      const res = await fetch(`/api/ws/${slug}/members/${row.member_record_id}/leave-balances`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ leave_type_id: row.leave_type_id, balance_days: days, note: state.note || null }]),
      })
      if (res.ok) {
        setBalances(prev => prev.map(b => (b.id === row.id ? { ...b, balance_days: days, note: state.note || null } : b)))
        setEditState(prev => ({ ...prev, [row.id]: { ...state, saving: false, saved: true } }))
      } else {
        setEditState(prev => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
      }
    } catch {
      setEditState(prev => ({ ...prev, [row.id]: { ...state, saving: false, saved: false } }))
    }
  }

  // memberId is the workspace member record id, not the user id.
  async function submitAdd() {
    const { memberId, typeId, balance, note } = addForm
    if (!memberId || !typeId) return
    const days = parseFloat(balance)
    if (isNaN(days) || days < 0) return
    setAddForm(p => ({ ...p, saving: true, msg: null }))
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
        setAddForm(p => ({ ...p, msg: { text: d.error ?? 'Failed to add', ok: false } }))
      }
    } finally {
      setAddForm(p => ({ ...p, saving: false }))
    }
  }

  const columns: Column<OpeningBalanceRow>[] = [
    {
      key: 'employee',
      header: en.wsOpeningBalances.colEmployee,
      render: row => (
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 500 }}>{row.user_full_name ?? row.user_email}</p>
          {row.user_full_name && <p className="t-muted" style={{ fontSize: '11px' }}>{row.user_email}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: en.wsOpeningBalances.colLeaveType,
      render: row => <span className="t-secondary">{row.leave_type_name}</span>,
    },
    {
      key: 'balance',
      header: en.wsOpeningBalances.colBalance,
      width: 130,
      render: (row) => {
        const editing = editState[row.id]
        return editing ? (
          <Input
            type="number" min={0} step={0.5}
            aria-label={en.wsOpeningBalances.colBalance}
            value={editing.balance_days}
            onChange={e => setEditState(prev => ({ ...prev, [row.id]: { ...editing, balance_days: e.target.value } }))}
            style={{ height: '36px' }}
          />
        ) : (
          <span style={{ fontWeight: 600 }}>{row.balance_days}</span>
        )
      },
    },
    {
      key: 'note',
      header: en.wsOpeningBalances.colNote,
      render: (row) => {
        const editing = editState[row.id]
        return editing ? (
          <Input
            aria-label={en.wsOpeningBalances.colNote}
            value={editing.note}
            onChange={e => setEditState(prev => ({ ...prev, [row.id]: { ...editing, note: e.target.value } }))}
            placeholder={en.wsOpeningBalances.addPlaceholderNote}
            style={{ height: '36px' }}
          />
        ) : (
          <span className="t-muted">{row.note ?? '—'}</span>
        )
      },
    },
    // Editing is reachable only from this column, so dropping it for a
    // read-only role also removes every path into the per-row editor.
    ...(canWrite
      ? [{
        key: 'actions',
        header: '',
        align: 'right' as const,
        width: 120,
        render: (row: OpeningBalanceRow) => {
          const editing = editState[row.id]
          if (!editing) {
            return <Button variant="secondary" size="sm" onClick={() => startEdit(row)}>Edit</Button>
          }
          return (
            <Button size="sm" loading={editing.saving} onClick={() => void saveRow(row)}>
              {editing.saving
                ? en.wsOpeningBalances.savingRow
                : editing.saved ? en.wsOpeningBalances.rowSaved : en.wsOpeningBalances.saveRow}
            </Button>
          )
        },
      }]
      : []),
  ]

  return (
    <Card className="fx-spring">
      <p className="t-h2">{en.wsOpeningBalances.sectionTitle}</p>
      <p className="t-muted" style={{ margin: '4px 0 18px' }}>{en.wsOpeningBalances.sectionDescription}</p>
      {!canWrite && (
        <p className="t-muted" style={{ margin: '-10px 0 18px' }}>{wsAdmin.settings.leaveReadOnlyNote}</p>
      )}

      {/* Cutover date */}
      <div style={{ paddingBottom: '18px', borderBottom: '1px solid var(--border)' }}>
        <Field label={en.wsOpeningBalances.cutoverDateLabel} htmlFor="ob-cutover" hint={en.wsOpeningBalances.cutoverDateHint}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Input
              id="ob-cutover"
              type="date"
              value={cutover.date}
              disabled={!canWrite}
              onChange={e => setCutover(p => ({ ...p, date: e.target.value }))}
              style={{ width: '190px' }}
            />
            {canWrite && (
              <Button size="sm" loading={cutover.saving} onClick={() => void saveCutoverDate()}>
                {en.wsOpeningBalances.cutoverDateSave}
              </Button>
            )}
          </div>
        </Field>
        {cutover.msg && (
          <p style={{ marginTop: '8px', fontSize: '13px', color: cutover.msg.ok ? 'var(--teal)' : 'var(--danger)' }}>
            {cutover.msg.text}
          </p>
        )}
      </div>

      {/* CSV / XLSX import */}
      {canWrite && (
        <div style={{ marginTop: '18px' }}>
          <Dropzone
            compact
            accept=".csv,.xlsx"
            disabled={importState.loading}
            label={en.wsOpeningBalances.importBtn}
            onFile={file => void handleFileImport(file)}
          />
          <p className="t-muted" style={{ marginTop: '8px' }}>{en.wsOpeningBalances.importHint}</p>
          {importState.msg && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: importState.msg.ok ? 'var(--teal)' : 'var(--danger)' }}>
              {importState.msg.text}
            </p>
          )}
          {importState.errors.length > 0 && (
            <div
              style={{
                marginTop: '8px', padding: '10px 12px',
                background: 'color-mix(in srgb, var(--danger) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                borderRadius: 'var(--radius-sm)', maxHeight: '140px', overflowY: 'auto',
              }}
            >
              {importState.errors.map((e, i) => (
                <p key={i} style={{ fontSize: '12px', color: 'var(--danger)', marginTop: i === 0 ? 0 : '4px' }}>
                  {e.row > 0 ? `Row ${e.row}: ` : ''}{e.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Balances */}
      <div style={{ marginTop: '16px' }}>
        {loading ? (
          <SkeletonText lines={3} />
        ) : (
          <DataTable
            columns={columns}
            rows={balances}
            rowKey={row => row.id}
            minWidth={700}
            empty={<EmptyState title={en.wsOpeningBalances.emptyNoBalances} />}
          />
        )}
      </div>

      {/* Add a balance */}
      {canWrite && (
        <div style={{ marginTop: '12px' }}>
          {!addForm.show ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setAddForm(p => ({ ...p, show: true })); void loadMembers() }}
            >
              + {en.wsOpeningBalances.addBtn}
            </Button>
          ) : (
            <div
              style={{
                padding: '14px', background: 'var(--surface-1)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'end' }}>
                <Field label={en.wsOpeningBalances.colEmployee} htmlFor="ob-member">
                  <Select
                    id="ob-member"
                    value={addForm.memberId}
                    onChange={e => setAddForm(p => ({ ...p, memberId: e.target.value }))}
                    options={[
                      { value: '', label: 'Select employee…' },
                      ...members.map(m => ({ value: m.member_id, label: `${m.full_name ?? m.email} (${m.email})` })),
                    ]}
                  />
                </Field>
                <Field label={en.wsOpeningBalances.colLeaveType} htmlFor="ob-type">
                  <Select
                    id="ob-type"
                    value={addForm.typeId}
                    onChange={e => setAddForm(p => ({ ...p, typeId: e.target.value }))}
                    options={[
                      { value: '', label: 'Select leave type…' },
                      ...leaveTypes.map(t => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </Field>
                <Field label="Days" htmlFor="ob-days">
                  <Input
                    id="ob-days" type="number" min={0} step={0.5} placeholder="0"
                    value={addForm.balance}
                    onChange={e => setAddForm(p => ({ ...p, balance: e.target.value }))}
                  />
                </Field>
                <Field label={en.wsOpeningBalances.colNote} htmlFor="ob-note">
                  <Input
                    id="ob-note"
                    value={addForm.note}
                    onChange={e => setAddForm(p => ({ ...p, note: e.target.value }))}
                    placeholder={en.wsOpeningBalances.addPlaceholderNote}
                  />
                </Field>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    size="sm"
                    loading={addForm.saving}
                    disabled={!addForm.memberId || !addForm.typeId || !addForm.balance}
                    onClick={() => void submitAdd()}
                  >
                    {en.wsOpeningBalances.saveRow}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setAddForm(p => ({ ...p, show: false, msg: null }))}>
                    {en.wsLeaves.cancelBtn}
                  </Button>
                </div>
              </div>
              {addForm.msg && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: addForm.msg.ok ? 'var(--teal)' : 'var(--danger)' }}>
                  {addForm.msg.text}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
