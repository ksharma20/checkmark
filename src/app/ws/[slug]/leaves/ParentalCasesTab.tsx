'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, ConfirmDialog, EmptyState, Field, Input, Modal, Progress,
  Select, SkeletonText, StageDots, StatCard, Textarea,
  type ChipTone, type Stage,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsParental } from '@/locales/en/ws-parental'
import { hrRecord } from '@/locales/en/documents'
import type { MaternityCaseWithEmployee, MaternityStatus } from '@/lib/db/queries/maternity'
// From the PURE module, not the query file: this is a client component, and a
// runtime import from lib/db/queries/* pulls the SQLite driver into the bundle.
import { DEFAULT_CASE_WEEKS, type ParentalCaseType } from '@/lib/parental'
import type { MemberWithUserFull } from '@/lib/db/queries/workspaces'
import { formatLongDate } from './leave-shared'

/**
 * ONE component for both the Maternity and the Paternity tab.
 *
 * They are not two screens that happen to look alike - they are the same screen
 * over `maternity_cases` rows discriminated by `case_type`, with the same stage
 * machine, the same reminder gate and the same edit and delete paths. Copying
 * this file for paternity would have meant every later fix landing on one tab
 * and not the other, which is how the two would end up disagreeing about what a
 * legal stage move is.
 *
 * Everything that genuinely differs between them is a function of `caseType`:
 * the copy (via `wsParental`), the default entitlement (`DEFAULT_CASE_WEEKS`)
 * and how the dates are derived from the due date (`deriveDates`). Nothing else
 * branches.
 */

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const STAGES: readonly MaternityStatus[] = ['requested', 'approved', 'onleave', 'returned']

const STAGE_LABEL: Record<MaternityStatus, string> = {
  requested: wsParental.stageRequested,
  approved: wsParental.stageApproved,
  onleave: wsParental.stageOnLeave,
  returned: wsParental.stageReturned,
}

const STAGE_TONE: Record<MaternityStatus, ChipTone> = {
  requested: 'partial',
  approved: 'leave',
  onleave: 'override',
  returned: 'verified',
}

const STAGE_DOTS: Stage[] = STAGES.map(s => ({ key: s, label: STAGE_LABEL[s] }))

/**
 * The legal moves out of each stage, mirroring ALLOWED_TRANSITIONS in
 * lib/db/queries/maternity.ts. Forward-only, plus the one revoke edge; the
 * server rejects anything else with a 409, so offering a button for an illegal
 * move would only ever produce an error toast.
 *
 * SHARED by both case types, exactly as the server-side machine is: the
 * lifecycle of a parental leave case does not depend on which parent takes it.
 */
const NEXT_MOVES: Record<MaternityStatus, readonly { to: MaternityStatus; label: string; primary: boolean }[]> = {
  requested: [{ to: 'approved', label: wsParental.maternityApprove, primary: true }],
  approved: [
    { to: 'requested', label: wsParental.maternityRevoke, primary: false },
    { to: 'onleave', label: wsParental.maternityMarkOnLeave, primary: true },
  ],
  onleave: [{ to: 'returned', label: wsParental.maternityMarkReturned, primary: true }],
  returned: [],
}

/** 0 before leave starts, 100 once returned, elapsed share while on leave. */
export function caseProgress(c: MaternityCaseWithEmployee): number {
  if (c.status === 'returned') return 100
  if (c.status !== 'onleave' || !c.start_date || !c.end_date) return 0
  const start = new Date(`${c.start_date}T00:00:00`).getTime()
  const end = new Date(`${c.end_date}T00:00:00`).getTime()
  if (!(end > start)) return 0
  const pct = Math.round(((Date.now() - start) / (end - start)) * 100)
  // Clamped away from the ends so a bar that has begun never reads as empty
  // and one still running never reads as finished.
  return Math.max(2, Math.min(98, pct))
}

function caseName(c: MaternityCaseWithEmployee): string {
  return `${c.employee_first_name} ${c.employee_last_name}`.trim() || c.employee_work_email
}

/** A member with an account behind it - the only kind a case can be filed for. */
type PickableMember = MemberWithUserFull & { user_id: string }

/**
 * Every active member of the workspace, paged 100 at a time.
 *
 * The form offers MEMBERS, not employee records. Most members have no HR
 * record - one is written only when an admin fills in the directory form - so
 * an employee-backed list showed a real 34-person workspace a single name.
 * POST /maternity takes the member and creates the record if the case needs
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

// ─── Tab ──────────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  /** Which entitlement this tab lists. The only thing that differs between the two tabs. */
  caseType: ParentalCaseType
  canWrite: boolean
  /** employees:read - the new-case form needs someone to file against. */
  canReadEmployees: boolean
}

export default function ParentalCasesTab({ slug, caseType, canWrite, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [cases, setCases] = useState<MaternityCaseWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [members, setMembers] = useState<PickableMember[]>([])
  const [editing, setEditing] = useState<MaternityCaseWithEmployee | null>(null)
  const [deleting, setDeleting] = useState<MaternityCaseWithEmployee | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Server-side filter, not a client-side one: the tab must not have to
      // hold the other type's rows in memory to hide them.
      const res = await fetch(`/api/ws/${slug}/maternity?case_type=${caseType}`)
      if (!res.ok) { toast(wsParental.loadFailed(caseType), 'error'); return }
      const data = await res.json() as { cases: MaternityCaseWithEmployee[] }
      setCases(data.cases ?? [])
    } finally {
      setLoading(false)
    }
  }, [slug, caseType, toast])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!canReadEmployees || !showForm) return
    let cancelled = false
    void (async () => {
      const rows = await fetchActiveMembers(slug)
      if (!cancelled) setMembers(rows)
    })()
    return () => { cancelled = true }
  }, [slug, canReadEmployees, showForm])

  const stats = useMemo(() => {
    const out: Record<MaternityStatus, number> = { requested: 0, approved: 0, onleave: 0, returned: 0 }
    for (const c of cases) out[c.status] += 1
    return out
  }, [cases])

  async function move(c: MaternityCaseWithEmployee, to: MaternityStatus) {
    setBusyId(c.id)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      const data = await res.json().catch(() => ({})) as { case?: MaternityCaseWithEmployee; error?: string }
      if (res.ok) {
        toast(wsParental.maternityUpdated, 'success')
        await load()
      } else {
        toast(data.error ?? wsParental.maternityUpdateFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity/${deleting.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setDeleteError(data.error ?? wsParental.deleteFailed)
        return
      }
      setDeleting(null)
      toast(wsParental.deleted, 'success')
      await load()
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <p className="t-secondary" style={{ maxWidth: '540px' }}>{wsParental.intro(caseType)}</p>
        {canWrite && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(v => !v)}>
            {showForm ? wsParental.maternityCancel : wsParental.start(caseType)}
          </Button>
        )}
      </div>

      {canWrite && showForm && (
        <NewCaseForm
          slug={slug}
          caseType={caseType}
          members={members}
          onCancel={() => setShowForm(false)}
          onCreated={async () => { setShowForm(false); await load() }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginTop: '16px' }}>
        <StatCard label={wsParental.maternityStatRequested} value={stats.requested} accent="amber" />
        <StatCard label={wsParental.maternityStatApproved} value={stats.approved} />
        <StatCard label={wsParental.maternityStatOnLeave} value={stats.onleave} accent="brand" />
        <StatCard label={wsParental.maternityStatReturned} value={stats.returned} />
      </div>

      <div style={{ marginTop: '14px' }}>
        {loading ? (
          <Card><SkeletonText lines={4} /></Card>
        ) : cases.length === 0 ? (
          <Card padded={false}>
            <EmptyState title={wsParental.emptyTitle(caseType)} hint={wsParental.emptyHint(caseType)} />
          </Card>
        ) : (
          cases.map((c) => {
            const pct = caseProgress(c)
            const stageIndex = STAGES.indexOf(c.status)
            const name = caseName(c)
            const busy = busyId === c.id

            return (
              <Card key={c.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <Avatar name={name} size={44} />
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <p style={{ fontWeight: 700, fontSize: '15px' }}>{name}</p>
                    <p className="t-muted">
                      {[c.employee_department, c.employee_employee_id].filter(Boolean).join(' · ') || c.employee_work_email}
                    </p>
                  </div>
                  <Chip tone={STAGE_TONE[c.status]}>{STAGE_LABEL[c.status]}</Chip>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <Detail label={wsParental.maternityDueDate} value={formatLongDate(c.due_date)} />
                  <Detail label={wsParental.maternityLeaveStart} value={formatLongDate(c.start_date)} />
                  <Detail label={wsParental.maternityExpectedReturn} value={formatLongDate(c.end_date)} />
                  <Detail label={wsParental.maternityEntitlement} value={wsParental.maternityWeeksValue(c.weeks)} />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div className="row-between" style={{ marginBottom: '6px' }}>
                    <span className="t-secondary" style={{ fontSize: '11.5px' }}>{STAGE_LABEL[c.status]}</span>
                    <span className="t-muted" style={{ fontSize: '11.5px' }}>{pct}%</span>
                  </div>
                  <Progress percent={pct} color={c.status === 'returned' ? 'var(--brand)' : 'var(--info)'} />
                </div>

                <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <StageDots stages={STAGE_DOTS} currentIndex={stageIndex} />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {c.status === 'returned' && (
                    <Chip tone="verified">
                      {wsParental.maternityReturnedOn(formatLongDate(c.returned_on))}
                    </Chip>
                  )}
                  {canWrite && (
                    <>
                      {/* Edit and delete are offered at EVERY stage, returned
                          included: a case closed with the wrong return date is
                          exactly the one that needs correcting. */}
                      <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>
                        {wsParental.edit}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => { setDeleteError(null); setDeleting(c) }}>
                        {wsParental.delete}
                      </Button>
                      {NEXT_MOVES[c.status].map(m => (
                        <Button
                          key={m.to}
                          variant={m.primary ? 'primary' : 'secondary'}
                          size="sm"
                          loading={busy}
                          onClick={() => void move(c, m.to)}
                        >
                          {m.label}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Keyed on the case id, and only mounted while editing: that is what
          reseeds the inputs when a different case is opened, with no effect
          syncing props into state. */}
      {editing && (
        <EditCaseModal
          key={editing.id}
          slug={slug}
          caseType={caseType}
          parentalCase={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load() }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title={wsParental.deleteTitle}
        body={wsParental.deleteBody(deleting ? caseName(deleting) : '')}
        note={wsParental.deleteNote}
        confirmLabel={wsParental.deleteConfirm}
        busyLabel={wsParental.deleteBusy}
        cancelLabel={wsParental.deleteCancel}
        loading={deleteBusy}
        error={deleteError}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="t-eyebrow" style={{ fontSize: '10.5px' }}>{label}</p>
      <p style={{ fontSize: '13.5px', fontWeight: 600, marginTop: '3px' }}>{value}</p>
    </div>
  )
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Both dates are derived rather than typed - an admin filing a case has the due
 * date to hand, not the return date.
 *
 * The offset is the one piece of real difference between the two entitlements:
 * statutory maternity leave starts about four weeks BEFORE the due date, while
 * paternity leave is taken from the birth, so it starts on the date itself.
 */
const LEAD_DAYS_BEFORE_DUE: Record<ParentalCaseType, number> = {
  maternity: 28,
  paternity: 0,
}

export function deriveDates(
  dueDate: string,
  weeks: number,
  caseType: ParentalCaseType,
): { start: string; end: string } {
  const due = new Date(`${dueDate}T00:00:00`)
  const start = new Date(due)
  start.setDate(start.getDate() - LEAD_DAYS_BEFORE_DUE[caseType])
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: iso(start), end: iso(end) }
}

// ─── New case ─────────────────────────────────────────────────────────────────

function NewCaseForm({
  slug, caseType, members, onCancel, onCreated,
}: {
  slug: string
  caseType: ParentalCaseType
  members: PickableMember[]
  onCancel: () => void
  onCreated: () => void | Promise<void>
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [userId, setUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  // Seeded from the SHARED default so the form and the INSERT cannot disagree -
  // 26 weeks for maternity, 2 for paternity.
  const [weeks, setWeeks] = useState(String(DEFAULT_CASE_WEEKS[caseType]))
  const [saving, setSaving] = useState(false)

  async function submit() {
    const parsedWeeks = Math.max(1, parseInt(weeks, 10) || DEFAULT_CASE_WEEKS[caseType])
    if (!userId || !dueDate) {
      toast(wsParental.maternityEmployeeRequired, 'error')
      return
    }
    const { start, end } = deriveDates(dueDate, parsedWeeks, caseType)
    setSaving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          case_type: caseType,
          due_date: dueDate,
          start_date: start,
          end_date: end,
          weeks: parsedWeeks,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.ok) {
        toast(wsParental.created(caseType), 'success')
        await onCreated()
      } else {
        toast(data.error ?? wsParental.maternityCreateFailed, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginTop: '12px' }}>
      <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{wsParental.formTitle(caseType)}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <Field label={wsParental.maternityEmployee} htmlFor={`pc-${caseType}-employee`}>
          {/* Members, not HR records: the case creates the record if the
              person does not have one yet. */}
          <Select
            id={`pc-${caseType}-employee`}
            value={userId}
            onChange={e => setUserId(e.target.value)}
            options={[
              {
                value: '',
                label: members.length === 0
                  ? hrRecord.noMembers
                  : wsParental.maternityEmployeePlaceholder,
              },
              ...members.map(m => ({ value: m.user_id, label: memberLabel(m) })),
            ]}
          />
        </Field>
        <Field label={wsParental.dueLabel(caseType)} htmlFor={`pc-${caseType}-due`}>
          <Input id={`pc-${caseType}-due`} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <Field label={wsParental.maternityWeeks} htmlFor={`pc-${caseType}-weeks`}>
          <Input id={`pc-${caseType}-weeks`} type="number" min={1} max={104} value={weeks} onChange={e => setWeeks(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button loading={saving} onClick={() => void submit()}>{wsParental.maternityAdd}</Button>
          <Button variant="secondary" onClick={onCancel}>{wsParental.maternityCancel}</Button>
        </div>
      </div>
      <p className="t-muted" style={{ marginTop: '10px' }}>{wsParental.formHint(caseType)}</p>
    </Card>
  )
}

// ─── Edit ─────────────────────────────────────────────────────────────────────

/**
 * Edits the dates, the entitlement and the notes. Deliberately NOT the stage -
 * that moves through the stage buttons, which offer only the legal transitions.
 *
 * The rule about clearing a date on an open case is NOT re-implemented here.
 * `PATCH /api/ws/[slug]/maternity/[id]` answers 422 VALIDATION_ERROR with
 * REQUIRED_WHILE_OPEN, and this form renders whatever it refused with. That
 * guard exists because `getActiveParentalUserIds()` matches on dates rather
 * than status, so an open case that loses one drops silently out of the
 * check-in reminder gate - and a client-side copy of a rule like that is a
 * second thing to keep in step with the reminder pass.
 */
function EditCaseModal({
  slug, caseType, parentalCase, onClose, onSaved,
}: {
  slug: string
  caseType: ParentalCaseType
  parentalCase: MaternityCaseWithEmployee
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [dueDate, setDueDate] = useState(parentalCase.due_date ?? '')
  const [startDate, setStartDate] = useState(parentalCase.start_date ?? '')
  const [endDate, setEndDate] = useState(parentalCase.end_date ?? '')
  const [weeks, setWeeks] = useState(String(parentalCase.weeks))
  const [notes, setNotes] = useState(parentalCase.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity/${parentalCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: dueDate || null,
          start_date: startDate || null,
          end_date: endDate || null,
          weeks: Math.max(1, parseInt(weeks, 10) || parentalCase.weeks),
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        // The server is the judge - render whatever it refused with.
        setError(data.error ?? wsParental.editFailed)
        return
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={wsParental.editTitle}
      maxWidth={460}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={saving} onClick={onClose}>
            {wsParental.maternityCancel}
          </Button>
          <Button size="sm" loading={saving} onClick={() => void save()}>
            {saving ? wsParental.editSaving : wsParental.editSave}
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <Field label={wsParental.dueLabel(caseType)} htmlFor="pc-edit-due">
          <Input id="pc-edit-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <Field label={wsParental.maternityWeeks} htmlFor="pc-edit-weeks">
          <Input id="pc-edit-weeks" type="number" min={1} max={104} value={weeks} onChange={e => setWeeks(e.target.value)} />
        </Field>
        <Field label={wsParental.maternityLeaveStart} htmlFor="pc-edit-start">
          <Input id="pc-edit-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        <Field label={wsParental.maternityExpectedReturn} htmlFor="pc-edit-end">
          <Input id="pc-edit-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </Field>
      </div>

      <Field label={wsParental.editNotes} htmlFor="pc-edit-notes" style={{ marginTop: '10px' }}>
        <Textarea
          id="pc-edit-notes"
          value={notes}
          placeholder={wsParental.editNotesPlaceholder}
          onChange={e => setNotes(e.target.value)}
        />
      </Field>

      {error && <p className="field-error" role="alert">{error}</p>}
    </Modal>
  )
}
