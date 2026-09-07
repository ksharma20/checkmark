'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Field, Input, Select, SkeletonText } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'

export type AccrualFrequency = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'

export interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: AccrualFrequency
  accrual_credits: number
}

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: en.wsLeaveTypes.optionMonthly },
  { value: 'quarterly', label: en.wsLeaveTypes.optionQuarterly },
  { value: 'half-yearly', label: en.wsLeaveTypes.optionHalfYearly },
  { value: 'yearly', label: en.wsLeaveTypes.optionYearly },
]

const PERIOD_WORD: Record<AccrualFrequency, string> = {
  monthly: 'month',
  quarterly: 'quarter',
  'half-yearly': '6 months',
  yearly: 'year',
}

/**
 * Per-workspace leave types and their accrual rate.
 *
 * Re-skinned onto the design-system primitives; the requests, the endpoints and
 * the confirm-before-delete behaviour are unchanged from the original page.
 *
 * `canWrite` is `leaves:write`, resolved server-side. It only decides which
 * controls are offered - POST/DELETE /api/ws/[slug]/leave-types enforce it
 * independently, exactly as before.
 */
export default function LeaveTypesSection({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  const [types, setTypes] = useState<LeaveTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AccrualFrequency>('monthly')
  const [credits, setCredits] = useState('1')
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const loadTypes = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/leave-types`)
    if (res.ok) {
      const data = await res.json()
      setTypes(data.leaveTypes ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { void loadTypes() }, [loadTypes])

  async function addType() {
    const trimmed = name.trim()
    if (!trimmed) return
    setAdding(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/leave-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          accrual_frequency: frequency,
          accrual_credits: Math.max(1, parseInt(credits, 10) || 1),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTypes(prev => [...prev, data.leaveType as LeaveTypeRow])
        setName('')
        setFrequency('monthly')
        setCredits('1')
        setStatus({ text: `"${(data.leaveType as LeaveTypeRow).name}" added`, ok: true })
      } else {
        setStatus({ text: (data as { error?: string }).error ?? 'Failed to add', ok: false })
      }
    } finally {
      setAdding(false)
    }
  }

  async function deleteType(id: string) {
    if (!confirm(en.wsLeaveTypes.deleteConfirm)) return
    const res = await fetch(`/api/ws/${slug}/leave-types/${id}`, { method: 'DELETE' })
    if (res.ok) setTypes(prev => prev.filter(t => t.id !== id))
  }

  return (
    <Card className="fx-spring">
      <p className="t-h2">{en.wsLeaveTypes.sectionTitle}</p>
      <p className="t-muted" style={{ margin: '4px 0 16px' }}>{en.wsLeaveTypes.sectionDescription}</p>
      {!canWrite && (
        <p className="t-muted" style={{ margin: '-8px 0 16px' }}>{wsAdmin.settings.leaveReadOnlyNote}</p>
      )}

      {loading ? (
        <SkeletonText lines={2} />
      ) : types.length === 0 ? (
        <p className="t-muted" style={{ marginBottom: '14px' }}>{en.wsLeaveTypes.emptyNoTypes}</p>
      ) : (
        <div className="stack-sm" style={{ marginBottom: '14px' }}>
          {types.map(t => (
            <div
              key={t.id}
              className="row-between"
              style={{
                padding: '10px 12px', background: 'var(--surface-1)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              }}
            >
              <span style={{ fontSize: '13.5px' }}>
                {t.name}
                <span className="t-muted" style={{ marginLeft: '8px' }}>
                  {`${t.accrual_credits} credit${t.accrual_credits !== 1 ? 's' : ''}/${PERIOD_WORD[t.accrual_frequency]}`}
                </span>
              </span>
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => void deleteType(t.id)} style={{ color: 'var(--danger)' }}>
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
          <Field label={en.wsLeaveTypes.labelName} htmlFor="lt-name">
            <Input
              id="lt-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={en.wsLeaveTypes.placeholderName}
              onKeyDown={e => { if (e.key === 'Enter') void addType() }}
            />
          </Field>
          <Field label={en.wsLeaveTypes.labelFrequency} htmlFor="lt-frequency">
            <Select
              id="lt-frequency"
              value={frequency}
              onChange={e => { setFrequency(e.target.value as AccrualFrequency); setCredits('1') }}
              options={FREQUENCY_OPTIONS}
            />
          </Field>
          <Field label={en.wsLeaveTypes.labelCredits} htmlFor="lt-credits">
            <Input id="lt-credits" type="number" min={1} max={365} value={credits} onChange={e => setCredits(e.target.value)} />
          </Field>
          <Button loading={adding} disabled={!name.trim()} onClick={() => void addType()}>
            {en.wsLeaveTypes.addType}
          </Button>
        </div>
      )}

      {status && (
        <p style={{ marginTop: '8px', fontSize: '13px', color: status.ok ? 'var(--teal)' : 'var(--danger)' }}>
          {status.text}
        </p>
      )}
    </Card>
  )
}
