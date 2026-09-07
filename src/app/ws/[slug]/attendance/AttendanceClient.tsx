'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { DashboardMember, DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { OverviewWidgetsResponse } from '@/app/api/ws/[slug]/overview/route'
import type { ApprovalsResponse } from '@/app/api/ws/[slug]/approvals/route'
import type {
  OfficeDayCounts,
  OfficeDayPreviewResponse,
  OfficeDayResultResponse,
  OfficeDaysListResponse,
} from '@/app/api/ws/[slug]/office-days/route'
import type { ApprovalItem } from '@/lib/approvals'
import PresenceChip from '@/components/ws/PresenceChip'
import {
  Avatar, Button, Card, Chip, DataTable, Divider, EmptyState, Field, IconButton, Input,
  Modal, SlideOver, Skeleton, StatCard, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props {
  slug: string
  /** `approvals:write` - drives whether the queue offers approve/decline. */
  canAction: boolean
}

/** A pending regularization, narrowed out of the approvals union. */
type RegularizationItem = Extract<ApprovalItem, { kind: 'regularization' }>

/** Derived from the route's own response type so the two cannot drift. */
type DeclaredOfficeDay = OfficeDaysListResponse['officeDays'][number]

const SIGNAL_LABELS: Record<string, string> = {
  gps: wsAdmin.attendance.signalGps,
  wifi: wsAdmin.attendance.signalWifi,
  ip: wsAdmin.attendance.signalIp,
}

/** SQLite stores naive UTC ("2026-08-31 09:04:00"); make it explicit before parsing. */
function parseUtc(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
}

function timeOf(value: string | null): string {
  return value ? parseUtc(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
}

function isOfficeCounted(member: DashboardMember): boolean {
  const matched = member.latest_event?.matched_by
  return matched === 'verified' || matched === 'override'
}

function isFlagged(member: DashboardMember): boolean {
  const matched = member.latest_event?.matched_by
  return matched === 'partial' || matched === 'none'
}

export default function AttendanceClient({ slug, canAction }: Props) {
  const { show: showToast } = useToast()

  const [dash, setDash] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewWidgetsResponse | null>(null)
  const [queue, setQueue] = useState<RegularizationItem[]>([])

  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  // ── bulk office day ──
  const [officeDays, setOfficeDays] = useState<DeclaredOfficeDay[]>([])
  const [officeDayDate, setOfficeDayDate] = useState('')
  const [officeDayNote, setOfficeDayNote] = useState('')
  const [officeDayPreview, setOfficeDayPreview] = useState<OfficeDayCounts | null>(null)
  const [checkingOfficeDay, setCheckingOfficeDay] = useState(false)
  const [declaringOfficeDay, setDeclaringOfficeDay] = useState(false)
  const [undoingDate, setUndoingDate] = useState<string | null>(null)

  const [todayLabel, setTodayLabel] = useState('')
  const [maxOfficeDayDate, setMaxOfficeDayDate] = useState('')
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }))
    // Rendered on the client only, like todayLabel: the browser's clock is not
    // the server's, and painting a `max` during SSR would mismatch on hydration.
    setMaxOfficeDayDate(new Date().toLocaleDateString('en-CA'))
  }, [])

  const fetchDash = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/dashboard?status=all&signal=all&sortBy=name&sortDir=asc&page=1&limit=10`)
      if (res.ok) setDash(await res.json())
    } finally {
      if (!silent) setLoading(false)
    }
  }, [slug])

  const fetchQueue = useCallback(async () => {
    const [queueRes, overviewRes] = await Promise.all([
      fetch(`/api/ws/${slug}/approvals?type=regularization`, { cache: 'no-store' }),
      fetch(`/api/ws/${slug}/overview`, { cache: 'no-store' }),
    ])
    if (queueRes.ok) {
      const body = (await queueRes.json()) as ApprovalsResponse
      setQueue(body.items.filter((i): i is RegularizationItem => i.kind === 'regularization'))
    }
    if (overviewRes.ok) setOverview(await overviewRes.json())
  }, [slug])

  const fetchOfficeDays = useCallback(async () => {
    if (!canAction) return
    const res = await fetch(`/api/ws/${slug}/office-days`, { cache: 'no-store' })
    if (!res.ok) return
    const body = (await res.json()) as OfficeDaysListResponse
    setOfficeDays(body.officeDays)
  }, [slug, canAction])

  useEffect(() => {
    fetchDash()
    fetchQueue().catch(() => {})
    fetchOfficeDays().catch(() => {})
    const id = setInterval(() => fetchDash(true), 30_000)
    return () => clearInterval(id)
  }, [fetchDash, fetchQueue, fetchOfficeDays])

  const members = useMemo(() => dash?.all_members ?? [], [dash])
  const openMember = members.find((m) => m.member_id === openMemberId) ?? null

  // Regularizations carry the requester's email but not their user id, so the
  // roster row and its pending request are matched on email - the one field
  // both sides are guaranteed to have.
  const queueByEmail = useMemo(() => {
    const map = new Map<string, RegularizationItem>()
    for (const item of queue) map.set(item.user_email.toLowerCase(), item)
    return map
  }, [queue])

  const openRequest = openMember ? queueByEmail.get(openMember.email.toLowerCase()) ?? null : null

  async function actionRequest(item: RegularizationItem, action: 'approve' | 'reject', reason?: string) {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/regularization/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejection_reason: reason }),
      })
      if (!res.ok) {
        showToast(action === 'approve' ? wsAdmin.attendance.overrideFailed : wsAdmin.attendance.declineFailed, 'error')
        return
      }
      showToast(action === 'approve' ? wsAdmin.attendance.overrideDone : wsAdmin.attendance.declineDone, 'success')
      setDecliningId(null)
      setDeclineReason('')
      await Promise.all([fetchQueue(), fetchDash(true)])
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Step 1 of declaring an office day: a dry run.
   *
   * The confirm modal has to name a real number, and the server is the only
   * thing that knows it - only it can tell a signal-verified check-in from a
   * WFH one, and only it holds the weekend / holiday / plan-window refusals. So
   * the count in the modal comes from the same endpoint that will do the write,
   * and a refusal is surfaced here rather than after the admin has confirmed.
   */
  async function previewOfficeDay() {
    setCheckingOfficeDay(true)
    try {
      const res = await fetch(
        `/api/ws/${slug}/office-days?date=${encodeURIComponent(officeDayDate)}`,
        { cache: 'no-store' },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        const message = (body as { error?: string } | null)?.error
        showToast(message ?? wsAdmin.officeDay.failedToast, 'error')
        return
      }
      setOfficeDayPreview((body as OfficeDayPreviewResponse).preview)
    } catch {
      showToast(wsAdmin.officeDay.failedToast, 'error')
    } finally {
      setCheckingOfficeDay(false)
    }
  }

  async function declareOfficeDay() {
    if (!officeDayPreview) return
    setDeclaringOfficeDay(true)
    try {
      const res = await fetch(`/api/ws/${slug}/office-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: officeDayPreview.date, note: officeDayNote.trim() || undefined }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        const message = (body as { error?: string } | null)?.error
        showToast(message ?? wsAdmin.officeDay.failedToast, 'error')
        return
      }
      const result = body as OfficeDayResultResponse
      showToast(
        result.converted > 0 ? wsAdmin.officeDay.doneToast(result.converted) : wsAdmin.officeDay.nothingToast,
        result.converted > 0 ? 'success' : 'info',
      )
      setOfficeDayPreview(null)
      setOfficeDayNote('')
      await Promise.all([fetchOfficeDays(), fetchDash(true)])
    } finally {
      setDeclaringOfficeDay(false)
    }
  }

  async function undoOfficeDay(date: string) {
    setUndoingDate(date)
    try {
      const res = await fetch(`/api/ws/${slug}/office-days/${encodeURIComponent(date)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        showToast(wsAdmin.officeDay.undoFailedToast, 'error')
        return
      }
      showToast(wsAdmin.officeDay.undoneToast, 'success')
      await Promise.all([fetchOfficeDays(), fetchDash(true)])
    } finally {
      setUndoingDate(null)
    }
  }

  const wfoCount = members.filter(isOfficeCounted).length
  const flaggedCount = members.filter(isFlagged).length

  const columns: Column<DashboardMember>[] = [
    {
      key: 'name',
      header: wsAdmin.attendance.colName,
      render: (m) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Avatar name={m.full_name ?? m.email} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.full_name ?? m.email}
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      header: wsAdmin.attendance.colRole,
      render: (m) => <span className="t-secondary">{m.role}</span>,
    },
    {
      key: 'today',
      header: wsAdmin.attendance.colToday,
      render: (m) => <PresenceChip member={m} />,
    },
    {
      key: 'time',
      header: wsAdmin.attendance.colTime,
      render: (m) => (
        <span className="t-muted mono">{timeOf(m.latest_event?.checkin_at ?? null)}</span>
      ),
    },
    {
      key: 'chevron',
      header: '',
      width: 40,
      align: 'right',
      render: () => <ChevronRight size={15} aria-hidden style={{ color: 'var(--text-muted)' }} />,
    },
  ]

  const officeDayColumns: Column<DeclaredOfficeDay>[] = [
    {
      key: 'date',
      header: wsAdmin.officeDay.colDate,
      render: (d) => <span className="mono t-rowtitle">{d.date}</span>,
    },
    {
      key: 'people',
      header: wsAdmin.officeDay.colPeople,
      render: (d) => (
        <span className="t-secondary">{wsAdmin.officeDay.declaredCount(d.peopleCount)}</span>
      ),
    },
    {
      key: 'note',
      header: wsAdmin.officeDay.colNote,
      render: (d) => <span className="t-rowsub">{d.note ?? '—'}</span>,
    },
    {
      key: 'undo',
      header: '',
      width: 110,
      align: 'right',
      render: (d) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={undoingDate === d.date}
          loading={undoingDate === d.date}
          onClick={() => undoOfficeDay(d.date)}
        >
          {undoingDate === d.date ? wsAdmin.officeDay.undoing : wsAdmin.officeDay.undo}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div className="fx-spring row-between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1 className="t-h1">{wsAdmin.attendance.pageTitle}</h1>
          <p className="t-secondary" style={{ marginTop: '4px' }}>
            {wsAdmin.attendance.pageSubtitle}{todayLabel ? ` · ${todayLabel}` : ''}
          </p>
        </div>
        {dash && (
          <p className="t-muted">{wsAdmin.attendance.showing(members.length, dash.counts.total)}</p>
        )}
      </div>

      <div
        className="fx-spring-stagger"
        style={{ display: 'flex', gap: '14px', marginTop: '16px', flexWrap: 'wrap' }}
      >
        <StatCard
          style={{ flex: '1 1 200px', marginTop: 0 }}
          label={wsAdmin.attendance.verifiedWfoTitle}
          accent="brand"
          value={loading ? <Skeleton width={48} height={30} /> : wfoCount}
        />
        <StatCard
          style={{ flex: '1 1 200px', marginTop: 0 }}
          label={wsAdmin.attendance.onLeaveTitle}
          value={overview ? overview.onLeaveToday : <Skeleton width={48} height={30} />}
        />
        <StatCard
          style={{ flex: '1 1 200px', marginTop: 0 }}
          label={wsAdmin.attendance.partialTitle}
          accent="amber"
          value={loading ? <Skeleton width={48} height={30} /> : flaggedCount}
        />
        <StatCard
          style={{ flex: '1 1 200px', marginTop: 0 }}
          label={wsAdmin.attendance.regularizationsTitle}
          value={queue.length}
        />
      </div>

      {/* ── Roster ── */}
      <Card className="fx-spring" padded={false} style={{ marginTop: '14px', overflow: 'hidden' }}>
        {loading ? (
          <div className="stack" style={{ padding: '20px' }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={34} />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={members}
            rowKey={(m) => m.member_id}
            minWidth={640}
            onRowClick={(m) => setOpenMemberId(m.member_id)}
            empty={(
              <EmptyState
                title={wsAdmin.attendance.rosterEmptyTitle}
                hint={wsAdmin.attendance.rosterEmptyHint}
              />
            )}
          />
        )}
      </Card>

      {/* ── Regularization queue ── */}
      <Card className="fx-spring" padded={false} style={{ marginTop: '14px', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <p className="t-h2">{wsAdmin.attendance.queueTitle}</p>
          {queue.length > 0 && <Chip tone="partial">{queue.length}</Chip>}
        </div>

        {queue.length === 0 ? (
          <EmptyState
            title={wsAdmin.attendance.queueEmptyTitle}
            hint={wsAdmin.attendance.queueEmptyHint}
          />
        ) : (
          queue.map((item) => {
            const name = item.user_full_name ?? item.user_email
            const declining = decliningId === item.id
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: declining ? 'stretch' : 'center', gap: '12px',
                  padding: '13px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap',
                  flexDirection: declining ? 'column' : 'row',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 220px', minWidth: 0 }}>
                  <Avatar name={name} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', margin: 0 }}>
                      {name}
                    </p>
                    <p className="t-muted" style={{ margin: 0 }}>{item.reason}</p>
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: '150px' }}>
                  <p className="mono" style={{ fontSize: '12.5px', margin: 0 }}>{item.target_date}</p>
                  <p className="t-muted mono" style={{ margin: 0 }}>
                    {item.requested_type === 'office' ? en.wsApprovals.markWfo : en.wsApprovals.markWfh}
                  </p>
                </div>

                {canAction && (declining ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
                    <Input
                      autoFocus
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder={en.wsApprovals.declineReasonPlaceholder}
                      style={{ flex: '1 1 200px', height: '38px' }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setDecliningId(null); setDeclineReason('') }}
                    >
                      {en.wsApprovals.cancel}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === item.id || !declineReason.trim()}
                      onClick={() => actionRequest(item, 'reject', declineReason.trim())}
                    >
                      {en.wsApprovals.confirmDecline}
                    </Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => { setDecliningId(item.id); setDeclineReason('') }}
                    >
                      {en.wsApprovals.decline}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => actionRequest(item, 'approve')}
                    >
                      {en.wsApprovals.approve}
                    </Button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </Card>

      {/* ── Bulk office day ──
          Sits beside the regularization queue because it generalises it: a
          regularization corrects one person's day, an office day corrects
          everybody's at once. Same `approvals:write` permission, same
          admin_overrides mechanism, so the monthly grid, analytics, the export
          and /me all pick it up with no read-path change. */}
      {canAction && (
        <Card className="fx-spring overflow-hidden" padded={false}>
          <div className="table-head">
            <p className="t-h2">{wsAdmin.officeDay.cardTitle}</p>
            <p className="t-muted">{wsAdmin.officeDay.cardHint}</p>
          </div>

          <div className="pad-list stack">
            <div className="field-grid">
              <Field label={wsAdmin.officeDay.dateLabel} htmlFor="office-day-date">
                <Input
                  id="office-day-date"
                  type="date"
                  value={officeDayDate}
                  max={maxOfficeDayDate || undefined}
                  onChange={(e) => setOfficeDayDate(e.target.value)}
                />
              </Field>
              <Field label={wsAdmin.officeDay.noteLabel} htmlFor="office-day-note">
                <Input
                  id="office-day-note"
                  value={officeDayNote}
                  placeholder={wsAdmin.officeDay.notePlaceholder}
                  onChange={(e) => setOfficeDayNote(e.target.value)}
                />
              </Field>
            </div>
            <div className="row-end-sm">
              <Button
                disabled={!officeDayDate || checkingOfficeDay}
                loading={checkingOfficeDay}
                onClick={previewOfficeDay}
              >
                {checkingOfficeDay ? wsAdmin.officeDay.checking : wsAdmin.officeDay.declareAction}
              </Button>
            </div>
          </div>

          <Divider />

          <div className="table-head row-between">
            <p className="t-h2">{wsAdmin.officeDay.declaredTitle}</p>
            {officeDays.length > 0 && <Chip tone="override">{officeDays.length}</Chip>}
          </div>

          <DataTable
            columns={officeDayColumns}
            rows={officeDays}
            rowKey={(d) => d.date}
            minWidth={520}
            empty={(
              <EmptyState
                title={wsAdmin.officeDay.declaredEmptyTitle}
                hint={wsAdmin.officeDay.declaredEmptyHint}
              />
            )}
          />
        </Card>
      )}

      {/* Confirm names the count BEFORE anything is written - the number comes
          from the dry run above, not from a guess made in the browser. */}
      <Modal
        open={!!officeDayPreview}
        onClose={() => setOfficeDayPreview(null)}
        title={wsAdmin.officeDay.confirmTitle}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOfficeDayPreview(null)}>
              {wsAdmin.officeDay.confirmCancel}
            </Button>
            <Button
              disabled={declaringOfficeDay || officeDayPreview?.converted === 0}
              loading={declaringOfficeDay}
              onClick={declareOfficeDay}
            >
              {wsAdmin.officeDay.confirmAction}
            </Button>
          </>
        )}
      >
        {officeDayPreview && (
          <div className="stack-sm">
            <p className="t-secondary">
              {officeDayPreview.converted > 0
                ? wsAdmin.officeDay.confirmBody(officeDayPreview.converted, officeDayPreview.date)
                : wsAdmin.officeDay.confirmNobody(officeDayPreview.date)}
            </p>
            <p className="t-muted">
              {wsAdmin.officeDay.confirmDetail(officeDayPreview.alreadyOffice, officeDayPreview.skipped)}
            </p>
            <p className="t-muted">{wsAdmin.officeDay.confirmNote}</p>
          </div>
        )}
      </Modal>

      {/* ── Drill-down ── */}
      <SlideOver open={!!openMember} onClose={() => setOpenMemberId(null)}>
        {openMember && (
          <>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                <Avatar name={openMember.full_name ?? openMember.email} size={44} />
                <div style={{ minWidth: 0 }}>
                  <p className="t-h2">{openMember.full_name ?? openMember.email}</p>
                  <p className="t-muted">{openMember.role}</p>
                </div>
              </div>
              <IconButton
                variant="plain"
                label={wsAdmin.attendance.close}
                icon={<X size={16} />}
                onClick={() => setOpenMemberId(null)}
              />
            </div>

            <Divider />

            <p className="t-eyebrow">{wsAdmin.attendance.statusEyebrow}</p>
            <div style={{ marginTop: '8px' }}><PresenceChip member={openMember} /></div>

            {openMember.latest_event ? (
              <>
                <p className="t-eyebrow" style={{ marginTop: '16px' }}>
                  {wsAdmin.attendance.signalsEyebrow}
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {['gps', 'wifi', 'ip'].map((type) => {
                    const matched = openMember.latest_event!.matched_signals.includes(type)
                    return (
                      <Chip
                        key={type}
                        tone={matched ? 'verified' : 'none'}
                        title={matched ? wsAdmin.attendance.signalMatched : wsAdmin.attendance.signalUnmatched}
                      >
                        {SIGNAL_LABELS[type]} {matched ? '✓' : '✗'}
                      </Chip>
                    )
                  })}
                </div>

                <p className="t-eyebrow" style={{ marginTop: '16px' }}>
                  {wsAdmin.attendance.detailsEyebrow}
                </p>
                <div className="stack-sm" style={{ marginTop: '8px' }}>
                  <div className="row-between">
                    <span className="t-secondary">{wsAdmin.attendance.checkedInAt}</span>
                    <span className="mono t-secondary">{timeOf(openMember.latest_event.checkin_at)}</span>
                  </div>
                  <div className="row-between">
                    <span className="t-secondary">{wsAdmin.attendance.checkedOutAt}</span>
                    <span className="mono t-secondary">
                      {openMember.latest_event.checkout_at
                        ? timeOf(openMember.latest_event.checkout_at)
                        : wsAdmin.attendance.stillIn}
                    </span>
                  </div>
                  <div className="row-between">
                    <span className="t-secondary">{wsAdmin.attendance.locationLabel}</span>
                    <span className="t-secondary" style={{ textAlign: 'right' }}>
                      {openMember.latest_event.location_label ?? '—'}
                    </span>
                  </div>
                </div>

                {openMember.latest_event.trust_flags.length > 0 && (
                  <>
                    <p className="t-eyebrow" style={{ marginTop: '16px' }}>
                      {wsAdmin.attendance.trustFlags}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {openMember.latest_event.trust_flags.map((flag) => (
                        <Chip key={flag} tone="none">{flag}</Chip>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="t-secondary" style={{ marginTop: '12px' }}>
                {wsAdmin.attendance.noEventToday}
              </p>
            )}

            <Divider />

            <p className="t-eyebrow">{wsAdmin.attendance.overrideEyebrow}</p>
            {isOfficeCounted(openMember) ? (
              <p className="t-secondary" style={{ marginTop: '8px' }}>
                {wsAdmin.attendance.alreadyVerified}
              </p>
            ) : openRequest && canAction ? (
              <>
                <p className="t-secondary" style={{ marginTop: '8px' }}>
                  {openRequest.target_date} · {openRequest.reason}
                </p>
                <Button
                  block
                  style={{ marginTop: '10px' }}
                  disabled={busyId === openRequest.id}
                  onClick={() => actionRequest(openRequest, 'approve')}
                >
                  {wsAdmin.attendance.overrideAction}
                </Button>
                <p className="t-muted" style={{ marginTop: '8px' }}>
                  {wsAdmin.attendance.overrideNote}
                </p>
              </>
            ) : (
              <p className="t-secondary" style={{ marginTop: '8px' }}>
                {wsAdmin.attendance.overrideUnavailable}
              </p>
            )}

            <Divider />

            {/* The person screen's Activity tab, keyed on the MEMBERSHIP id.
                It replaced a standalone `/members/:userId` page - and note the
                two ids are not interchangeable: an invited person has a
                membership and no user, which is exactly why that route is
                keyed the way it is. */}
            <Link href={`/ws/${slug}/people/${openMember.member_id}/details?tab=activity`} className="btn btn-secondary btn-block pressable" style={{ textDecoration: 'none' }}>
              {wsAdmin.attendance.viewTimeline}
            </Link>
          </>
        )}
      </SlideOver>
    </div>
  )
}
