'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Card, DataTable, EmptyState, Field, Input, Progress, Skeleton, StatCard } from '@/components/ui'
import type { Column } from '@/components/ui'
import type { AnalyticsMember, AnalyticsResponse } from '@/app/api/ws/[slug]/analytics/route'
import { fmtHours } from '@/lib/client/format-time'
import { wsAdmin } from '@/locales/en/ws-settings'

const t = wsAdmin.analytics

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`
}

function thisMonthRange(): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

/** A labelled day-count bar: `Progress` plus the raw number beside it. */
function DayBar({ value, max, color }: { value: number; max: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Progress percent={max > 0 ? (value / max) * 100 : 0} color={color} style={{ flex: 1 }} />
      <span className="mono t-muted" style={{ minWidth: '22px', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

interface Props {
  slug: string
}

/**
 * The per-member half of Analytics, rendered under the bucketed charts on
 * /ws/[slug]/insights.
 *
 * The charts above answer "when is the office busy?" from time buckets; this
 * answers "who was actually here?" from GET /api/ws/[slug]/analytics, which
 * returns office / remote / absent day counts and hours per member over an
 * arbitrary date range. Different question, different endpoint - which is why
 * this is a companion to InsightsClient rather than a duplicate of it.
 */
export default function AnalyticsClient({ slug }: Props) {
  const initial = thisMonthRange()
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  const fetchAnalytics = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/analytics?start=${start}&end=${end}`)
      if (res.status === 403) { setDenied(true); return }
      if (res.ok) {
        setDenied(false)
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchAnalytics(startDate, endDate) }, [fetchAnalytics, startDate, endDate])

  const signalsConfigured = !!data?.signals_configured
  const members = data?.members ?? []

  const totalOfficeDays = members.reduce((sum, m) => sum + m.office_days, 0)
  const totalPresentDays = members.reduce((sum, m) => sum + m.office_days + m.wfh_days, 0)
  const totalHours = members.reduce((sum, m) => sum + m.total_hours, 0)
  const avgAttendance = members.length
    ? Math.round((totalPresentDays / members.length) * 10) / 10
    : 0

  const columns: Column<AnalyticsMember>[] = [
    {
      key: 'member',
      header: t.colMember,
      width: 220,
      render: (m) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <Avatar name={m.name} size={30} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: '13px' }}>{m.name}</span>
            <span className="mono t-muted" style={{ display: 'block', fontSize: '10.5px' }}>{m.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'joined',
      header: t.colJoined,
      width: 96,
      render: (m) => <span className="mono t-muted">{fmtDate(m.joined_at)}</span>,
    },
    ...(signalsConfigured
      ? [{
          key: 'office',
          header: t.colOffice,
          render: (m: AnalyticsMember) => (
            <DayBar value={m.office_days} max={m.working_days} color="var(--brand)" />
          ),
        }]
      : []),
    {
      key: 'presence',
      header: signalsConfigured ? t.colRemote : t.colPresent,
      render: (m) =>
        signalsConfigured
          ? <DayBar value={m.wfh_days} max={m.working_days} color="var(--amber)" />
          : <DayBar value={m.office_days + m.wfh_days} max={m.working_days} color="var(--brand)" />,
    },
    {
      key: 'absent',
      header: t.colAbsent,
      render: (m) => <DayBar value={m.absent_days} max={m.working_days} color="var(--danger)" />,
    },
    {
      key: 'total_hours',
      header: t.colTotalHours,
      width: 92,
      align: 'right',
      render: (m) => <span className="mono">{fmtHours(m.total_hours)}</span>,
    },
    {
      key: 'avg',
      header: t.colAvgPerDay,
      width: 100,
      align: 'right',
      render: (m) => (
        <span>
          <span className="mono" style={{ display: 'block' }}>{fmtHours(m.avg_daily_hours)}</span>
          {m.multi_location_days > 0 && (
            <span className="t-muted" style={{ fontSize: '10px' }}>
              {t.multiLocation(m.multi_location_days)}
            </span>
          )}
        </span>
      ),
    },
  ]

  if (denied) {
    return (
      <Card style={{ marginTop: '28px' }}>
        <p className="t-secondary">{t.forbidden}</p>
      </Card>
    )
  }

  return (
    <section style={{ marginTop: '28px' }}>
      <div className="row-between" style={{ flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 className="t-h2">{t.heading}</h2>
          {data && (
            <p className="t-secondary" style={{ marginTop: '2px' }}>
              {t.subheading(fmtDate(data.start_date), fmtDate(data.end_date), data.working_days)}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
          <Field label={t.rangeStart} htmlFor="analytics-start">
            <Input
              id="analytics-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label={t.rangeEnd} htmlFor="analytics-end">
            <Input
              id="analytics-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            onClick={() => {
              const range = thisMonthRange()
              setStartDate(range.start)
              setEndDate(range.end)
            }}
          >
            {t.thisMonthBtn}
          </Button>
        </div>
      </div>

      {data && (
        <div
          className="fx-spring-stagger"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
            marginBottom: '14px',
          }}
        >
          <StatCard label={t.statMembers} value={members.length} hint={t.statMembersHint} />
          <StatCard
            label={signalsConfigured ? t.statOfficeDays : t.statCheckins}
            value={signalsConfigured ? totalOfficeDays : totalPresentDays}
            hint={t.statAcrossTeam}
            accent="brand"
          />
          <StatCard label={t.statHours} value={fmtHours(totalHours)} hint={t.statHoursHint} />
          <StatCard label={t.statAvgDays} value={avgAttendance} hint={t.statAvgDaysHint} />
        </div>
      )}

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {!loading && data && !signalsConfigured && (
          <p
            className="t-secondary"
            style={{
              padding: '10px 20px',
              background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {t.noSignalsBanner}
          </p>
        )}

        {loading ? (
          <div className="stack-sm" style={{ padding: '16px 20px' }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={38} radius="var(--radius-sm)" />)}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={members}
            rowKey={(m) => m.user_id}
            minWidth={signalsConfigured ? 900 : 780}
            empty={<EmptyState title={t.emptyTitle} hint={t.emptyHint} />}
          />
        )}
      </Card>

      {members.some((m) => m.multi_location_days > 0) && (
        <p className="t-muted" style={{ marginTop: '10px' }}>{t.multiLocationNote}</p>
      )}
    </section>
  )
}
