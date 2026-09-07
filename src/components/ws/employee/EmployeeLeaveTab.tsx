'use client'

import { useCallback, useEffect, useState } from 'react'
import { Chip, DataTable, EmptyState, SkeletonText, type ChipTone, type Column } from '@/components/ui'
import { wsPerson } from '@/locales/en/ws-person'
import type { LeaveRequestWithType, LeaveTypeWithBalance } from '@/lib/db/queries/leaves'

/**
 * One person's leave, on their own page: what they have, and what they asked for.
 *
 * Read-only. Approving and rejecting live in the Approvals queue under
 * `Resource.Approvals`, which actions a request atomically with
 * `WHERE status = 'pending'` - that is what turns a double-click into a clean
 * 409 instead of a double-deduction. A second set of approve buttons here would
 * be a second write path onto the same rows.
 *
 * Balances are computed, never stored: `available = opening + accrued - used`,
 * with `used` counted in WORKING days. All four columns are shown rather than
 * just the total, because "why is it 8.5 and not 12" is the only question an
 * admin ever opens this panel to answer.
 */

const STATUS_TONE: Record<string, ChipTone> = {
  pending: 'partial',
  approved: 'verified',
  rejected: 'none',
}

const STATUS_LABEL: Record<string, string> = {
  pending: wsPerson.statusPending,
  approved: wsPerson.statusApproved,
  rejected: wsPerson.statusRejected,
}

/**
 * The outcome of a load, once it has finished. `pending-member` is kept apart
 * from `failed` on purpose: a 422 MEMBER_PENDING is not an error, it is the
 * honest answer for someone who has not accepted their invitation, and the two
 * must not read the same to an admin.
 *
 * "Still loading" is a separate boolean rather than a fourth value here, so the
 * skeleton can be switched off in a `finally` on every path - including the
 * throw - exactly as EmployeeActivityTab does.
 */
type LoadOutcome = 'ready' | 'failed' | 'pending-member'

interface Props {
  slug: string
  /**
   * A **workspace_members.id**, not a users.id - both endpoints this tab calls
   * take the membership record, because that row carries `added_at`, which is
   * the leave accrual start.
   */
  memberId: string
  /** Present so the tab's props match the Activity tab's contract and a future
   *  user-keyed call needs no signature change. Not read today. */
  userId: string
}

export default function EmployeeLeaveTab({ slug, memberId }: Props) {
  const base = `/api/ws/${slug}/members/${memberId}`

  const [types, setTypes] = useState<LeaveTypeWithBalance[]>([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesOutcome, setTypesOutcome] = useState<LoadOutcome>('ready')
  const [requests, setRequests] = useState<LeaveRequestWithType[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [requestsOutcome, setRequestsOutcome] = useState<LoadOutcome>('ready')

  // Two independent reads, two effects. Balances and history come from two
  // routes and fail independently: an admin whose workspace has no leave types
  // configured must still see the request history, and vice versa. Folding them
  // into one loader would make either failure blank the whole panel.

  const loadBalances = useCallback(async () => {
    setTypesLoading(true)
    try {
      const res = await fetch(`${base}/leave-summary`)
      if (!res.ok) { setTypesOutcome(res.status === 422 ? 'pending-member' : 'failed'); return }
      const data = await res.json() as { leaveTypes: LeaveTypeWithBalance[] }
      setTypes(data.leaveTypes ?? [])
      setTypesOutcome('ready')
    } catch {
      setTypesOutcome('failed')
    } finally {
      setTypesLoading(false)
    }
  }, [base])

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await fetch(`${base}/leave-requests`)
      if (!res.ok) { setRequestsOutcome(res.status === 422 ? 'pending-member' : 'failed'); return }
      const data = await res.json() as { requests: LeaveRequestWithType[] }
      setRequests(data.requests ?? [])
      setRequestsOutcome('ready')
    } catch {
      setRequestsOutcome('failed')
    } finally {
      setRequestsLoading(false)
    }
  }, [base])

  useEffect(() => { void loadBalances() }, [loadBalances])
  useEffect(() => { void loadRequests() }, [loadRequests])

  const balanceColumns: Column<LeaveTypeWithBalance>[] = [
    { key: 'name', header: wsPerson.balancesType },
    {
      key: 'available_days',
      header: wsPerson.balancesAvailable,
      align: 'right',
      render: (row) => <strong>{wsPerson.balancesDays(row.available_days)}</strong>,
    },
    { key: 'total_accrued', header: wsPerson.balancesAccrued, align: 'right' },
    { key: 'used_days', header: wsPerson.balancesUsed, align: 'right' },
    { key: 'opening_balance', header: wsPerson.balancesOpening, align: 'right' },
  ]

  const requestColumns: Column<LeaveRequestWithType>[] = [
    {
      key: 'start_date',
      header: wsPerson.requestsDates,
      render: (row) => (
        <span className="t-rowtitle">{dateRange(row.start_date, row.end_date)}</span>
      ),
    },
    { key: 'leave_type_name', header: wsPerson.requestsType },
    {
      key: 'status',
      header: wsPerson.requestsStatus,
      render: (row) => (
        <Chip tone={STATUS_TONE[row.status] ?? 'roadmap'}>{STATUS_LABEL[row.status] ?? row.status}</Chip>
      ),
    },
    {
      key: 'reason',
      header: wsPerson.requestsReason,
      render: (row) => (
        // A rejection without its reason is half a record, so the rejection
        // reason wins the cell whenever there is one.
        <span className="t-rowsub t-prewrap">
          {row.rejection_reason ? wsPerson.requestsRejectedFor(row.rejection_reason) : row.reason ?? '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="stack">
      <div className="card">
        <div className="t-h2 mb-12">{wsPerson.balancesTitle}</div>
        {typesLoading ? (
          <SkeletonText lines={4} />
        ) : typesOutcome === 'pending-member' ? (
          <EmptyState title={wsPerson.pendingTitle} hint={wsPerson.pendingHint} />
        ) : typesOutcome === 'failed' ? (
          <EmptyState title={wsPerson.balancesLoadFailed} />
        ) : (
          <DataTable
            columns={balanceColumns}
            rows={types}
            rowKey={(row) => row.id}
            minWidth={520}
            empty={<EmptyState title={wsPerson.balancesEmpty} hint={wsPerson.balancesEmptyHint} />}
          />
        )}
      </div>

      <div className="card">
        <div className="t-h2 mb-12">{wsPerson.requestsTitle}</div>
        {requestsLoading ? (
          <SkeletonText lines={4} />
        ) : requestsOutcome === 'pending-member' ? (
          <EmptyState title={wsPerson.pendingTitle} hint={wsPerson.pendingHint} />
        ) : requestsOutcome === 'failed' ? (
          <EmptyState title={wsPerson.requestsLoadFailed} />
        ) : (
          <DataTable
            columns={requestColumns}
            rows={requests}
            rowKey={(row) => row.id}
            minWidth={560}
            empty={<EmptyState title={wsPerson.requestsEmpty} hint={wsPerson.requestsEmptyHint} />}
          />
        )}
      </div>
    </div>
  )
}

/**
 * "3 – 7 Apr 2026", collapsing a single-day request to one date.
 *
 * The dates are plain YYYY-MM-DD calendar days, not timestamps, so they are
 * anchored at UTC noon before formatting - parsing "2026-04-03" and rendering it
 * in a negative-offset timezone otherwise shows the 2nd.
 */
function dateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`
}
