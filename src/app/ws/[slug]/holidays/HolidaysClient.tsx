'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Upload } from 'lucide-react'
import { Button, Card, Dropzone, IconButton } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'
import { HolidayForm } from './HolidayForm'
import { HolidayTable } from './HolidayTable'
import { BulkDeleteModal, DeleteModal } from './HolidayModals'
import type { Holiday } from './types'

const t = wsAdmin.holidays

interface ImportMessage {
  text: string
  ok: boolean
  errors?: { row: number; reason: string }[]
}

interface Props {
  slug: string
  canWrite: boolean
  canDelete: boolean
}

export default function HolidaysClient({ slug, canWrite, canDelete }: Props) {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(() => new Date().getFullYear())

  const [formFor, setFormFor] = useState<{ mode: 'add' } | { mode: 'edit'; holiday: Holiday } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<ImportMessage | null>(null)

  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/ws/${slug}/holidays?year=${year}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        setHolidays(data?.holidays ?? [])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug, year, refreshKey])

  useEffect(() => { setSelectedIds(new Set()) }, [year, refreshKey])

  /** CSV / XLSX upload. The 2 MB cap and row validation are enforced server-side. */
  async function handleImport(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/ws/${slug}/holidays`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setImportMsg({ text: data.error ?? t.importFailed, ok: false })
        return
      }
      const rowErrors: { row: number; reason: string }[] = data.errors ?? []
      setImportMsg({
        text: t.importResult(data.inserted ?? 0, data.updated ?? 0, rowErrors.length),
        ok: (data.inserted ?? 0) + (data.updated ?? 0) > 0,
        errors: rowErrors.length > 0 ? rowErrors : undefined,
      })
      setRefreshKey((k) => k + 1)
    } finally {
      setImporting(false)
    }
  }

  async function deleteOne(id: string) {
    const res = await fetch(`/api/ws/${slug}/holidays/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHolidays((prev) => prev.filter((h) => h.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
    setDeleteTarget(null)
  }

  async function bulkDelete() {
    setBulkDeleting(true)
    try {
      const results = await Promise.all(
        [...selectedIds].map(async (id) => ({
          id,
          ok: (await fetch(`/api/ws/${slug}/holidays/${id}`, { method: 'DELETE' })).ok,
        })),
      )
      const deleted = new Set(results.filter((r) => r.ok).map((r) => r.id))
      const failed = results.length - deleted.size

      setHolidays((prev) => prev.filter((h) => !deleted.has(h.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        deleted.forEach((id) => next.delete(id))
        return next
      })
      setConfirmBulk(false)
      if (failed > 0) setImportMsg({ text: t.bulkDeleteFailed(failed), ok: false })
    } finally {
      setBulkDeleting(false)
    }
  }

  function onSaved(holiday: Holiday) {
    setHolidays((prev) => {
      const idx = prev.findIndex((h) => h.id === holiday.id)
      const next = idx >= 0 ? prev.map((h) => (h.id === holiday.id ? holiday : h)) : [...prev, holiday]
      return next.sort((a, b) => a.date.localeCompare(b.date))
    })
    setFormFor(null)
    // A holiday can be saved into a different year than the one on screen.
    if (!holiday.date.startsWith(String(year))) setRefreshKey((k) => k + 1)
  }

  return (
    <>
      <div className="row-between fx-snap" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1">{t.pageTitle}</h1>
          <p className="t-secondary" style={{ marginTop: '4px' }}>{t.pageSubtitle(year)}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IconButton
              variant="plain"
              label={t.prevYear}
              icon={<ChevronLeft size={16} />}
              onClick={() => setYear((y) => y - 1)}
            />
            <span className="t-h2 mono" style={{ minWidth: '58px', textAlign: 'center' }}>{year}</span>
            <IconButton
              variant="plain"
              label={t.nextYear}
              icon={<ChevronRight size={16} />}
              onClick={() => setYear((y) => y + 1)}
            />
          </span>

          {canWrite && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<Upload size={14} />}
                onClick={() => setShowImport((v) => !v)}
              >
                {importing ? t.importingBtn : t.importBtn}
              </Button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormFor({ mode: 'add' })}>
                {t.addBtn}
              </Button>
            </>
          )}
        </div>
      </div>

      {canWrite && showImport && (
        <Card className="fx-spring" style={{ marginTop: '14px' }}>
          <div className="row-between" style={{ marginBottom: '10px' }}>
            <p className="t-eyebrow">{t.importTitle}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>{t.importClose}</Button>
          </div>
          <Dropzone
            label={t.importDropLabel}
            accept=".csv,.xlsx,.xls"
            disabled={importing}
            onFile={handleImport}
          />
          <p className="t-muted" style={{ marginTop: '8px' }}>{t.importHint}</p>
        </Card>
      )}

      {importMsg && (
        <Card
          className="fx-snap"
          style={{
            marginTop: '14px',
            borderColor: importMsg.ok
              ? 'color-mix(in srgb, var(--brand) 40%, transparent)'
              : 'color-mix(in srgb, var(--danger) 40%, transparent)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '13px', color: importMsg.ok ? 'var(--brand)' : 'var(--danger)' }}>
                {importMsg.text}
              </p>
              {importMsg.errors && (
                <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px' }} className="t-muted">
                  {importMsg.errors.map((e) => (
                    <li key={e.row}>{t.importRowError(e.row, e.reason)}</li>
                  ))}
                </ul>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setImportMsg(null)}>{t.dismiss}</Button>
          </div>
        </Card>
      )}

      {selectedIds.size > 0 && canDelete && (
        <Card
          className="fx-snap"
          style={{ marginTop: '14px', borderColor: 'color-mix(in srgb, var(--danger) 35%, transparent)' }}
        >
          <div className="row-between" style={{ flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '13px' }}>
              {t.selectedCount(selectedIds.size)}
            </span>
            <span style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t.deselectAll}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmBulk(true)}>
                {t.bulkDeleteBtn(selectedIds.size)}
              </Button>
            </span>
          </div>
        </Card>
      )}

      <Card className="fx-spring" padded={false} style={{ marginTop: '14px', overflow: 'hidden' }}>
        <HolidayTable
          holidays={holidays}
          loading={loading}
          year={year}
          selectedIds={selectedIds}
          canWrite={canWrite}
          canDelete={canDelete}
          onEdit={(holiday) => setFormFor({ mode: 'edit', holiday })}
          onDeleteRequest={setDeleteTarget}
          onToggleId={(id) =>
            setSelectedIds((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
          onToggleAll={(ids) =>
            setSelectedIds((prev) =>
              ids.every((id) => prev.has(id)) ? new Set() : new Set(ids),
            )
          }
          onAddFirst={() => setFormFor({ mode: 'add' })}
        />
      </Card>

      {!loading && holidays.length > 0 && (
        <p className="t-muted" style={{ marginTop: '10px' }}>{t.footerCount(holidays.length, year)}</p>
      )}

      {formFor && (
        <HolidayForm
          // Remounts between add and edit so the fields seed from the right row.
          key={formFor.mode === 'edit' ? formFor.holiday.id : 'add'}
          slug={slug}
          open
          initial={formFor.mode === 'edit' ? formFor.holiday : undefined}
          onSave={onSaved}
          onClose={() => setFormFor(null)}
        />
      )}

      <DeleteModal
        holiday={deleteTarget}
        onConfirm={() => deleteTarget && deleteOne(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <BulkDeleteModal
        open={confirmBulk}
        count={selectedIds.size}
        deleting={bulkDeleting}
        onConfirm={bulkDelete}
        onCancel={() => setConfirmBulk(false)}
      />
    </>
  )
}
