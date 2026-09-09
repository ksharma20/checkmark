'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, Input, Modal, Select, SkeletonText } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsLeaveTypes as t } from '@/locales/en/ws-leave-types'
import { wsAdmin } from '@/locales/en/ws-settings'

export type AccrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'
export type CreditTiming = 'start' | 'end'

export interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: AccrualFrequency
  accrual_credits: number
  credit_timing: CreditTiming
}

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: t.optionMonthly },
  { value: 'quarterly', label: t.optionQuarterly },
  { value: 'half-yearly', label: t.optionHalfYearly },
  { value: 'yearly', label: t.optionYearly },
]

const TIMING_OPTIONS = [
  { value: 'start', label: t.optionTimingStart },
  { value: 'end', label: t.optionTimingEnd },
]

const PERIOD_WORD: Record<AccrualFrequency, string> = {
  monthly: 'month',
  quarterly: 'quarter',
  'half-yearly': '6 months',
  yearly: 'year',
}

function summarise(row: LeaveTypeRow): string {
  const credits = `${row.accrual_credits} credit${row.accrual_credits !== 1 ? 's' : ''}/${PERIOD_WORD[row.accrual_frequency]}`
  return `${credits} · ${row.credit_timing === 'end' ? t.timingEndShort : t.timingStartShort}`
}

/**
 * Per-workspace leave types and their accrual rate.
 *
 * `canWrite` is `leaves:write` and `canDelete` is `leaves:delete`, both resolved
 * server-side. They are SEPARATE props because the endpoints require separate
 * permissions - DELETE has always required `leaves:delete`, but this section
 * used to render the remove button behind `canWrite` alone, so a write-only
 * role was shown a button that answered 403.
 */
export default function LeaveTypesSection(
  { slug, canWrite, canDelete }: { slug: string; canWrite: boolean; canDelete: boolean },
) {
  const { show: toast } = useToast()
  const [types, setTypes] = useState<LeaveTypeRow[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AccrualFrequency>('monthly')
  const [credits, setCredits] = useState('1')
  const [timing, setTiming] = useState<CreditTiming>('start')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editing, setEditing] = useState<LeaveTypeRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LeaveTypeRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types`)
      if (res.ok) {
        const data = await res.json()
        setTypes(data.leaveTypes ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void loadTypes() }, [loadTypes])

  async function addType() {
    const trimmed = name.trim()
    if (!trimmed) { setAddError(t.nameRequired); return }
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          accrual_frequency: frequency,
          accrual_credits: Math.max(1, parseInt(credits, 10) || 1),
          credit_timing: timing,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTypes(prev => [...prev, data.leaveType as LeaveTypeRow])
        setName('')
        setFrequency('monthly')
        setCredits('1')
        setTiming('start')
      } else {
        setAddError(res.status === 409 ? t.duplicateName : (data as { error?: string }).error ?? t.updateFailed)
      }
    } finally {
      setAdding(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types/${pendingDelete.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTypes(prev => prev.filter(x => x.id !== pendingDelete.id))
        setPendingDelete(null)
        toast(t.deleted, 'success')
      } else {
        setDeleteError(t.deleteFailed)
      }
    } catch {
      setDeleteError(t.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="fx-spring">
      <p className="t-h2">{t.sectionTitle}</p>
      <p className="t-muted" style={{ margin: '4px 0 16px' }}>{t.sectionDescription}</p>
      {!canWrite && (
        <p className="t-muted" style={{ margin: '-8px 0 16px' }}>{wsAdmin.settings.leaveReadOnlyNote}</p>
      )}

      {loading ? (
        <SkeletonText lines={2} />
      ) : types.length === 0 ? (
        <p className="t-muted" style={{ marginBottom: '14px' }}>{t.emptyNoTypes}</p>
      ) : (
        <div className="stack-sm" style={{ marginBottom: '14px' }}>
          {types.map(row => (
            <div
              key={row.id}
              className="row-between"
              style={{
                padding: '10px 12px', background: 'var(--surface-1)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '13.5px' }}>
                {row.name}
                <span className="t-muted" style={{ marginLeft: '8px' }}>{summarise(row)}</span>
              </span>
              <span className="row-gap-sm">
                {canWrite && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                    {t.editAction}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDeleteError(null); setPendingDelete(row) }}
                    style={{ color: 'var(--danger)' }}
                  >
                    {t.deleteAction}
                  </Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
            <Field label={t.labelName} htmlFor="lt-name">
              <Input
                id="lt-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.placeholderName}
                invalid={!!addError && !name.trim()}
                onKeyDown={e => { if (e.key === 'Enter' && !adding) void addType() }}
              />
            </Field>
            <Field label={t.labelFrequency} htmlFor="lt-frequency">
              <Select
                id="lt-frequency"
                value={frequency}
                onChange={e => { setFrequency(e.target.value as AccrualFrequency); setCredits('1') }}
                options={FREQUENCY_OPTIONS}
              />
            </Field>
            <Field label={t.labelCredits} htmlFor="lt-credits">
              <Input id="lt-credits" type="number" min={1} max={365} value={credits} onChange={e => setCredits(e.target.value)} />
            </Field>
            <Field label={t.labelCreditTiming} htmlFor="lt-timing">
              <Select
                id="lt-timing"
                value={timing}
                onChange={e => setTiming(e.target.value as CreditTiming)}
                options={TIMING_OPTIONS}
              />
            </Field>
            <Button loading={adding} disabled={!name.trim()} onClick={() => void addType()}>
              {t.addType}
            </Button>
          </div>
          {addError && <p className="field-error" role="alert">{addError}</p>}
        </>
      )}

      <EditLeaveTypeModal
        slug={slug}
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={updated => {
          setTypes(prev => prev.map(x => (x.id === updated.id ? updated : x)))
          setEditing(null)
          toast(t.updated, 'success')
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => { setPendingDelete(null); setDeleteError(null) }}
        onConfirm={() => void confirmDelete()}
        title={t.deleteTitle}
        body={pendingDelete ? t.deleteBody(pendingDelete.name) : ''}
        note={t.deleteNote}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deletingConfirm}
        cancelLabel={t.deleteCancel}
        loading={deleting}
        error={deleteError}
      />
    </Card>
  )
}

/**
 * Edit one leave type.
 *
 * Deliberately a modal rather than an inline row form: the accrual fields carry
 * a consequence that has to be READ before it is accepted (see
 * `t.accrualChangeWarning`), and a warning inside a table row is a warning
 * nobody reads.
 */
function EditLeaveTypeModal({
  slug, initial, onClose, onSaved,
}: {
  slug: string
  initial: LeaveTypeRow | null
  onClose: () => void
  onSaved: (row: LeaveTypeRow) => void
}) {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AccrualFrequency>('monthly')
  const [credits, setCredits] = useState('1')
  const [timing, setTiming] = useState<CreditTiming>('start')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed every time a different row is opened.
  useEffect(() => {
    if (!initial) return
    setName(initial.name)
    setFrequency(initial.accrual_frequency)
    setCredits(String(initial.accrual_credits))
    setTiming(initial.credit_timing)
    setError(null)
  }, [initial])

  async function save() {
    if (!initial) return
    const trimmed = name.trim()
    if (!trimmed) { setError(t.nameRequired); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          accrual_frequency: frequency,
          accrual_credits: Math.max(1, parseInt(credits, 10) || 1),
          credit_timing: timing,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSaved(data.leaveType as LeaveTypeRow)
      } else {
        setError(res.status === 409 ? t.duplicateName : (data as { error?: string }).error ?? t.updateFailed)
      }
    } catch {
      setError(t.updateFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={initial !== null}
      onClose={onClose}
      title={t.editTitle}
      maxWidth={460}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>{t.editCancel}</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            {saving ? t.savingSubmit : t.saveSubmit}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={t.labelName} htmlFor="lt-edit-name" required>
          <Input
            id="lt-edit-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t.placeholderName}
            invalid={!!error && !name.trim()}
          />
        </Field>
        <Field label={t.labelFrequency} htmlFor="lt-edit-frequency">
          <Select
            id="lt-edit-frequency"
            value={frequency}
            onChange={e => setFrequency(e.target.value as AccrualFrequency)}
            options={FREQUENCY_OPTIONS}
          />
        </Field>
        <Field label={t.labelCredits} htmlFor="lt-edit-credits">
          <Input
            id="lt-edit-credits"
            type="number"
            min={1}
            max={365}
            value={credits}
            onChange={e => setCredits(e.target.value)}
          />
        </Field>
        <Field label={t.labelCreditTiming} htmlFor="lt-edit-timing">
          <Select
            id="lt-edit-timing"
            value={timing}
            onChange={e => setTiming(e.target.value as CreditTiming)}
            options={TIMING_OPTIONS}
          />
        </Field>
        <p className="field-hint">{t.accrualChangeWarning}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
