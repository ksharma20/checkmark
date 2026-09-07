'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, Field, Input, Modal, Select,
  SkeletonText, StatCard, Textarea,
  type ChipTone, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsAssets } from '@/locales/en/ws-people'
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

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  canWrite: boolean
  /** employees:read - without it the assign modal has nobody to offer. */
  canReadEmployees: boolean
}

export default function AssetsClient({ slug, canWrite, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()

  const [assets, setAssets] = useState<AssetWithAssignee[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [counts, setCounts] = useState<AssetStatusCount[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)
  const [assigning, setAssigning] = useState<AssetWithAssignee | null>(null)
  const [members, setMembers] = useState<PickableMember[]>([])

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
      key: 'condition',
      header: wsAssets.colCondition,
      render: (a) => (
        canWrite ? (
          <Select
            value={a.condition ?? ''}
            aria-label={wsAssets.fieldCondition}
            disabled={busyId === a.id}
            onChange={e => void patch(a, { condition: e.target.value || null }, wsAssets.conditionUpdated)}
            style={{ height: '34px', width: '104px', fontSize: '12px' }}
            options={[{ value: '', label: wsAssets.conditionUnset }, ...CONDITIONS]}
          />
        ) : (
          <span className="t-secondary">{a.condition ?? wsAssets.conditionUnset}</span>
        )
      ),
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
        if (!canWrite) return <span className="t-muted">—</span>
        const busy = busyId === a.id
        // Every other action keys off the HOLDER, not off the status: an
        // asset with a holder can only leave via Return (DELETE /assign),
        // which is precisely what the API now enforces. A legacy row that
        // reads 'available' while still holding an employee therefore still
        // offers the one button that can unstick it.
        const held = a.assigned_employee_id !== null
        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {held && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => void returnAsset(a)}>
                {wsAssets.actionReturn}
              </Button>
            )}
            {a.status === 'available' && !held && (
              <Button size="sm" disabled={busy} onClick={() => setAssigning(a)}>
                {wsAssets.actionAssign}
              </Button>
            )}
            {a.status === 'repair' && !held && (
              <Button
                variant="secondary" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'available' }, wsAssets.backInService)}
              >
                {wsAssets.actionBackInService}
              </Button>
            )}
            {/* An assigned asset has to come back before it can go to a
                workshop, so repair is offered only once it is in the pool. */}
            {a.status === 'available' && !held && (
              <Button
                variant="ghost" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'repair' }, wsAssets.sentToRepair)}
              >
                {wsAssets.actionRepair}
              </Button>
            )}
            {a.status !== 'retired' && !held && (
              <Button
                variant="ghost" size="sm" loading={busy}
                onClick={() => void patch(a, { status: 'retired' }, wsAssets.retired)}
              >
                {wsAssets.actionRetire}
              </Button>
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
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(v => !v)}>
              {showAdd ? wsAssets.cancelButton : wsAssets.addButton}
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

      {canWrite && showAdd && (
        <AddAssetForm
          slug={slug}
          categories={categories}
          onCancel={() => setShowAdd(false)}
          onAdded={async () => { setShowAdd(false); await load() }}
        />
      )}

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
    </div>
  )
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddAssetForm({
  slug, categories, onCancel, onAdded,
}: {
  slug: string
  categories: string[]
  onCancel: () => void
  onAdded: () => void | Promise<void>
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [serial, setSerial] = useState('')
  const [condition, setCondition] = useState('good')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim()) { toast(wsAssets.addNameRequired, 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/assets`, {
        method: 'POST',
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
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.ok) {
        toast(wsAssets.added, 'success')
        await onAdded()
      } else {
        toast(data.error ?? wsAssets.actionFailed, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginTop: '14px' }}>
      <p className="t-eyebrow" style={{ marginBottom: '10px' }}>{wsAssets.addFormTitle}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <Field label={wsAssets.fieldName} htmlFor="asset-name" required full>
          <Input id="asset-name" value={name} onChange={e => setName(e.target.value)} placeholder={wsAssets.fieldNamePlaceholder} />
        </Field>
        <Field label={wsAssets.fieldCategory} htmlFor="asset-category">
          <Input
            id="asset-category"
            list="asset-category-options"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder={wsAssets.fieldCategoryPlaceholder}
          />
          {/* Free text with suggestions: categories are whatever this
              workspace already uses, not a fixed enum. */}
          <datalist id="asset-category-options">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label={wsAssets.fieldSerial} htmlFor="asset-serial">
          <Input id="asset-serial" value={serial} onChange={e => setSerial(e.target.value)} placeholder={wsAssets.fieldSerialPlaceholder} />
        </Field>
        <Field label={wsAssets.fieldCondition} htmlFor="asset-condition">
          <Select id="asset-condition" value={condition} onChange={e => setCondition(e.target.value)} options={CONDITIONS} />
        </Field>
        <Field label={wsAssets.fieldValue} htmlFor="asset-value">
          <Input id="asset-value" type="number" min={0} value={value} onChange={e => setValue(e.target.value)} placeholder={wsAssets.fieldValuePlaceholder} />
        </Field>
        <Field label={wsAssets.fieldNotes} htmlFor="asset-notes" full>
          <Textarea id="asset-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <Button loading={saving} onClick={() => void submit()}>{wsAssets.addSubmit}</Button>
        <Button variant="secondary" onClick={onCancel}>{wsAssets.cancelButton}</Button>
      </div>
      <p className="t-muted" style={{ marginTop: '10px' }}>{wsAssets.addHint}</p>
    </Card>
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
