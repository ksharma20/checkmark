'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { Users, Building2, Home, CalendarOff, Activity } from 'lucide-react'
import type { DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { InsightsResponse } from '@/app/api/ws/[slug]/insights/route'
import type { OverviewWidgetsResponse } from '@/app/api/ws/[slug]/overview/route'
import type { ApprovalItem } from '@/lib/approvals'
import { ApprovalRow } from '@/components/ws/ApprovalRow'
import PresenceChip from '@/components/ws/PresenceChip'
import {
  AreaChart, Button, Card, Chip, DataTable, DeptBars, EmptyState, Skeleton, StatCard,
  type AreaChartPoint, type Column, type DeptBarItem,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props {
  slug: string
  planLimitBanner?: React.ReactNode
  adminFirstName: string
  /** `approvals:write` - read-only roles see the queue without action buttons. */
  canAction: boolean
}

const CELEBRATION_EMOJI = { birthday: '🎂', anniversary: '🎉' } as const

/** SQLite stores naive UTC ("2026-08-31 09:04:00"); make it explicit before parsing. */
function parseUtc(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
}

/** "9" -> "9AM", "14" -> "2PM". Hour keys come from the insights endpoint. */
function hourLabel(key: string): string {
  const hour = parseInt(key, 10)
  if (Number.isNaN(hour)) return key
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12}${suffix}`
}

type LocationRow = { label: string; count: number }

export default function TodayClient({ slug, planLimitBanner, adminFirstName, canAction }: Props) {
  const { show: showToast } = useToast()

  const [dash, setDash] = useState<DashboardResponse | null>(null)
  const [dashLoading, setDashLoading] = useState(true)
  const [hourly, setHourly] = useState<InsightsResponse | null>(null)
  const [hourlyLoading, setHourlyLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewWidgetsResponse | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Rendered on the client only: the workspace date string depends on the
  // viewer's locale and timezone, so producing it on the server guarantees a
  // hydration mismatch.
  const [todayLabel, setTodayLabel] = useState('')
  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    }))
  }, [])

  const fetchDash = useCallback(async (silent = false) => {
    if (!silent) setDashLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/dashboard?status=all&signal=all&sortBy=name&sortDir=asc&page=1&limit=10`)
      if (res.ok) setDash(await res.json())
    } finally {
      if (!silent) setDashLoading(false)
    }
  }, [slug])

  const fetchHourly = useCallback(async (silent = false) => {
    if (!silent) setHourlyLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/insights?interval=today`, { cache: 'no-store' })
      if (res.ok) setHourly(await res.json())
    } finally {
      if (!silent) setHourlyLoading(false)
    }
  }, [slug])

  const fetchOverview = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/overview`, { cache: 'no-store' })
    if (res.ok) setOverview(await res.json())
  }, [slug])

  useEffect(() => {
    fetchDash()
    fetchHourly()
    fetchOverview().catch(() => {})
    const dashId = setInterval(() => fetchDash(true), 30_000)
    const hourlyId = setInterval(() => fetchHourly(true), 60_000)
    return () => { clearInterval(dashId); clearInterval(hourlyId) }
  }, [fetchDash, fetchHourly, fetchOverview])

  async function actionApproval(item: ApprovalItem, action: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/${item.kind}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejection_reason: rejectionReason }),
      })
      if (!res.ok) { showToast(wsAdmin.approvals.actionFailed, 'error'); return }
      setDecliningId(null)
      await fetchOverview()
    } finally {
      setBusyId(null)
    }
  }

  async function exportReport() {
    setExporting(true)
    try {
      // The export route reads `year`/`month` and answers with a workbook, so
      // the download must be named .xlsx - it was previously asked for a date
      // RANGE and saved as .csv, which produced an unopenable file.
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const res = await fetch(`/api/ws/${slug}/export?year=${year}&month=${month}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        showToast(body.error ?? wsAdmin.overview.exportFailed, 'error')
        return
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance-${slug}-${year}-${String(month).padStart(2, '0')}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const counts = dash?.counts ?? { present: 0, visited: 0, notIn: 0, total: 0, office: 0, remote: 0 }
  const pendingTotal = overview?.pendingApprovalsTotal ?? 0

  const attentionLine = overview
    ? pendingTotal === 0
      ? en.wsOverview.subtitleAllClear
      : pendingTotal === 1
        ? en.wsOverview.subtitlePendingSingular
        : en.wsOverview.subtitlePendingPlural.replace('{count}', String(pendingTotal))
    : ''

  const chartPoints: AreaChartPoint[] = [...(hourly?.buckets ?? [])]
    .sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10))
    .map((b) => ({ label: hourLabel(b.key), value: b.unique_users }))

  const locationRows: LocationRow[] = dash?.location_counts ?? []
  const locationColumns: Column<LocationRow>[] = [
    { key: 'label', header: wsAdmin.overview.locationColumn },
    {
      key: 'count',
      header: wsAdmin.overview.membersColumn,
      align: 'right',
      render: (row) => <span className="mono" style={{ fontWeight: 700 }}>{row.count}</span>,
    },
  ]

  // Bars are a share of HEADCOUNT, not of the biggest bar: with one department
  // filled in out of 34 members, scaling to the largest bar would draw a full-
  // width bar and read as "this workspace has one department". The trailing
  // "No HR details" segment keeps the denominator on screen.
  const dept = overview?.departmentBreakdown
  const deptTotal = (dept?.withDepartment ?? 0) + (dept?.withoutDepartment ?? 0)
  const deptShare = (count: number) => (deptTotal > 0 ? Math.round((count / deptTotal) * 100) : 0)
  const deptItems: DeptBarItem[] = [
    ...(dept?.departments ?? []).map((d) => ({
      label: d.department,
      count: d.count,
      percent: deptShare(d.count),
    })),
    ...(dept && dept.withoutDepartment > 0
      ? [{
          label: wsAdmin.overview.departmentUnknown,
          count: dept.withoutDepartment,
          percent: deptShare(dept.withoutDepartment),
          color: 'var(--text-muted)',
        }]
      : []),
  ]

  const recentActivity = (dash?.all_members ?? [])
    .filter((m) => m.latest_event)
    .sort((a, b) => b.latest_event!.checkin_at.localeCompare(a.latest_event!.checkin_at))
    .slice(0, 6)

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 20px', borderTop: '1px solid var(--border)',
  }
  const panelHeadStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border)',
  }

  return (
    <div>
      {/* ── Greeting ── */}
      <div className="fx-spring row-between" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 className="t-h1">{en.wsOverview.greeting}, {adminFirstName}</h1>
          <p className="t-secondary" style={{ marginTop: '2px' }}>
            {todayLabel}{todayLabel && attentionLine ? ' · ' : ''}{attentionLine}
          </p>
        </div>
        <Button onClick={exportReport} loading={exporting}>
          {exporting ? wsAdmin.overview.exporting : wsAdmin.overview.exportReport}
        </Button>
      </div>

      {planLimitBanner}

      {/* ── Stat cards ── */}
      <div
        className="fx-spring-stagger"
        style={{ display: 'flex', gap: '14px', marginTop: '16px', flexWrap: 'wrap' }}
      >
        <Link href={`/ws/${slug}/people`} style={{ flex: '1 1 200px', display: 'flex', textDecoration: 'none' }}>
          <StatCard
            className="hoverlift"
            style={{ flex: 1, marginTop: 0 }}
            label={wsAdmin.overview.headcountTitle}
            value={overview ? overview.activeMembers : <Skeleton width={48} height={28} />}
            hint={wsAdmin.overview.headcountHint}
            icon={<Users size={17} />}
          />
        </Link>
        <Link href={`/ws/${slug}/attendance`} style={{ flex: '1 1 200px', display: 'flex', textDecoration: 'none' }}>
          <StatCard
            className="hoverlift"
            style={{ flex: 1, marginTop: 0 }}
            label={wsAdmin.overview.inOfficeTitle}
            value={dashLoading ? <Skeleton width={48} height={28} /> : counts.office}
            hint={wsAdmin.overview.inOfficeHint}
            accent="brand"
            icon={<Building2 size={17} />}
          />
        </Link>
        <Link href={`/ws/${slug}/attendance`} style={{ flex: '1 1 200px', display: 'flex', textDecoration: 'none' }}>
          <StatCard
            className="hoverlift"
            style={{ flex: 1, marginTop: 0 }}
            label={wsAdmin.overview.remoteTitle}
            value={dashLoading ? <Skeleton width={48} height={28} /> : counts.remote}
            hint={wsAdmin.overview.remoteHint}
            accent="amber"
            icon={<Home size={17} />}
          />
        </Link>
        <Link href={`/ws/${slug}/leaves`} style={{ flex: '1 1 200px', display: 'flex', textDecoration: 'none' }}>
          <StatCard
            className="hoverlift"
            style={{ flex: 1, marginTop: 0 }}
            label={en.wsOverview.onLeaveTitle}
            value={overview ? overview.onLeaveToday : <Skeleton width={48} height={28} />}
            hint={en.wsOverview.onLeaveSub}
            icon={<CalendarOff size={17} />}
          />
        </Link>
      </div>

      {/* ── Office presence + active members ── */}
      <div className="fx-spring" style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
        <Card style={{ flex: '1.15 1 380px', marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="dash-ic" style={{ position: 'static' }} aria-hidden>
              <Activity size={17} />
            </span>
            <div>
              <span className="t-h2">{wsAdmin.overview.officePresenceTitle}</span>{' '}
              <span className="t-muted">{wsAdmin.overview.officePresenceHint}</span>
            </div>
          </div>
          <div style={{ marginTop: '18px' }}>
            {hourlyLoading
              ? <Skeleton height={220} />
              : <AreaChart points={chartPoints} label={wsAdmin.overview.officePresenceChartLabel} />}
          </div>
        </Card>

        <Card style={{ flex: '1 1 280px', marginTop: 0 }}>
          <p className="t-eyebrow">{wsAdmin.overview.activeMembersTitle}</p>
          {/* A div, not a paragraph: the loading branch renders Skeleton, which
              is a block-level div, and HTML forbids a div inside a paragraph.
              `.stat-num` is purely typographic, so the two render identically. */}
          <div className="stat-num" style={{ marginTop: '6px' }}>
            {dashLoading ? <Skeleton width={64} height={30} /> : counts.present}
          </div>
          <div style={{ marginTop: '14px' }}>
            <DataTable
              columns={locationColumns}
              rows={locationRows}
              rowKey={(row) => row.label}
              empty={<EmptyState title={wsAdmin.overview.noActivity} />}
            />
          </div>
        </Card>
      </div>

      {/* ── Pending approvals + headcount ── */}
      <div className="fx-spring" style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
        <Card fixedHeight padded={false} style={{ flex: '1.15 1 380px', marginTop: 0, overflow: 'hidden' }}>
          <div style={panelHeadStyle}>
            <p className="t-h2">{en.wsOverview.pendingApprovalsTitle}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {pendingTotal > 0 && <Chip tone="partial">{pendingTotal}</Chip>}
              {pendingTotal > (overview?.pendingApprovals.length ?? 0) && (
                <Link href={`/ws/${slug}/approvals`} className="t-secondary" style={{ fontWeight: 600 }}>
                  {wsAdmin.overview.viewAll(pendingTotal)}
                </Link>
              )}
            </div>
          </div>
          <div className="scroll-body">
            {overview && overview.pendingApprovals.length === 0 ? (
              <EmptyState title={en.wsApprovals.emptyTitle} hint={en.wsOverview.pendingApprovalsEmpty} />
            ) : (
              overview?.pendingApprovals.map((item) => (
                <ApprovalRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  busy={busyId === item.id || !canAction}
                  declining={decliningId === item.id}
                  onApprove={() => actionApproval(item, 'approve')}
                  onDeclineStart={() => setDecliningId(item.id)}
                  onDeclineCancel={() => setDecliningId(null)}
                  onDeclineConfirm={(reason) => actionApproval(item, 'reject', reason)}
                />
              ))
            )}
          </div>
        </Card>

        <Card fixedHeight style={{ flex: '1 1 280px', marginTop: 0 }}>
          <p className="t-h2" style={{ marginBottom: '14px' }}>{en.wsOverview.departmentTitle}</p>
          <div className="scroll-body">
            {!dept ? (
              <Skeleton height={140} />
            ) : dept.departments.length === 0 ? (
              <EmptyState
                title={wsAdmin.overview.departmentEmpty}
                hint={
                  <>
                    {wsAdmin.overview.departmentEmptyHint}{' '}
                    <Link href={`/ws/${slug}/people`} style={{ fontWeight: 600 }}>
                      {wsAdmin.overview.departmentEmptyAction}
                    </Link>
                  </>
                }
              />
            ) : (
              <>
                <DeptBars items={deptItems} label={wsAdmin.overview.departmentChartLabel} />
                <p className="t-muted" style={{ margin: '12px 0 0' }}>
                  {wsAdmin.overview.departmentCoverage(dept.withDepartment, deptTotal)}
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── Recent activity + celebrations ── */}
      <div className="fx-spring" style={{ display: 'flex', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
        <Card fixedHeight padded={false} style={{ flex: '1.3 1 380px', marginTop: 0, overflow: 'hidden' }}>
          <p className="t-h2" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {en.wsOverview.recentActivityTitle}
          </p>
          <div className="scroll-body">
            {recentActivity.length === 0 ? (
              <EmptyState title={en.wsOverview.recentActivityEmpty} />
            ) : (
              recentActivity.map((m) => (
                <Link
                  key={m.member_id}
                  // The person screen's Activity tab. Keyed on the MEMBERSHIP
                  // id, not the user id - the two are not interchangeable.
                  href={`/ws/${slug}/people/${m.member_id}/details?tab=activity`}
                  className="rowlink"
                  style={{ ...rowStyle, textDecoration: 'none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
                      {m.full_name ?? m.email}
                    </p>
                    <p className="t-muted" style={{ margin: 0 }}>
                      {parseUtc(m.latest_event!.checkin_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <PresenceChip member={m} />
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card fixedHeight padded={false} style={{ flex: '1 1 280px', marginTop: 0, overflow: 'hidden' }}>
          <p className="t-h2" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {en.wsOverview.celebrationsTitle}
          </p>
          <div className="scroll-body">
            {overview && overview.celebrations.length === 0 ? (
              <EmptyState
                title={en.wsOverview.celebrationsEmpty}
                hint={wsAdmin.overview.celebrationsEmptyHint}
              />
            ) : (
              overview?.celebrations.map((c) => (
                <div key={`${c.employeeId}-${c.kind}`} style={rowStyle}>
                  <span
                    aria-hidden
                    style={{
                      width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '15px', flexShrink: 0,
                    }}
                  >
                    {CELEBRATION_EMOJI[c.kind]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)', margin: 0 }}>
                      {c.name}
                    </p>
                    <p className="t-muted" style={{ margin: 0 }}>
                      {c.kind === 'birthday'
                        ? en.wsOverview.birthdayLabel
                        : `${c.yearsCount}-year ${en.wsOverview.anniversaryLabel}`}
                    </p>
                  </div>
                  <span className="t-muted mono">
                    {new Date(`${c.occursOn}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
