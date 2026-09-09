'use client'

/**
 * `/me/leave` - the four tabs that replace the `leave`, `holidays`,
 * `myLeaves` and `regularizations` accordion panels of `/me/ws/[slug]`.
 *
 * Three things are worth knowing before editing this file.
 *
 * 1. Balance is never stored. `GET /leave-types` computes
 *    `opening_balance + total_accrued - used_days` per type on every read
 *    (see `getLeaveTypesWithBalance`), and this screen shows all four numbers
 *    rather than only the total - "why is my balance 4?" is the question the
 *    old single-number card could not answer.
 *
 * 2. The server is the only judge of a submission. Insufficient balance,
 *    overlapping requests, non-working days and company holidays are all
 *    decided by `POST /api/me/ws/[slug]/leave`, and its `error` string is what
 *    gets rendered. The one check duplicated client-side is the holiday
 *    overlap, purely so the button can be disabled before a round trip - the
 *    route still rejects it if this misses.
 *
 * 3. Loaded data carries the slug it was fetched for, and the apply form is
 *    keyed by slug. Switching workspace therefore invalidates both by
 *    construction rather than by a reset effect - a leave type id from one
 *    workspace is meaningless in another, and a stale balance is worse than a
 *    skeleton.
 */

import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Field,
  Input,
  Progress,
  Select,
  Skeleton,
  TabBar,
  Textarea,
  type Tab,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { LeaveTypeWithBalance, LeaveRequestWithType } from '@/lib/db/queries/leaves'
import type { RegularizationRequest } from '@/lib/db/queries/regularizations'
import type { MaternityCase } from '@/lib/db/queries/maternity'
import type { ParentalExtension } from '@/lib/db/queries/parental-extensions'
import { en } from '@/locales/en'
import { meScreens } from '@/locales/en/me-screens'
import { parentalExtension as extensionCopy } from '@/locales/en/ws-parental'
import { useWorkspaceScope } from '../workspace-scope'

interface Holiday {
  id: string
  name: string
  date: string
  description: string | null
}

type TabKey = 'balance' | 'apply' | 'correction' | 'extension' | 'history' | 'holidays'

const BASE_TABS: Tab[] = [
  { key: 'balance', label: meScreens.leave.tabBalance },
  { key: 'apply', label: meScreens.leave.tabApply },
  { key: 'correction', label: meScreens.leave.tabCorrection },
]

const TAIL_TABS: Tab[] = [
  { key: 'history', label: meScreens.leave.tabHistory },
  { key: 'holidays', label: meScreens.leave.tabHolidays },
]

/**
 * The extension tab exists ONLY while the member has an open parental case.
 *
 * It is not a permission - anyone may file one, there is just nothing to file
 * it against otherwise, and a tab that only ever shows an empty state is worse
 * than no tab. It slots in after Correction because it is the same shape of
 * thing: a request the member sends to the approvals queue.
 */
function tabsFor(hasOpenCase: boolean): Tab[] {
  return hasOpenCase
    ? [...BASE_TABS, { key: 'extension', label: extensionCopy.tab }, ...TAIL_TABS]
    : [...BASE_TABS, ...TAIL_TABS]
}

// ─── formatting ───────────────────────────────────────────────────────────────

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fmtDate(iso: string, withYear = false): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : null),
  })
}

function fmtRange(start: string, end: string): string {
  return start === end ? fmtDate(start, true) : `${fmtDate(start)} – ${fmtDate(end, true)}`
}

/** Trims a trailing `.0` so whole-day balances do not read as "12.0". */
function fmtDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function statusTone(status: string): 'verified' | 'partial' | 'none' | 'leave' {
  if (status === 'approved') return 'verified'
  if (status === 'pending') return 'partial'
  if (status === 'rejected') return 'none'
  return 'leave'
}

function statusLabel(status: string): string {
  return meScreens.leave.status[status] ?? status
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" style={{ marginTop: '12px' }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={76} radius="var(--radius-lg)" />
      ))}
    </div>
  )
}

// ─── Balance ──────────────────────────────────────────────────────────────────

function BalanceTab({ types, loading }: { types: LeaveTypeWithBalance[]; loading: boolean }) {
  if (loading) return <ListSkeleton />
  if (types.length === 0) {
    return (
      <EmptyState title={meScreens.leave.balanceEmpty} hint={meScreens.leave.balanceEmptyHint} />
    )
  }

  return (
    <div>
      {types.map((type) => {
        const entitlement = type.opening_balance + type.total_accrued
        const usedPercent = entitlement > 0 ? (type.used_days / entitlement) * 100 : 0
        const frequency =
          meScreens.leave.frequency[type.accrual_frequency] ?? type.accrual_frequency

        return (
          <Card key={type.id} style={{ marginTop: '12px' }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '13.5px' }}>{type.name}</p>
                <p className="t-muted">
                  {meScreens.leave.accrualLine(frequency, type.accrual_credits)}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="stat-num accent-brand" style={{ fontSize: '24px' }}>
                  {fmtDays(type.available_days)}
                </p>
                <p className="t-muted">{meScreens.leave.available}</p>
              </div>
            </div>

            <Divider />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: meScreens.leave.openingBalance, value: type.opening_balance },
                { label: meScreens.leave.accrued, value: type.total_accrued },
                { label: meScreens.leave.used, value: type.used_days },
              ].map((item) => (
                <div key={item.label}>
                  <p className="t-eyebrow">{item.label}</p>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '15px',
                      fontWeight: 700,
                      marginTop: '2px',
                    }}
                  >
                    {fmtDays(item.value)}
                  </p>
                </div>
              ))}
            </div>

            {entitlement > 0 && (
              <div style={{ marginTop: '12px' }}>
                <Progress percent={usedPercent} />
                <p className="t-muted" style={{ marginTop: '6px' }}>
                  {meScreens.leave.usedOfAccrued(
                    Number(fmtDays(type.used_days)),
                    Number(fmtDays(entitlement)),
                  )}
                </p>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ─── Apply ────────────────────────────────────────────────────────────────────

/**
 * Owns its own form state and is mounted with `key={slug}`, so switching
 * workspace throws the half-filled request away instead of carrying a leave
 * type id across a boundary where it does not exist.
 */
function ApplyTab({
  slug,
  types,
  holidays,
  loading,
  onSubmitted,
}: {
  slug: string
  types: LeaveTypeWithBalance[]
  holidays: Holiday[]
  loading: boolean
  onSubmitted: () => void
}) {
  const [typeId, setTypeId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  if (loading) return <ListSkeleton rows={1} />
  if (types.length === 0) return <EmptyState title={meScreens.leave.applyNoTypes} />

  const holidayConflicts =
    start && end ? holidays.filter((h) => h.date >= start && h.date <= end) : []
  const canSubmit = !!typeId && !!start && !!end && holidayConflicts.length === 0 && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type_id: typeId,
          start_date: start,
          end_date: end,
          reason: reason.trim() || null,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? meScreens.leave.submitFailed)
        setSubmitting(false)
        return
      }
      toast.show(meScreens.leave.submitSuccess, 'success')
      onSubmitted()
    } catch {
      setError(meScreens.leave.submitFailed)
      setSubmitting(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {types.map((type) => (
          <Chip key={type.id} tone="leave">
            {meScreens.leave.chipDaysLeft(type.name, Number(fmtDays(type.available_days)))}
          </Chip>
        ))}
      </div>

      <Card>
        <p className="t-eyebrow" style={{ marginBottom: '12px' }}>
          {meScreens.leave.applyHeading}
        </p>

        <Field label={meScreens.leave.fieldType} htmlFor="lv-type" required>
          <Select
            id="lv-type"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            placeholder={meScreens.leave.fieldTypePlaceholder}
            options={types.map((type) => ({
              value: type.id,
              label: meScreens.leave.typeOption(type.name, Number(fmtDays(type.available_days))),
              disabled: type.available_days <= 0,
            }))}
          />
        </Field>

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
          <Field label={meScreens.leave.fieldStart} htmlFor="lv-start" required full>
            <Input
              id="lv-start"
              type="date"
              value={start}
              onChange={(e) => {
                const next = e.target.value
                setStart(next)
                if (end && next > end) setEnd(next)
              }}
            />
          </Field>
          <Field label={meScreens.leave.fieldEnd} htmlFor="lv-end" required full>
            <Input
              id="lv-end"
              type="date"
              min={start || undefined}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>

        {holidayConflicts.length > 0 && (
          <p className="field-error" style={{ marginTop: '10px' }}>
            {meScreens.leave.holidayWarning(holidayConflicts.map((h) => h.name).join(', '))}
          </p>
        )}

        <Field label={meScreens.leave.fieldReason} htmlFor="lv-reason" style={{ marginTop: '12px' }}>
          <Textarea
            id="lv-reason"
            value={reason}
            placeholder={meScreens.leave.fieldReasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <Button
          block
          style={{ marginTop: '14px' }}
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void submit()}
        >
          {submitting ? meScreens.leave.submitting : meScreens.leave.submit}
        </Button>
      </Card>
    </>
  )
}

// ─── Correction ───────────────────────────────────────────────────────────────

/**
 * Ask an admin to correct a past working day.
 *
 * This form used to be a modal opened from a row on `/me/timeline`, which meant
 * it could only ever reach a day that already had a presence event - and the
 * case members actually hit is the opposite one: worked, forgot to check in, so
 * there is no event, no row, and nowhere to click. It lives here now, and the
 * day comes from a picker rather than from the row that opened it.
 *
 * The picker is NOT a free date input. `correctableDates` arrives from
 * `GET /api/me/ws/[slug]/regularizations`, which has already excluded weekends,
 * holidays, verified days, leave, the plan history floor and days with a request
 * already open - every guard `POST` would refuse on. A free input would let a
 * member pick a Sunday and learn about it only after submitting.
 */
function CorrectionTab({
  slug,
  correctableDates,
  loading,
  onSubmitted,
}: {
  slug: string
  correctableDates: string[]
  loading: boolean
  onSubmitted: () => void
}) {
  const [date, setDate] = useState('')
  const [requestedType, setRequestedType] = useState<'office' | 'remote'>('office')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  if (loading) return <ListSkeleton rows={1} />
  if (correctableDates.length === 0) {
    return (
      <EmptyState
        title={meScreens.leave.correctionNoDays}
        hint={meScreens.leave.correctionNoDaysHint}
      />
    )
  }

  const canSubmit = !!date && !!reason.trim() && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/regularizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_date: date,
          requested_type: requestedType,
          reason: reason.trim(),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        // The server is the judge - render whatever it refused with.
        setError(body.error ?? en.meWsRegularization.submitErrorGeneric)
        setSubmitting(false)
        return
      }
      toast.show(meScreens.leave.correctionSubmitSuccess, 'success')
      onSubmitted()
    } catch {
      setError(en.meWsRegularization.submitErrorGeneric)
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <p className="t-eyebrow" style={{ marginBottom: '8px' }}>
        {meScreens.leave.correctionHeading}
      </p>
      <p className="t-muted" style={{ margin: '0 0 12px' }}>
        {meScreens.leave.correctionIntro}
      </p>

      <Field label={meScreens.leave.correctionFieldDay} htmlFor="cr-date" required>
        <Select
          id="cr-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder={meScreens.leave.correctionFieldDayPlaceholder}
          options={correctableDates.map((d) => ({ value: d, label: fmtDate(d, true) }))}
        />
      </Field>

      <Field
        label={en.meWsRegularization.fieldType}
        htmlFor="cr-type-office"
        style={{ marginTop: '12px' }}
        required
      >
        <div role="radiogroup" style={{ display: 'flex', gap: '8px' }}>
          {(['office', 'remote'] as const).map((t) => (
            <Button
              key={t}
              id={`cr-type-${t}`}
              role="radio"
              aria-checked={requestedType === t}
              variant={requestedType === t ? 'primary' : 'secondary'}
              block
              onClick={() => setRequestedType(t)}
            >
              {t === 'office' ? en.meWsRegularization.typeOffice : en.meWsRegularization.typeRemote}
            </Button>
          ))}
        </div>
      </Field>

      {/* Required here, unlike leave: an admin approving a correction is
          overriding the signals, so they need the reason it is warranted. */}
      <Field
        label={en.meWsRegularization.fieldReason}
        htmlFor="cr-reason"
        style={{ marginTop: '12px' }}
        required
      >
        <Textarea
          id="cr-reason"
          value={reason}
          placeholder={en.meWsRegularization.fieldReasonPlaceholder}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <Button
        block
        style={{ marginTop: '14px' }}
        disabled={!canSubmit}
        loading={submitting}
        onClick={() => void submit()}
      >
        {submitting ? en.meWsRegularization.submitting : en.meWsRegularization.submit}
      </Button>
    </Card>
  )
}

// ─── Extension ────────────────────────────────────────────────────────────────

/**
 * Ask for more UNPAID days at the end of an open parental leave case.
 *
 * Modelled on `CorrectionTab` above - the established shape for "a member files
 * a request that lands in the admin approvals queue": a constrained picker, a
 * reason, the server as the only judge, and its `error` string rendered
 * verbatim rather than second-guessed.
 *
 * The unpaid day count shown before submit is FETCHED, not computed here. The
 * rule is the workspace's working days minus its holiday calendar, and
 * `computeUnpaidExtensionDays()` on the server is the one implementation of it
 * - used for this preview, for the stored figure at submit, and again at
 * approval. A copy in the browser would be a second thing to keep in step and
 * would disagree the first time an admin added a holiday.
 *
 * These days consume no balance and write no `leave_requests` row: approving
 * one simply moves the case's end date.
 */
function ExtensionTab({
  slug,
  openCases,
  extensions,
  loading,
  onSubmitted,
}: {
  slug: string
  openCases: MaternityCase[]
  extensions: ParentalExtension[]
  loading: boolean
  onSubmitted: () => void
}) {
  const [caseId, setCaseId] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<{ key: string; days: number | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  // One case is the overwhelmingly common shape, so it is preselected rather
  // than making the member pick from a list of one.
  const selectedCase = openCases.find((c) => c.id === caseId) ?? (openCases.length === 1 ? openCases[0] : undefined)
  const effectiveCaseId = selectedCase?.id ?? ''

  // The answer is tagged with the question it answers, and both "is it still
  // counting" and "what did it say" are DERIVED from that rather than being two
  // more pieces of state. An effect that also set state synchronously would
  // cascade a render on every keystroke in the date field, and a separate
  // `counting` flag could disagree with the number beside it.
  const previewKey = effectiveCaseId && endDate ? `${effectiveCaseId}|${endDate}` : ''

  useEffect(() => {
    if (!previewKey) return
    let cancelled = false
    const [caseIdPart, endPart] = previewKey.split('|')
    const qs = new URLSearchParams({ case_id: caseIdPart, requested_end_date: endPart })
    fetch(`/api/me/ws/${encodeURIComponent(slug)}/parental-extensions?${qs}`)
      .then((r) => r.json())
      .then((data: { preview?: { unpaid_days?: number } | null }) => {
        if (cancelled) return
        setPreview({
          key: previewKey,
          days: typeof data.preview?.unpaid_days === 'number' ? data.preview.unpaid_days : null,
        })
      })
      // A failed count is answered, not left spinning - the button stays
      // disabled and the server would refuse the submit anyway.
      .catch(() => { if (!cancelled) setPreview({ key: previewKey, days: null }) })
    return () => { cancelled = true }
  }, [slug, previewKey])

  const answered = preview?.key === previewKey
  const unpaidDays = answered ? preview.days : null
  const counting = !!previewKey && !answered

  if (loading) return <ListSkeleton rows={1} />
  if (openCases.length === 0) {
    return <EmptyState title={extensionCopy.noCaseTitle} hint={extensionCopy.noCaseHint} />
  }

  const canSubmit = !!effectiveCaseId && !!endDate && !submitting && (unpaidDays ?? 0) > 0

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/parental-extensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: effectiveCaseId,
          requested_end_date: endDate,
          reason: reason.trim() || undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        // The server is the judge - render whatever it refused with.
        setError(body.error ?? extensionCopy.submitErrorGeneric)
        setSubmitting(false)
        return
      }
      toast.show(extensionCopy.submitted, 'success')
      onSubmitted()
    } catch {
      setError(extensionCopy.submitErrorGeneric)
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <p className="t-eyebrow" style={{ marginBottom: '8px' }}>{extensionCopy.heading}</p>
        <p className="t-muted" style={{ margin: '0 0 12px' }}>{extensionCopy.intro}</p>

        <Field label={extensionCopy.caseLabel} htmlFor="ex-case" required>
          <Select
            id="ex-case"
            value={effectiveCaseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder={extensionCopy.casePlaceholder}
            options={openCases.map((c) => ({
              value: c.id,
              label: extensionCopy.caseOption(c.case_type, fmtDate(c.end_date ?? '', true)),
            }))}
          />
        </Field>

        {selectedCase?.end_date && (
          <p className="field-hint">{extensionCopy.currentEnd(fmtDate(selectedCase.end_date, true))}</p>
        )}

        <Field label={extensionCopy.fieldNewEnd} htmlFor="ex-end" style={{ marginTop: '12px' }} required>
          <Input
            id="ex-end"
            type="date"
            value={endDate}
            min={selectedCase?.end_date ?? undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>

        {/* The cost, stated before the button rather than after the fact. */}
        {(counting || unpaidDays !== null) && (
          <p className="field-hint">
            {counting ? extensionCopy.unpaidCounting : extensionCopy.unpaidCount(unpaidDays ?? 0)}
          </p>
        )}

        <Field label={extensionCopy.fieldReason} htmlFor="ex-reason" style={{ marginTop: '12px' }}>
          <Textarea
            id="ex-reason"
            value={reason}
            placeholder={extensionCopy.fieldReasonPlaceholder}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        {error && <p className="field-error" role="alert">{error}</p>}

        <Button
          block
          style={{ marginTop: '14px' }}
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => void submit()}
        >
          {submitting ? extensionCopy.submitting : extensionCopy.submit}
        </Button>
      </Card>

      {extensions.length > 0 && (
        <>
          <p className="t-eyebrow" style={{ margin: '16px 0 4px' }}>{extensionCopy.historyHeading}</p>
          {extensions.map((x) => (
            <Card key={x.id} style={{ marginTop: '10px' }}>
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '13px' }}>
                    {extensionCopy.historyRow(x.unpaid_days, fmtDate(x.requested_end_date, true))}
                  </p>
                  {x.rejection_reason && <p className="t-muted">{x.rejection_reason}</p>}
                </div>
                <Chip tone={statusTone(x.status)}>
                  {x.status === 'approved'
                    ? extensionCopy.statusApproved
                    : x.status === 'rejected'
                      ? extensionCopy.statusRejected
                      : extensionCopy.statusPending}
                </Chip>
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  )
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryTab({
  requests,
  regularizations,
  loading,
}: {
  requests: LeaveRequestWithType[]
  regularizations: RegularizationRequest[]
  loading: boolean
}) {
  if (loading) return <ListSkeleton rows={4} />

  return (
    <>
      <p className="t-eyebrow" style={{ marginBottom: '4px' }}>
        {meScreens.leave.historyLeaveHeading}
      </p>
      {requests.length === 0 ? (
        <EmptyState
          title={meScreens.leave.historyLeaveEmpty}
          hint={meScreens.leave.historyLeaveEmptyHint}
        />
      ) : (
        requests.map((request) => (
          <Card key={request.id} style={{ marginTop: '10px' }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '13px' }}>{request.leave_type_name}</p>
                <p className="t-muted">{fmtRange(request.start_date, request.end_date)}</p>
              </div>
              <Chip tone={statusTone(request.status)}>{statusLabel(request.status)}</Chip>
            </div>
            {request.reason && (
              <p className="t-muted" style={{ marginTop: '8px' }}>
                {request.reason}
              </p>
            )}
            {request.status === 'rejected' && request.rejection_reason && (
              <p className="field-error">
                {meScreens.leave.rejectedPrefix} {request.rejection_reason}
              </p>
            )}
          </Card>
        ))
      )}

      <p className="t-eyebrow" style={{ margin: '24px 0 4px' }}>
        {meScreens.leave.historyCorrectionHeading}
      </p>
      {regularizations.length === 0 ? (
        <EmptyState
          title={meScreens.leave.historyCorrectionEmpty}
          hint={meScreens.leave.historyCorrectionEmptyHint}
        />
      ) : (
        regularizations.map((request) => (
          <Card key={request.id} style={{ marginTop: '10px' }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '13px' }}>
                  {meScreens.leave.correctionType[request.requested_type] ?? request.requested_type}
                </p>
                <p className="t-muted">{fmtDate(request.target_date, true)}</p>
              </div>
              <Chip tone={statusTone(request.status)}>{statusLabel(request.status)}</Chip>
            </div>
            <p className="t-muted" style={{ marginTop: '8px' }}>
              {request.reason}
            </p>
            {request.status === 'rejected' && request.rejection_reason && (
              <p className="field-error">
                {meScreens.leave.rejectedPrefix} {request.rejection_reason}
              </p>
            )}
          </Card>
        ))
      )}
    </>
  )
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

function HolidaySection({
  heading,
  list,
  muted,
  today,
}: {
  heading: string
  list: Holiday[]
  muted: boolean
  today: string
}) {
  if (list.length === 0) return null

  return (
    <>
      <p className="t-eyebrow" style={{ margin: '20px 0 8px' }}>
        {heading}
      </p>
      <Card>
        {list.map((holiday, index) => (
          <div key={holiday.id}>
            {index > 0 && <Divider style={{ margin: 0 }} />}
            <div className="row-between" style={{ padding: '9px 0' }}>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: muted ? 'var(--text-muted)' : undefined,
                  }}
                >
                  {holiday.name}
                  {holiday.date === today && (
                    <Chip tone="verified" style={{ marginLeft: '6px' }}>
                      {meScreens.leave.badgeToday}
                    </Chip>
                  )}
                </p>
                {holiday.description && <p className="t-muted">{holiday.description}</p>}
              </div>
              <p
                className="t-muted"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', flexShrink: 0 }}
              >
                {fmtDate(holiday.date, true)}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

function HolidaysTab({ holidays, loading }: { holidays: Holiday[]; loading: boolean }) {
  if (loading) return <ListSkeleton rows={2} />

  if (holidays.length === 0) {
    return (
      <EmptyState
        title={meScreens.leave.holidaysEmpty(new Date().getFullYear())}
        hint={meScreens.leave.holidaysEmptyHint}
      />
    )
  }

  const today = todayKey()
  const upcoming = holidays
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  const past = holidays.filter((h) => h.date < today).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <HolidaySection
        heading={meScreens.leave.holidaysHeading}
        list={upcoming}
        muted={false}
        today={today}
      />
      <HolidaySection
        heading={meScreens.leave.holidaysPastHeading}
        list={past}
        muted
        today={today}
      />
    </>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

/** Everything the four tabs read, tagged with the workspace it came from. */
interface LeaveData {
  slug: string
  types: LeaveTypeWithBalance[]
  requests: LeaveRequestWithType[]
  regularizations: RegularizationRequest[]
  /**
   * Which past days the Correction tab may offer. Server-decided and shipped on
   * the same `/regularizations` read that fills `regularizations` above, so the
   * tab costs no extra request - see `getCorrectableDates()`.
   */
  correctableDates: string[]
  holidays: Holiday[]
  /**
   * The member's own open parental cases. Empty for almost everybody, and that
   * is exactly what decides whether the Extend tab exists at all.
   */
  openParentalCases: MaternityCase[]
  parentalExtensions: ParentalExtension[]
}

export default function LeaveScreen() {
  const { slug } = useWorkspaceScope()

  const [tab, setTab] = useState<TabKey>('balance')
  const [data, setData] = useState<LeaveData | null>(null)
  // Bumped by a successful submission so the effect refetches; the tab keeps
  // showing the previous numbers meanwhile rather than flashing a skeleton.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    const base = `/api/me/ws/${encodeURIComponent(slug)}`
    const year = new Date().getFullYear()
    const json = (path: string) =>
      fetch(`${base}${path}`)
        .then((r) => r.json())
        .catch(() => ({}))

    Promise.all([
      json('/leave-types'),
      json('/leave-requests'),
      json('/regularizations'),
      json(`/holidays?year=${year}`),
      json('/parental-extensions'),
    ]).then(([types, requests, regularizations, holidays, extensions]) => {
      if (cancelled) return
      setData({
        slug,
        types: Array.isArray(types.leaveTypes) ? types.leaveTypes : [],
        requests: Array.isArray(requests.leaveRequests) ? requests.leaveRequests : [],
        regularizations: Array.isArray(regularizations.regularizationRequests)
          ? regularizations.regularizationRequests
          : [],
        correctableDates: Array.isArray(regularizations.correctableDates)
          ? regularizations.correctableDates
          : [],
        holidays: Array.isArray(holidays.holidays) ? holidays.holidays : [],
        openParentalCases: Array.isArray(extensions.openCases) ? extensions.openCases : [],
        parentalExtensions: Array.isArray(extensions.extensions) ? extensions.extensions : [],
      })
    })

    return () => {
      cancelled = true
    }
  }, [slug, refreshKey])

  if (!slug) {
    return (
      <>
        <h1 className="t-h1">{meScreens.leave.title}</h1>
        <EmptyState
          title={meScreens.common.noWorkspaceTitle}
          hint={meScreens.common.noWorkspaceBody}
        />
      </>
    )
  }

  // Data tagged with another workspace is not this screen's data.
  const fresh = data?.slug === slug ? data : null
  const loading = fresh === null
  const hasOpenParentalCase = (fresh?.openParentalCases.length ?? 0) > 0

  return (
    <>
      <h1 className="t-h1">{meScreens.leave.title}</h1>

      <TabBar
        tabs={tabsFor(hasOpenParentalCase)}
        active={tab}
        onChange={(key) => setTab(key as TabKey)}
        style={{ margin: '4px 0 16px' }}
      />

      {tab === 'balance' && <BalanceTab types={fresh?.types ?? []} loading={loading} />}

      {tab === 'apply' && (
        <ApplyTab
          key={slug}
          slug={slug}
          types={fresh?.types ?? []}
          holidays={fresh?.holidays ?? []}
          loading={loading}
          onSubmitted={() => {
            setRefreshKey((n) => n + 1)
            setTab('history')
          }}
        />
      )}

      {tab === 'correction' && (
        <CorrectionTab
          key={slug}
          slug={slug}
          correctableDates={fresh?.correctableDates ?? []}
          loading={loading}
          onSubmitted={() => {
            setRefreshKey((n) => n + 1)
            setTab('history')
          }}
        />
      )}

      {/* Guarded on the case, not only on the tab: the tab disappears when the
          last case closes, and a stale `tab` state must not render a form with
          nothing to file against. */}
      {tab === 'extension' && hasOpenParentalCase && (
        <ExtensionTab
          key={slug}
          slug={slug}
          openCases={fresh?.openParentalCases ?? []}
          extensions={fresh?.parentalExtensions ?? []}
          loading={loading}
          onSubmitted={() => {
            setRefreshKey((n) => n + 1)
          }}
        />
      )}

      {tab === 'history' && (
        <HistoryTab
          requests={fresh?.requests ?? []}
          regularizations={fresh?.regularizations ?? []}
          loading={loading}
        />
      )}

      {tab === 'holidays' && (
        <HolidaysTab holidays={fresh?.holidays ?? []} loading={loading} />
      )}
    </>
  )
}
