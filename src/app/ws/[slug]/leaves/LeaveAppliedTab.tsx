'use client'

import { useState } from 'react'
import {
  Avatar, Card, Chip, DataTable, EmptyState, SkeletonText,
  type Column,
} from '@/components/ui'
import { wsLeaveScreen } from '@/locales/en/ws-people'
import {
  LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE, displayName, formatRange, leaveDays,
  type LeaveRow,
} from './leave-shared'

const FILTERS = [
  { key: '', label: wsLeaveScreen.filterAll },
  { key: 'pending', label: wsLeaveScreen.filterPending },
  { key: 'approved', label: wsLeaveScreen.filterApproved },
  { key: 'rejected', label: wsLeaveScreen.filterRejected },
]

interface Props {
  rows: LeaveRow[]
  loading: boolean
}

/**
 * Every leave ever applied for, filtered by status.
 *
 * Purely an operational view. Leave types and opening balances are workspace
 * configuration and live in Settings, so this screen stays a queue.
 */
export default function LeaveAppliedTab({ rows, loading }: Props) {
  const [filter, setFilter] = useState('')

  const visible = filter ? rows.filter(r => r.status === filter) : rows

  const columns: Column<LeaveRow>[] = [
    {
      key: 'employee',
      header: wsLeaveScreen.colEmployee,
      render: (row) => {
        const name = displayName(row)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={name} size={28} />
            <span>{name}</span>
          </div>
        )
      },
    },
    {
      key: 'type',
      header: wsLeaveScreen.colType,
      render: row => <Chip tone="leave">{row.leave_type_name}</Chip>,
    },
    {
      key: 'dates',
      header: wsLeaveScreen.colDates,
      render: row => <span className="t-secondary">{formatRange(row.start_date, row.end_date)}</span>,
    },
    {
      key: 'days',
      header: wsLeaveScreen.colDays,
      render: row => <span className="t-secondary">{leaveDays(row.start_date, row.end_date)}</span>,
    },
    {
      key: 'status',
      header: wsLeaveScreen.colStatus,
      render: row => (
        <Chip tone={LEAVE_STATUS_TONE[row.status] ?? 'leave'}>
          {LEAVE_STATUS_LABEL[row.status] ?? row.status}
        </Chip>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <Chip
            key={f.key || 'all'}
            tone={filter === f.key ? 'verified' : 'leave'}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.key ? rows.filter(r => r.status === f.key).length : rows.length})
          </Chip>
        ))}
      </div>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '18px 20px' }}><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={row => row.id}
            minWidth={720}
            empty={<EmptyState title={wsLeaveScreen.appliedEmptyTitle} hint={wsLeaveScreen.appliedEmptyHint} />}
          />
        )}
      </Card>
    </div>
  )
}
