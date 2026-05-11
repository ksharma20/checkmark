'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar, Upload, Trash2 } from 'lucide-react'
import { HolidayForm } from './HolidayForm'
import { HolidayTable } from './HolidayTable'
import { DeleteModal, BulkDeleteModal } from './HolidayModals'
import { MoreMenu } from './MoreMenu'
import { formatDateRange } from './types'
import type { Holiday } from './types'

export default function HolidaysPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string)

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean; errors?: { row: number; reason: string }[] } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchHolidays() {
      setLoading(true)
      const res = await fetch(`/api/ws/${slug}/holidays?year=${year}`)
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        setHolidays(data.holidays ?? [])
      }
      setLoading(false)
    }
    fetchHolidays()
    return () => { cancelled = true }
  }, [slug, year, refreshKey])

  useEffect(() => { setSelectedIds(new Set()) }, [year, refreshKey])

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true); setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/ws/${slug}/holidays`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setImportMsg({ text: data.error ?? 'Import failed', ok: false }); return }
      const rowErrors: { row: number; reason: string }[] = data.errors ?? []
      const skippedPart = rowErrors.length > 0 ? `, ${rowErrors.length} skipped` : ''
      setImportMsg({
        text: `Imported: ${data.inserted} added, ${data.updated} updated${skippedPart}`,
        ok: data.inserted + data.updated > 0,
        errors: rowErrors.length > 0 ? rowErrors : undefined,
      })
      setRefreshKey(k => k + 1)
    } finally { setImporting(false) }
  }

  async function deleteHoliday(id: string) {
    const res = await fetch(`/api/ws/${slug}/holidays/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHolidays(prev => prev.filter(h => h.id !== id))
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      setConfirmDeleteId(null)
    }
  }

  async function bulkDelete() {
    setBulkDeleting(true)
    try {
      const results = await Promise.all(
        [...selectedIds].map(async id => ({ id, ok: (await fetch(`/api/ws/${slug}/holidays/${id}`, { method: 'DELETE' })).ok }))
      )
      const deletedIds = new Set(results.filter(r => r.ok).map(r => r.id))
      const failedCount = results.length - deletedIds.size

      setHolidays(prev => prev.filter(h => !deletedIds.has(h.id)))
      setSelectedIds(prev => { const next = new Set(prev); deletedIds.forEach(id => next.delete(id)); return next })
      setConfirmBulkDelete(false)

      if (failedCount > 0) {
        setImportMsg({ text: `${failedCount} holiday${failedCount !== 1 ? 's' : ''} could not be deleted`, ok: false })
      }
    } finally { setBulkDeleting(false) }
  }

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll(selectableIds: string[]) {
    const allSelected = selectableIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds))
  }

  function onSaved(holiday: Holiday) {
    setHolidays(prev => {
      const idx = prev.findIndex(h => h.id === holiday.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = holiday
        return next.sort((a, b) => a.date.localeCompare(b.date))
      }
      return [...prev, holiday].sort((a, b) => a.date.localeCompare(b.date))
    })
    setShowAdd(false); setEditingId(null)
  }

  const iconBtn = (active?: boolean): React.CSSProperties => ({
    height: '32px', width: '32px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'transparent',
    border: active ? '1px solid var(--brand)' : '1px solid var(--border)',
    borderRadius: '6px', cursor: 'pointer',
    color: active ? 'var(--brand)' : 'var(--text-secondary)',
  })

  const deleteTarget = confirmDeleteId ? holidays.find(h => h.id === confirmDeleteId) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', padding: '0 28px' }}>
      {deleteTarget && (
        <DeleteModal
          holiday={deleteTarget}
          onConfirm={() => deleteHoliday(deleteTarget.id)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {confirmBulkDelete && (
        <BulkDeleteModal
          count={selectedIds.size}
          onConfirm={bulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
          deleting={bulkDeleting}
        />
      )}

      {/* ── Title ── */}
      <div style={{ padding: '20px 0 12px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
          Holidays Calendar
        </h1>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-0)', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" onClick={() => setYear(y => y - 1)} style={iconBtn()}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
            <Calendar size={15} />
          </span>
          <button type="button" onClick={() => setYear(y => y + 1)} style={iconBtn()}>
            <ChevronRight size={15} />
          </button>
          <span style={{ marginLeft: '8px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: 'var(--navy)' }}>
            {formatDateRange(year)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{ height: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: importing ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--navy)', opacity: importing ? 0.6 : 1 }}
          >
            <Upload size={13} />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <MoreMenu onAdd={() => { setShowAdd(true); setEditingId(null) }} />
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'color-mix(in srgb, var(--danger) 8%, var(--surface-0))', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', borderTop: 'none' }}>
          <span style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', fontWeight: 500 }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => setSelectedIds(new Set())} style={{ height: '30px', padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Deselect all
            </button>
            <button type="button" onClick={() => setConfirmBulkDelete(true)} style={{ height: '30px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}>
              <Trash2 size={12} />
              Delete {selectedIds.size}
            </button>
          </div>
        </div>
      )}

      {/* ── Import status ── */}
      {importMsg && (
        <div style={{ margin: '10px 0 0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: importMsg.ok ? 'var(--teal)' : 'var(--danger)', background: importMsg.ok ? 'color-mix(in srgb, var(--teal) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 10%, transparent)', border: `1px solid ${importMsg.ok ? 'color-mix(in srgb, var(--teal) 30%, transparent)' : 'color-mix(in srgb, var(--danger) 30%, transparent)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span>{importMsg.text}</span>
            {importMsg.errors && (
              <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', fontSize: '12px', color: 'var(--danger)', lineHeight: 1.7 }}>
                {importMsg.errors.map(e => (
                  <li key={e.row}>Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setImportMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 0 0 12px', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── Add form ── */}
      {showAdd && (
        <div style={{ padding: '12px 0 0' }}>
          <HolidayForm slug={slug} onSave={onSaved} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* ── Table ── */}
      <HolidayTable
        holidays={holidays}
        loading={loading}
        year={year}
        slug={slug}
        editingId={editingId}
        selectedIds={selectedIds}
        onEdit={id => { setEditingId(id); setShowAdd(false) }}
        onDeleteRequest={setConfirmDeleteId}
        onToggleId={toggleId}
        onToggleAll={toggleAll}
        onSaved={onSaved}
        onCancelEdit={() => setEditingId(null)}
        onAddFirst={() => setShowAdd(true)}
      />

      {/* ── Footer count ── */}
      {!loading && holidays.length > 0 && (
        <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', margin: 0 }}>
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {year}
            {selectedIds.size > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--danger)', fontWeight: 500 }}>
                · {selectedIds.size} selected
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
