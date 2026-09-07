'use client'

import { useState } from 'react'
import { Avatar, Button, Card, Chip, EmptyState, Field, SkeletonText, Textarea } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsLeaveScreen } from '@/locales/en/ws-people'
import { displayName, formatRange, leaveDays, type LeaveRow } from './leave-shared'

interface Props {
  slug: string
  rows: LeaveRow[]
  loading: boolean
  canWrite: boolean
  onActioned: (id: string, status: 'approved' | 'rejected', reason: string | null) => void
}

/**
 * The queue: only what is still waiting on a decision.
 *
 * Declining requires a reason because the API requires one - the employee is
 * told why, and an admin cannot reject silently by clicking twice.
 */
export default function LeaveRequestsTab({ slug, rows, loading, canWrite, onActioned }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const pending = rows.filter(r => r.status === 'pending')

  async function action(row: LeaveRow, verb: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(row.id)
    try {
      const res = await fetch(`/api/ws/${slug}/leaves/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          verb === 'reject' ? { action: 'reject', rejection_reason: rejectionReason } : { action: 'approve' },
        ),
      })
      if (res.ok) {
        onActioned(row.id, verb === 'approve' ? 'approved' : 'rejected', rejectionReason ?? null)
        setDecliningId(null)
        setReason('')
        toast(verb === 'approve' ? wsLeaveScreen.approved : wsLeaveScreen.declined, 'success')
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast(data.error ?? wsLeaveScreen.requestActionFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <p className="t-h2" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        {wsLeaveScreen.pendingTitle}{' '}
        <span style={{ color: 'var(--amber)' }}>· {pending.length}</span>
      </p>

      {loading ? (
        <div style={{ padding: '18px 20px' }}><SkeletonText lines={3} /></div>
      ) : pending.length === 0 ? (
        <EmptyState title={wsLeaveScreen.pendingEmptyTitle} hint={wsLeaveScreen.pendingEmptyHint} />
      ) : (
        pending.map((row) => {
          const name = displayName(row)
          const days = leaveDays(row.start_date, row.end_date)
          const busy = busyId === row.id
          const declining = decliningId === row.id

          return (
            <div key={row.id} style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <Avatar name={name} />
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <p style={{ fontWeight: 600, fontSize: '14px' }}>{name}</p>
                  <p className="t-muted">{row.reason || row.user_email}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Chip tone="leave">{row.leave_type_name}</Chip>
                  <p className="t-secondary" style={{ marginTop: '5px', fontSize: '12px' }}>
                    {formatRange(row.start_date, row.end_date)} · {days}d
                  </p>
                </div>
                {canWrite && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="danger" size="sm" disabled={busy}
                      onClick={() => { setDecliningId(declining ? null : row.id); setReason('') }}
                    >
                      {wsLeaveScreen.decline}
                    </Button>
                    <Button size="sm" loading={busy && !declining} onClick={() => void action(row, 'approve')}>
                      {wsLeaveScreen.approve}
                    </Button>
                  </div>
                )}
              </div>

              {declining && (
                <div style={{ marginTop: '12px' }}>
                  <Field label={wsLeaveScreen.declineReasonLabel} htmlFor={`decline-${row.id}`} required>
                    <Textarea
                      id={`decline-${row.id}`}
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={wsLeaveScreen.declineReasonPlaceholder}
                      rows={2}
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <Button variant="ghost" size="sm" onClick={() => { setDecliningId(null); setReason('') }}>
                      {wsLeaveScreen.declineCancel}
                    </Button>
                    <Button
                      variant="danger" size="sm" loading={busy}
                      disabled={!reason.trim()}
                      onClick={() => void action(row, 'reject', reason.trim())}
                    >
                      {wsLeaveScreen.declineConfirm}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </Card>
  )
}
