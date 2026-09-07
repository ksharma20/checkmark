'use client'

import { useEffect, useRef } from 'react'
import { CalendarDays, Pencil, Trash2 } from 'lucide-react'
import { DataTable, EmptyState, IconButton, Skeleton } from '@/components/ui'
import type { Column } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'
import { formatDate } from './types'
import type { Holiday } from './types'

const t = wsAdmin.holidays

interface Props {
  holidays: Holiday[]
  loading: boolean
  year: number
  selectedIds: Set<string>
  canWrite: boolean
  canDelete: boolean
  onEdit: (holiday: Holiday) => void
  onDeleteRequest: (holiday: Holiday) => void
  onToggleId: (id: string) => void
  onToggleAll: (ids: string[]) => void
  onAddFirst: () => void
}

export function HolidayTable({
  holidays, loading, year, selectedIds, canWrite, canDelete,
  onEdit, onDeleteRequest, onToggleId, onToggleAll, onAddFirst,
}: Props) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const ids = holidays.map((h) => h.id)
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id))

  // "Some but not all" has no HTML attribute - it is a DOM property, so it can
  // only be set from an effect.
  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < ids.length
  }, [selectedIds, ids.length])

  if (loading) {
    return (
      <div className="stack-sm" style={{ padding: '16px 20px' }}>
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={38} radius="var(--radius-sm)" />)}
      </div>
    )
  }

  const columns: Column<Holiday>[] = [
    ...(canDelete
      ? [{
          key: 'select',
          width: 44,
          align: 'center' as const,
          header: (
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={ids.length === 0}
              aria-label={t.selectAll}
              onChange={() => onToggleAll(ids)}
              style={{ accentColor: 'var(--brand)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
          ),
          render: (row: Holiday) => (
            <input
              type="checkbox"
              checked={selectedIds.has(row.id)}
              aria-label={t.selectOne(row.name)}
              onChange={() => onToggleId(row.id)}
              style={{ accentColor: 'var(--brand)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
          ),
        }]
      : []),
    {
      key: 'name',
      header: t.colName,
      render: (row) => <span style={{ fontWeight: 600 }}>{row.name}</span>,
    },
    {
      key: 'date',
      header: t.colDate,
      width: 190,
      render: (row) => {
        const { full, day } = formatDate(row.date)
        return (
          <span className="mono" style={{ whiteSpace: 'nowrap' }}>
            {full} <span style={{ color: 'var(--brand)' }}>{day}</span>
          </span>
        )
      },
    },
    {
      key: 'description',
      header: t.colDescription,
      render: (row) =>
        row.description
          ? <span className="t-muted">{row.description}</span>
          : <span className="t-muted" aria-hidden>—</span>,
    },
    ...(canWrite || canDelete
      ? [{
          key: 'actions',
          header: t.colActions,
          width: 110,
          align: 'right' as const,
          render: (row: Holiday) => (
            <span style={{ display: 'inline-flex', gap: '4px', justifyContent: 'flex-end' }}>
              {canWrite && (
                <IconButton
                  variant="plain"
                  label={t.edit}
                  icon={<Pencil size={14} />}
                  onClick={() => onEdit(row)}
                />
              )}
              {canDelete && (
                <IconButton
                  variant="decline"
                  label={t.delete}
                  icon={<Trash2 size={14} />}
                  onClick={() => onDeleteRequest(row)}
                />
              )}
            </span>
          ),
        }]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      rows={holidays}
      rowKey={(row) => row.id}
      minWidth={680}
      empty={
        <EmptyState
          icon={<CalendarDays size={26} />}
          title={t.emptyTitle(year)}
          hint={
            canWrite ? (
              <button
                type="button"
                onClick={onAddFirst}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }}
              >
                {t.addBtn}
              </button>
            ) : t.emptyHint
          }
        />
      }
    />
  )
}
