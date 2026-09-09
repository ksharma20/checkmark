'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, ConfirmDialog, DataTable, EmptyState, Field, IconButton,
  Input, Modal, Select, SkeletonText, StatCard, Textarea,
  type ChipTone, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsAssets } from '@/locales/en/ws-assets'
import { hrRecord } from '@/locales/en/documents'
import type { AssetStatus, AssetStatusCount, AssetWithAssignee } from '@/lib/db/queries/assets'
import type { MemberWithUserFull } from '@/lib/db/queries/workspaces'

// ─── Presentation ─────────────────────────────────────────────────────────────

const STATUS_TONE: Record<AssetStatus, ChipTone> = {
  assigned: 'verified',
  available: 'roadmap',
  repair: 'partial',
  retired: 'roadmap',
}

const STATUS_LABEL: Record<AssetStatus, string> = {
  assigned: wsAssets.statusAssigned,
  available: wsAssets.statusAvailable,
  repair: wsAssets.statusRepair,
  retired: wsAssets.statusRetired,
}

const CONDITIONS = [
  { value: 'good', label: wsAssets.conditionGood },
  { value: 'fair', label: wsAssets.conditionFair },
  { value: 'poor', label: wsAssets.conditionPoor },
]

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function assigneeName(a: AssetWithAssignee): string | null {
  if (!a.assignee_first_name) return null
  return `${a.assignee_first_name} ${a.assignee_last_name ?? ''}`.trim()
}

function countFor(counts: AssetStatusCount[], status: AssetStatus): number {
  return counts.find(c => c.status === status)?.count ?? 0
}

/** A member with an account behind it - the only kind that can hold an asset. */
type PickableMember = MemberWithUserFull & { user_id: string }

/**
 * Every active member of the workspace, paged 100 at a time.
 *
 * The picker offers MEMBERS, not employee records. Most members have no HR
 * record - one is written only when an admin fills in the directory form - so
 * an employee-backed list showed a real 34-person workspace a single name.
 * POST /assign takes the member and creates the record if the assignment needs
 * one.
 *
 * /members returns every membership status, so pending invites and departed
 * people are dropped here; the server rejects them anyway.
 */
async function fetchActiveMembers(slug: string): Promise<PickableMember[]> {
  const collected: MemberWithUserFull[] = []
  let offset = 0
  let total = Infinity
  while (collected.length < total) {
    const res = await fetch(`/api/ws/${slug}/members?limit=100&offset=${offset}`)
    if (!res.ok) break
    const data = await res.json() as { members?: MemberWithUserFull[]; total?: number }
    const page = data.members ?? []
    total = data.total ?? page.length
    collected.push(...page)
    offset += 100
    if (page.length === 0) break
  }
  return collected.filter((m): m is PickableMember => m.status === 'active' && m.user_id !== null)
}

/** Name if they have one, otherwise the email they signed in with. */
function memberLabel(m: PickableMember): string {
  return (m.full_name ?? '').trim() || m.email
}

/** Which row the add/edit modal is open for. `add` carries no asset. */
type FormTarget = { mode: 'add' } | { mode: 'edit'; asset: AssetWithAssignee }

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  canWrite: boolean
  /** assets:delete - removing a row from the register. */
  canDelete: boolean
  /** employees:read - without it the assign modal has nobody to offer. */
  canReadEmployees: boolean
}

export default function AssetsClient({ slug, canWrite, canDelete, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()

  const [assets, setAssets] = useState<AssetWithAssignee[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [counts, setCounts] = useState<AssetStatusCount[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [formFor, setFormFor] = useState<FormTarget | null>(null)
  const [assigning, setAssigning] = useState<AssetWithAssignee | null>(null)
  const [members, setMembers] = useState<PickableMember[]>([])

  const [deleteTarget, setDeleteTarget] = useState<AssetWithAssignee | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = category ? `?category=${encodeURIComponent(category)}` : ''
      const res = await fetch(`/api/ws/${slug}/assets${qs}`)
      if (!res.ok) { toast(wsAssets.loadFailed, 'error'); return }
      const data = await res.json() as {
        assets: AssetWithAssignee[]
        categories: string[]
        statusCounts: AssetStatusCount[]
      }
      setAssets(data.assets ?? [])
      setCategories(data.categories ?? [])
      setCounts(data.statusCounts ?? [])
    } finally {
      setLoading(false)
    }
  }, [slug, category, toast])

  useEffect(() => { void load() }, [load])

  // Loaded once and only when the viewer may see people; the assign modal is
  // the only thing that needs it.
  useEffect(() => {
    if (!canReadEmployees) return
    let cancelled = false
    void (async () => {
      const rows = await fetchActiveMembers(slug)
      if (!cancelled) setMembers(rows)
    })()
    return () => { cancelled = true }
  }, [slug, canReadEmployees])

  const inServiceValue = useMemo(
    () => assets.filter(a => a.status !== 'retired').reduce((t, a) => t + (a.purchase_value ?? 0), 0),
    [assets],
  )

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function patch(asset: AssetWithAssignee, body: Record<string, unknown>, message: string) {
    setBusyId(asset.id)
    try {
      const res = await fetch(`/api/ws/${slug}/assets/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as { asset?: AssetWithAssignee; error?: string }
      if (res.ok && data.asset) {
        setAssets(prev => prev.map(a => (a.id === asset.id ? data.asset! : a)))
        toast(message, 'success')
        await load()
      } else {
        toast(data.error ?? wsAssets.actionFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Returning goes through DELETE /assign rather than a status PATCH: the
   * holder and the status have to move together, and the API refuses a bare
   * status change into or out of `assigned` for exactly that reason.
   */
  async function returnAsset(asset: AssetWithAssignee) {
    setBusyId(asset.id)
    try {
      const res = await fetch(`/api/ws/${slug}/assets/${asset.id}/assign`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.ok) {
        toast(wsAssets.returned, 'success')
        await load()
      } else {
        toast(data.error ?? wsAssets.actionFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function assign(asset: AssetWithAssignee, userId: string) {
    setBusyId(asset.id)
    try {
      const res = await fetch(`/api/ws/${slug}/assets/${asset.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json().catch(() => ({})) as { asset?: AssetWithAssignee; error?: string }
      if (res.ok && data.asset) {
        const who = assigneeName(data.asset) ?? ''
        setAssigning(null)
        toast(wsAssets.assigned(who), 'success')
        await load()
      } else {
        toast(data.error ?? wsAssets.actionFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  /**
   * DELETE is a SOFT delete - the row keeps its assignment history, it just
   * leaves the register. The error stays inside the dialog rather than
   * becoming a toast, so the failed action and its explanation are in the
   * same place.
   */
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/assets/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setDeleteError(data.error ?? wsAssets.deleteFailed)
        return
      }
      setDeleteTarget(null)
      toast(wsAssets.deleted, 'success')
      await load()
    } finally {
      setDeleting(false)
    }
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  const columns: Column<AssetWithAssignee>[] = [
    {
      key: 'name',
      header: wsAssets.colAsset,
      render: a => (
        <div>
          <p style={{ fontWeight: 600, fontSize: '13px' }}>{a.name}</p>
          <p className="t-muted" style={{ fontSize: '11px' }}>
            {[a.category, a.purchase_value != null ? currency.format(a.purchase_value) : null]
              .filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'serial',
      header: wsAssets.colTagSerial,
      render: a => <span className="t-secondary" style={{ fontSize: '11.5px' }}>{a.serial_number ?? '—'}</span>,
    },
    {
      key: 'assignee',
      header: wsAssets.colAssignedTo,
      render: (a) => {
        const who = assigneeName(a)
        if (!who) return <span className="t-muted">—</span>
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar name={who} size={26} />
            <span style={{ fontSize: '12.5px' }}>{who}</span>
          </div>
        )
      },
    },
    {
      key: 'assigned_at',
      header: wsAssets.colIssued,
      render: a => <span className="t-secondary" style={{ fontSize: '11.5px' }}>{fmtDate(a.assigned_at)}</span>,
    },
    {
      // Read-only. Condition used to be an inline <Select> that PATCHed on
      // change - a consequential write dressed up as sorting a column, and
      // the one editable field with nowhere to state a consequence. It now
      // lives in the edit form with the rest of the record, which is the same
      // call the People directory made about its role dropdown.
      key: 'condition',
      header: wsAssets.colCondition,
      render: a => <span className="t-secondary">{a.condition ?? wsAssets.conditionUnset}</span>,
    },
    {
      key: 'status',
      header: wsAssets.colStatus,
      render: a => <Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip>,
    },
    {
      key: 'action',
      header: wsAssets.colAction,
      align: 'right',
      render: (a) => {
        if (!canWrite && !canDelete) return <span className="t-muted">—</span>
        const busy = busyId === a.id
        // Every other action keys off the HOLDER, not off the status: an
        // asset with a holder can only leave via Return (DELETE /assign),
        // which is precisely what the API now enforces. A legacy row that
        // reads 'available' while still holding an employee therefore still
        // offers the one button that can unstick it.
        const held = a.assigned_employee_id !== null
        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
            {canWrite && held && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void returnAsset(a)}>
                {wsAssets.actionReturn}
              </Button>
            )}
            {canWrite && a.status === 'available' && !held && (
              <Button size="sm" disabled={busy} onClick={() => setAssigning(a)}>
                {wsAssets.actionAssign}
              </Button>
            )}
            {canWrite && a.status === 'repair' && !held && (
              <Button
                variant="secondary" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'available' }, wsAssets.backInService)}
              >
                {wsAssets.actionBackInService}
              </Button>
            )}
            {/* An assigned asset has to come back before it can go to a
                workshop, so repair is offered only once it is in the pool. */}
            {canWrite && a.status === 'available' && !held && (
              <Button
                variant="ghost" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'repair' }, wsAssets.sentToRepair)}
              >
                {wsAssets.actionRepair}
              </Button>
            )}
            {canWrite && a.status !== 'retired' && !held && (
              <Button
                variant="ghost" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'retired' }, wsAssets.retired)}
              >
                {wsAssets.actionRetire}
              </Button>
            )}
            {canWrite && (
              <IconButton
                variant="plain"
                label={wsAssets.editAction}
                icon={<Pencil size={14} />}
                disabled={busy}
                onClick={() => setFormFor({ mode: 'edit', asset: a })}
              />
            )}
            {canDelete && (
              <IconButton
                variant="decline"
                label={wsAssets.deleteAction}
                icon={<Trash2 size={14} />}
                disabled={busy}
                onClick={() => { setDeleteError(null); setDeleteTarget(a) }}
              />
            )}
          </div>
        )
      },
    },
  ]

  const chips = ['', ...categories]

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1">{wsAssets.title}</h1>
          <p className="t-secondary" style={{ marginTop: '2px' }}>{wsAssets.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            className="btn btn-secondary btn-sm pressable"
            href={`/api/ws/${slug}/assets/export${category ? `?category=${encodeURIComponent(category)}` : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <Download size={14} aria-hidden /> {wsAssets.exportButton}
          </a>
          {canWrite && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setFormFor({ mode: 'add' })}>
              {wsAssets.addButton}
            </Button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '16px' }}>
        <StatCard label={wsAssets.statTotal} value={assets.length} hint={wsAssets.statTotalHint(currency.format(inServiceValue))} />
        <StatCard label={wsAssets.statAssigned} value={countFor(counts, 'assigned')} hint={wsAssets.statAssignedHint} accent="brand" />
        <StatCard label={wsAssets.statAvailable} value={countFor(counts, 'available')} hint={wsAssets.statAvailableHint} />
        <StatCard label={wsAssets.statRepair} value={countFor(counts, 'repair')} hint={wsAssets.statRepairHint} accent="amber" />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
        {chips.map(c => (
          <Chip key={c || 'all'} tone={category === c ? 'verified' : 'leave'} onClick={() => setCategory(c)}>
            {c || wsAssets.categoryAll}
          </Chip>
        ))}
      </div>

      <Card padded={false} style={{ marginTop: '14px', overflow: 'hidden' }}>
        <p className="t-h2" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          {wsAssets.registerTitle} <span className="t-muted" style={{ fontWeight: 500 }}>· {assets.length}</span>
        </p>
        {loading ? (
          <div style={{ padding: '18px 20px' }}><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={assets}
            rowKey={a => a.id}
            minWidth={980}
            empty={<EmptyState title={wsAssets.emptyTitle} hint={wsAssets.emptyHint} />}
          />
        )}
      </Card>

      {canWrite && formFor && (
        <AssetForm
          // Remounts between add and edit so the fields seed from the right
          // row - the state is initialised from `initial`, not synced to it.
          key={formFor.mode === 'edit' ? formFor.asset.id : 'add'}
          slug={slug}
          open
          initial={formFor.mode === 'edit' ? formFor.asset : undefined}
          categories={categories}
          onSave={async () => { setFormFor(null); await load() }}
          onClose={() => setFormFor(null)}
        />
      )}

      {/* Keyed by asset: remounting is what resets the picked employee, so
          there is no effect syncing state that a fresh mount already gives. */}
      {assigning && (
        <AssignAssetModal
          key={assigning.id}
          asset={assigning}
          members={members}
          busy={busyId === assigning.id}
          onClose={() => setAssigning(null)}
          onAssign={userId => void assign(assigning, userId)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
        onConfirm={() => void confirmDelete()}
        title={wsAssets.deleteTitle}
        body={deleteTarget ? wsAssets.deleteBody(deleteTarget.name) : ''}
        note={wsAssets.deleteNote}
        confirmLabel={wsAssets.deleteConfirm}
        busyLabel={wsAssets.deletingConfirm}
        cancelLabel={wsAssets.deleteCancel}
        loading={deleting}
        error={deleteError}
      />
    </div>
  )
}

// ─── Add / edit form ──────────────────────────────────────────────────────────

interface AssetFormProps {
  slug: string
  open: boolean
  /** Present when editing an existing row; absent when adding a new one. */
  initial?: AssetWithAssignee
  /** Free-text suggestions - whatever categories the workspace already uses. */
  categories: string[]
  onSave: () => void | Promise<void>
  onClose: () => void
}

/**
 * Add / edit an asset.
 *
 * One component for both, flipped by `initial`: POST creates, PATCH updates.
 *
 * It NEVER sends `status`, in either mode. The PATCH route owns the assignment
 * boundary - `status: 'assigned'` on an unheld asset is `ASSIGN_VIA_ENDPOINT`,
 * and any other status on a held one is `RETURN_FIRST` - so a form that round
 * -tripped the current status would 409 every time an assigned asset was
 * edited. Status moves through the row actions (assign / return / repair /
 * retire), which is the only place it can move correctly. On create the server
 * seeds `available`.
 *
 * Errors are local state rather than toasts: a validation failure belongs
 * beside the field that caused it, and the 422 `fields` map is what paints the
 * `invalid` borders.
 */
function AssetForm({ slug, open, initial, categories, onSave, onClose }: AssetFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [serial, setSerial] = useState(initial?.serial_number ?? '')
  const [condition, setCondition] = useState(initial?.condition ?? (initial ? '' : 'good'))
  const [value, setValue] = useState(initial?.purchase_value != null ? String(initial.purchase_value) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function save() {
    if (!name.trim()) {
      setFieldErrors({ name: 'REQUIRED' })
      setError(wsAssets.addNameRequired)
      return
    }
    setSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      const url = initial
        ? `/api/ws/${slug}/assets/${initial.id}`
        : `/api/ws/${slug}/assets`
      const res = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          serial_number: serial.trim() || null,
          condition: condition || null,
          purchase_value: value.trim() === '' ? null : Number(value),
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({})) as {
        error?: string
        code?: string
        fields?: Record<string, string>
      }
      if (!res.ok) {
        if (data.code === 'VALIDATION_ERROR' && data.fields) {
          setFieldErrors(data.fields)
          setError(
            data.fields.name === 'REQUIRED' ? wsAssets.addNameRequired
              : data.fields.purchase_value ? wsAssets.valueInvalid
                : wsAssets.validationFailed,
          )
          return
        }
        setError(data.error ?? wsAssets.saveFailed)
        return
      }
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  const categoryListId = 'asset-category-options'

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={520}
      title={initial ? wsAssets.editTitle : wsAssets.addTitle}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>{wsAssets.cancelButton}</Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            {initial ? wsAssets.saveSubmit : wsAssets.addSubmit}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label={wsAssets.fieldName} htmlFor="asset-name" required>
          <Input
            id="asset-name"
            autoFocus
            value={name}
            placeholder={wsAssets.fieldNamePlaceholder}
            invalid={!!fieldErrors.name}
            onChange={e => setName(e.target.value)}
          />
        </Field>
        <Field label={wsAssets.fieldCategory} htmlFor="asset-category">
          <Input
            id="asset-category"
            list={categoryListId}
            value={category}
            placeholder={wsAssets.fieldCategoryPlaceholder}
            invalid={!!fieldErrors.category}
            onChange={e => setCategory(e.target.value)}
          />
          {/* Free text with suggestions: categories are whatever this
              workspace already uses, not a fixed enum. */}
          <datalist id={categoryListId}>
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label={wsAssets.fieldSerial} htmlFor="asset-serial">
          <Input
            id="asset-serial"
            value={serial}
            placeholder={wsAssets.fieldSerialPlaceholder}
            invalid={!!fieldErrors.serial_number}
            onChange={e => setSerial(e.target.value)}
          />
        </Field>
        <Field label={wsAssets.fieldCondition} htmlFor="asset-condition">
          <Select
            id="asset-condition"
            value={condition}
            invalid={!!fieldErrors.condition}
            onChange={e => setCondition(e.target.value)}
            options={[{ value: '', label: wsAssets.conditionUnset }, ...CONDITIONS]}
          />
        </Field>
        <Field label={wsAssets.fieldValue} htmlFor="asset-value">
          <Input
            id="asset-value"
            type="number"
            min={0}
            value={value}
            placeholder={wsAssets.fieldValuePlaceholder}
            invalid={!!fieldErrors.purchase_value}
            onChange={e => setValue(e.target.value)}
          />
        </Field>
        <Field label={wsAssets.fieldNotes} htmlFor="asset-notes">
          <Textarea
            id="asset-notes"
            value={notes}
            rows={2}
            invalid={!!fieldErrors.notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Field>

        <p className="field-hint">{initial ? wsAssets.editHint : wsAssets.addHint}</p>

        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}

// ─── Assign modal ─────────────────────────────────────────────────────────────

function AssignAssetModal({
  asset, members, busy, onClose, onAssign,
}: {
  asset: AssetWithAssignee
  members: PickableMember[]
  busy: boolean
  onClose: () => void
  /** The MEMBER's user id - the API finds or creates the HR record behind it. */
  onAssign: (userId: string) => void
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [userId, setUserId] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title={wsAssets.assignTitle}
      maxWidth={420}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>{wsAssets.assignCancel}</Button>
          <Button
            size="sm"
            loading={busy}
            onClick={() => {
              if (!userId) { toast(wsAssets.assignEmployeeRequired, 'error'); return }
              onAssign(userId)
            }}
          >
            {wsAssets.assignSubmit}
          </Button>
        </>
      }
    >
      <p className="t-h2">{asset.name}</p>
      <p className="t-muted" style={{ marginTop: '2px' }}>
        {[asset.category, asset.serial_number].filter(Boolean).join(' · ') || '—'}
      </p>
      <div className="divider" />
      {members.length === 0 ? (
        // Not "add an employee record first" any more: the record is created
        // by the assignment, so the only way to have nobody is to have no
        // members.
        <p className="t-muted">{hrRecord.noMembers}</p>
      ) : (
        <Field label={wsAssets.assignEmployeeLabel} htmlFor="assign-employee">
          <Select
            id="assign-employee"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            options={[
              { value: '', label: wsAssets.assignEmployeePlaceholder },
              ...members.map(m => ({
                value: m.user_id,
                label: [memberLabel(m), m.department].filter(Boolean).join(' · '),
              })),
            ]}
          />
        </Field>
      )}
    </Modal>
  )
}
