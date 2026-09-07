'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, EmptyState, Field, Input, Progress, Select, SkeletonText,
  StageDots, StatCard,
  type ChipTone, type Stage,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsLeaveScreen } from '@/locales/en/ws-people'
import { hrRecord } from '@/locales/en/documents'
import type { MaternityCaseWithEmployee, MaternityStatus } from '@/lib/db/queries/maternity'
import type { MemberWithUserFull } from '@/lib/db/queries/workspaces'
import { formatLongDate } from './leave-shared'

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const STAGES: readonly MaternityStatus[] = ['requested', 'approved', 'onleave', 'returned']

const STAGE_LABEL: Record<MaternityStatus, string> = {
  requested: wsLeaveScreen.stageRequested,
  approved: wsLeaveScreen.stageApproved,
  onleave: wsLeaveScreen.stageOnLeave,
  returned: wsLeaveScreen.stageReturned,
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
 */
const NEXT_MOVES: Record<MaternityStatus, readonly { to: MaternityStatus; label: string; primary: boolean }[]> = {
  requested: [{ to: 'approved', label: wsLeaveScreen.maternityApprove, primary: true }],
  approved: [
    { to: 'requested', label: wsLeaveScreen.maternityRevoke, primary: false },
    { to: 'onleave', label: wsLeaveScreen.maternityMarkOnLeave, primary: true },
  ],
  onleave: [{ to: 'returned', label: wsLeaveScreen.maternityMarkReturned, primary: true }],
  returned: [],
}

/** 0 before leave starts, 100 once returned, elapsed share while on leave. */
export function maternityProgress(c: MaternityCaseWithEmployee): number {
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
  canWrite: boolean
  /** employees:read - the new-case form needs someone to file against. */
  canReadEmployees: boolean
}

export default function MaternityTab({ slug, canWrite, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [cases, setCases] = useState<MaternityCaseWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [members, setMembers] = useState<PickableMember[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity`)
      if (!res.ok) { toast(wsLeaveScreen.maternityLoadFailed, 'error'); return }
      const data = await res.json() as { cases: MaternityCaseWithEmployee[] }
      setCases(data.cases ?? [])
    } finally {
      setLoading(false)
    }
  }, [slug, toast])

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
        toast(wsLeaveScreen.maternityUpdated, 'success')
        await load()
      } else {
        toast(data.error ?? wsLeaveScreen.maternityUpdateFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <p className="t-secondary" style={{ maxWidth: '540px' }}>{wsLeaveScreen.maternityIntro}</p>
        {canWrite && (
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowForm(v => !v)}>
            {showForm ? wsLeaveScreen.maternityCancel : wsLeaveScreen.maternityStart}
          </Button>
        )}
      </div>

      {canWrite && showForm && (
        <NewCaseForm
          slug={slug}
          members={members}
          onCancel={() => setShowForm(false)}
          onCreated={async () => { setShowForm(false); await load() }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginTop: '16px' }}>
        <StatCard label={wsLeaveScreen.maternityStatRequested} value={stats.requested} accent="amber" />
        <StatCard label={wsLeaveScreen.maternityStatApproved} value={stats.approved} />
        <StatCard label={wsLeaveScreen.maternityStatOnLeave} value={stats.onleave} accent="brand" />
        <StatCard label={wsLeaveScreen.maternityStatReturned} value={stats.returned} />
      </div>

      <div style={{ marginTop: '14px' }}>
        {loading ? (
          <Card><SkeletonText lines={4} /></Card>
        ) : cases.length === 0 ? (
          <Card padded={false}>
            <EmptyState title={wsLeaveScreen.maternityEmptyTitle} hint={wsLeaveScreen.maternityEmptyHint} />
          </Card>
        ) : (
          cases.map((c) => {
            const pct = maternityProgress(c)
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
                  <Detail label={wsLeaveScreen.maternityDueDate} value={formatLongDate(c.due_date)} />
                  <Detail label={wsLeaveScreen.maternityLeaveStart} value={formatLongDate(c.start_date)} />
                  <Detail label={wsLeaveScreen.maternityExpectedReturn} value={formatLongDate(c.end_date)} />
                  <Detail label={wsLeaveScreen.maternityEntitlement} value={wsLeaveScreen.maternityWeeksValue(c.weeks)} />
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
                  {c.status === 'returned' ? (
                    <Chip tone="verified">
                      {wsLeaveScreen.maternityReturnedOn(formatLongDate(c.returned_on))}
                    </Chip>
                  ) : canWrite ? (
                    NEXT_MOVES[c.status].map(m => (
                      <Button
                        key={m.to}
                        variant={m.primary ? 'primary' : 'secondary'}
                        size="sm"
                        loading={busy}
                        onClick={() => void move(c, m.to)}
                      >
                        {m.label}
                      </Button>
                    ))
                  ) : null}
                </div>
              </Card>
            )
          })
        )}
      </div>
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

// ─── New case ─────────────────────────────────────────────────────────────────

/**
 * Statutory leave starts about four weeks before the due date and runs for the
 * entitlement, so both dates are derived rather than typed - an admin filing a
 * case has the due date to hand, not the return date.
 */
function deriveDates(dueDate: string, weeks: number): { start: string; end: string } {
  const due = new Date(`${dueDate}T00:00:00`)
  const start = new Date(due)
  start.setDate(start.getDate() - 28)
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: iso(start), end: iso(end) }
}

function NewCaseForm({
  slug, members, onCancel, onCreated,
}: {
  slug: string
  members: PickableMember[]
  onCancel: () => void
  onCreated: () => void | Promise<void>
}) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [userId, setUserId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [weeks, setWeeks] = useState('26')
  const [saving, setSaving] = useState(false)

  async function submit() {
    const parsedWeeks = Math.max(1, parseInt(weeks, 10) || 26)
    if (!userId || !dueDate) {
      toast(wsLeaveScreen.maternityEmployeeRequired, 'error')
      return
    }
    const { start, end } = deriveDates(dueDate, parsedWeeks)
    setSaving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/maternity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          due_date: dueDate,
          start_date: start,
          end_date: end,
          weeks: parsedWeeks,
        }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.ok) {
        toast(wsLeaveScreen.maternityCreated, 'success')
        await onCreated()
      } else {
        toast(data.error ?? wsLeaveScreen.maternityCreateFailed, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginTop: '12px' }}>
      <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{wsLeaveScreen.maternityFormTitle}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
        <Field label={wsLeaveScreen.maternityEmployee} htmlFor="mat-employee">
          {/* Members, not HR records: the case creates the record if the
              person does not have one yet. */}
          <Select
            id="mat-employee"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            options={[
              {
                value: '',
                label: members.length === 0
                  ? hrRecord.noMembers
                  : wsLeaveScreen.maternityEmployeePlaceholder,
              },
              ...members.map(m => ({ value: m.user_id, label: memberLabel(m) })),
            ]}
          />
        </Field>
        <Field label={wsLeaveScreen.maternityDue} htmlFor="mat-due">
          <Input id="mat-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </Field>
        <Field label={wsLeaveScreen.maternityWeeks} htmlFor="mat-weeks">
          <Input id="mat-weeks" type="number" min={1} max={104} value={weeks} onChange={e => setWeeks(e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button loading={saving} onClick={() => void submit()}>{wsLeaveScreen.maternityAdd}</Button>
          <Button variant="secondary" onClick={onCancel}>{wsLeaveScreen.maternityCancel}</Button>
        </div>
      </div>
      <p className="t-muted" style={{ marginTop: '10px' }}>{wsLeaveScreen.maternityFormHint}</p>
    </Card>
  )
}
