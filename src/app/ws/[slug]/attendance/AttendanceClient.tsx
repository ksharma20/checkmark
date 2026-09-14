'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { DashboardMember, DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { OverviewWidgetsResponse } from '@/app/api/ws/[slug]/overview/route'
import type {
  OfficeDayCounts,
  OfficeDayPreviewResponse,
  OfficeDayResultResponse,
  OfficeDaysListResponse,
} from '@/app/api/ws/[slug]/office-days/route'
import PresenceChip from '@/components/ws/PresenceChip'
import {
  Avatar, Button, Card, Chip, ConfirmDialog, DataTable, Divider, EmptyState, Field, IconButton,
  Input, SlideOver, Skeleton, StatCard, TabBar, type Column,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props {
  slug: string
  /** `approvals:write` - drives whether the bulk office day card is offered. */
  canAction: boolean
}

/** Derived from the route's own response type so the two cannot drift. */
type DeclaredOfficeDay = OfficeDaysListResponse['officeDays'][number]

/* Keyed by the values `deriveConfiguredTypes()` can return - 'gps' and 'ip'.
   There is deliberately no 'wifi' entry: the SSID is collected and hashed as a
   trust signal but `workspace_signals.signal_type` cannot hold it, so it can
   never be matched against and must never be drawn as a failed check. */
const SIGNAL_LABELS: Record<string, string> = {
  gps: wsAdmin.attendance.signalGps,
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
  const [tab, setTab] = useState<'roster' | 'officeDays'>('roster')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewWidgetsResponse | null>(null)

  const [openMemberId, setOpenMemberId] = useState<string | null>(null)

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

  /**
   * The "On leave" stat, and only that. This page is gated on `dashboard:read`,
   * so it must not touch an `approvals:read` endpoint - it used to fetch the
   * regularization queue alongside this and silently 403'd for roles that hold
   * one permission but not the other. Pending regularizations are actioned on
   * /ws/:slug/approvals, which is the one place that does it.
   */
  const fetchOverview = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/overview`, { cache: 'no-store' })
    if (res.ok) setOverview(await res.json())
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
    fetchOverview().catch(() => {})
    fetchOfficeDays().catch(() => {})
    const id = setInterval(() => fetchDash(true), 30_000)
    return () => clearInterval(id)
  }, [fetchDash, fetchOverview, fetchOfficeDays])

  const members = useMemo(() => dash?.all_members ?? [], [dash])
  const openMember = members.find((m) => m.member_id === openMemberId) ?? null
  const configuredSignalTypes = dash?.configured_signal_types ?? []

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
      </div>

      {/* Two unbounded lists, so two tabs rather than one scroll. The roster
          grows with headcount and the declared office days grow with time;
          stacked, the second was only reachable by scrolling past the whole of
          the first. The declare form stays a fixed card ABOVE its list - a
          form's height never changes, a list's always does. */}
      {canAction && (
        <TabBar
          style={{ marginTop: '16px' }}
          tabs={[
            { key: 'roster', label: wsAdmin.attendance.tabRoster },
            { key: 'officeDays', label: wsAdmin.attendance.tabOfficeDays, badge: officeDays.length },
          ]}
          active={tab}
          onChange={(key) => setTab(key as 'roster' | 'officeDays')}
        />
      )}

      {/* ── Roster ── */}
      {(!canAction || tab === 'roster') && (
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
      )}

      {/* ── Bulk office day ──
          It generalises a regularization: a regularization corrects one
          person's day, an office day corrects everybody's at once. Same
          `approvals:write` permission, same admin_overrides mechanism, so the
          monthly grid, analytics, the export and /me all pick it up with no
          read-path change. Actioning an individual regularization lives on
          /ws/:slug/approvals, not here. */}
      {canAction && tab === 'officeDays' && (
        <>
        <Card className="fx-spring overflow-hidden" padded={false} style={{ marginTop: '14px' }}>
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
        </Card>

        <Card className="fx-spring overflow-hidden" padded={false}>
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
        </>
      )}

      {/* Confirm names the count BEFORE anything is written - the number comes
          from the dry run above, not from a guess made in the browser. */}
      {/* `tone="primary"`: declaring an office day writes overrides, it destroys
          nothing. The two muted lines share the one `note` slot - the breakdown
          and the caveat are read together, and splitting them would need a
          shape `ConfirmDialog` deliberately does not have. */}
      <ConfirmDialog
        open={!!officeDayPreview}
        onClose={() => setOfficeDayPreview(null)}
        onConfirm={() => void declareOfficeDay()}
        tone="primary"
        title={wsAdmin.officeDay.confirmTitle}
        body={
          officeDayPreview
            ? (officeDayPreview.converted > 0
                ? wsAdmin.officeDay.confirmBody(officeDayPreview.converted, officeDayPreview.date)
                : wsAdmin.officeDay.confirmNobody(officeDayPreview.date))
            : ''
        }
        note={
          officeDayPreview ? (
            <>
              {wsAdmin.officeDay.confirmDetail(officeDayPreview.alreadyOffice, officeDayPreview.skipped)}
              <br />
              {wsAdmin.officeDay.confirmNote}
            </>
          ) : undefined
        }
        confirmLabel={wsAdmin.officeDay.confirmAction}
        cancelLabel={wsAdmin.officeDay.confirmCancel}
        loading={declaringOfficeDay}
        // A dry run that converts nobody has nothing to write, and the dialog
        // already says so - `confirmNobody` above. Blocking the action keeps
        // the explanation on screen instead of answering it with a no-op POST.
        confirmDisabled={officeDayPreview?.converted === 0}
      />

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
                {/* Only the types this workspace actually matches against get a
                    tick or a cross. An override bypasses matching altogether
                    and a config-light workspace has nothing to match, so both
                    say so in words - a row of crosses beside a "verified" chip
                    reads as a failure that never happened. */}
                {openMember.latest_event.matched_by === 'override' ? (
                  <p className="t-muted" style={{ marginTop: '8px' }}>{wsAdmin.attendance.signalsOverridden}</p>
                ) : configuredSignalTypes.length === 0 ? (
                  <p className="t-muted" style={{ marginTop: '8px' }}>{wsAdmin.attendance.signalsNoneConfigured}</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {configuredSignalTypes.map((type) => {
                      const matched = openMember.latest_event!.matched_signals.includes(type)
                      return (
                        <Chip
                          key={type}
                          tone={matched ? 'verified' : 'none'}
                          title={matched ? wsAdmin.attendance.signalMatched : wsAdmin.attendance.signalUnmatched}
                        >
                          {SIGNAL_LABELS[type] ?? type} {matched ? '✓' : '✗'}
                        </Chip>
                      )
                    })}
                  </div>
                )}

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
