'use client'

import { useEffect, useRef } from 'react'
import { Calendar, Pencil, Trash2 } from 'lucide-react'
import { HolidayForm } from './HolidayForm'
import { formatDate } from './types'
import type { Holiday } from './types'

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  color: 'var(--navy)',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
}

const cbCellStyle: React.CSSProperties = {
  width: '44px',
  padding: '0',
  textAlign: 'center',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
}

const COLS = [
  { label: 'Name', w: 'auto' },
  { label: 'Date', w: '180px' },
  { label: 'Description', w: 'auto' },
  { label: '', w: '76px' },
]

interface HolidayTableProps {
  holidays: Holiday[]
  loading: boolean
  year: number
  slug: string
  editingId: string | null
  selectedIds: Set<string>
  onEdit: (id: string) => void
  onDeleteRequest: (id: string) => void
  onToggleId: (id: string) => void
  onToggleAll: (selectableIds: string[]) => void
  onSaved: (h: Holiday) => void
  onCancelEdit: () => void
  onAddFirst: () => void
}

export function HolidayTable({
  holidays, loading, year, slug, editingId, selectedIds,
  onEdit, onDeleteRequest, onToggleId, onToggleAll,
  onSaved, onCancelEdit, onAddFirst,
}: HolidayTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const selectableIds = holidays.filter(h => editingId !== h.id).map(h => h.id)
  const selectableCount = selectableIds.length
  const allSelected = selectableCount > 0 && selectableIds.every(id => selectedIds.has(id))

  useEffect(() => {
    if (!selectAllRef.current) return
    const count = selectedIds.size
    selectAllRef.current.indeterminate = count > 0 && count < selectableCount
  }, [selectedIds, selectableCount])

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#CBD5E1' }}>
            <th style={{
              ...cbCellStyle,
              borderBottom: '1px solid var(--border)',
              borderRight: '1px solid var(--border)',
              position: 'sticky', top: 0, zIndex: 1,
              background: '#CBD5E1', width: '44px',
            }}>
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={() => onToggleAll(selectableIds)}
                disabled={loading || selectableCount === 0}
                style={{ cursor: 'pointer', accentColor: 'var(--brand)', width: '14px', height: '14px' }}
              />
            </th>
            {COLS.map(({ label, w }, i) => (
              <th key={i} style={{
                padding: '10px 16px', textAlign: 'left',
                fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                fontWeight: 600, color: 'var(--text-secondary)',
                verticalAlign: 'middle',
                borderBottom: '1px solid var(--border)',
                borderRight: i < COLS.length - 1 ? '1px solid var(--border)' : undefined,
                whiteSpace: 'nowrap', width: w,
                position: 'sticky', top: 0, zIndex: 1,
                background: '#CBD5E1',
              }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            [1,2,3,4,5].map(i => (
              <tr key={i}>
                <td style={{ ...cbCellStyle, padding: '12px' }}>
                  <div style={{ height: '14px', width: '14px', background: 'var(--surface-2)', borderRadius: '3px', margin: 'auto' }} />
                </td>
                {[140, 130, 200, 60].map((w, j, arr) => (
                  <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', borderRight: j < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <div style={{ height: '14px', background: 'var(--surface-2)', borderRadius: '4px', width: `${w}px` }} />
                  </td>
                ))}
              </tr>
            ))
          ) : holidays.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '56px 16px', textAlign: 'center' }}>
                <Calendar size={28} color="var(--border)" style={{ display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                  No holidays for {year}.
                </p>
                <button
                  type="button"
                  onClick={onAddFirst}
                  style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Add the first holiday
                </button>
              </td>
            </tr>
          ) : (
            holidays.map(h => {
              if (editingId === h.id) {
                return (
                  <tr key={h.id}>
                    <td colSpan={5} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                      <HolidayForm slug={slug} initial={h} onSave={onSaved} onCancel={onCancelEdit} />
                    </td>
                  </tr>
                )
              }

              const { full, day } = formatDate(h.date)
              const isSelected = selectedIds.has(h.id)
              return (
                <tr
                  key={h.id}
                  style={{ background: isSelected ? 'color-mix(in srgb, var(--brand) 6%, var(--surface-0))' : 'var(--surface-0)' }}
                >
                  <td style={cbCellStyle}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleId(h.id)}
                      style={{ cursor: 'pointer', accentColor: 'var(--brand)', width: '14px', height: '14px' }}
                    />
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{h.name}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    {full},&nbsp;
                    <span style={{ color: 'var(--brand)', fontWeight: 500 }}>{day}</span>
                  </td>
                  <td style={tdStyle}>
                    {h.description ? (
                      <span style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)' }}>
                        {h.description}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--border)' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', borderRight: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => onEdit(h.id)}
                        title="Edit"
                        style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRequest(h.id)}
                        title="Delete"
                        style={{ height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
