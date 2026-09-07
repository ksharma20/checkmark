'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Button, Card, Chip, Field, Input, Skeleton } from '@/components/ui'
import type { BarChartBar } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'

const t = wsAdmin.reports

interface Props {
  slug: string
  timezone: string
  /** From the plan: the XLSX export route 402s when this is false. */
  canExport: boolean
  canReadLeaves: boolean
  canReadMembers: boolean
  canReadAnalytics: boolean
}

// ─── plumbing ────────────────────────────────────────────────────────────────

/** Today in the workspace timezone, as YYYY-MM-DD. */
function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

/** Inclusive day count between two YYYY-MM-DD dates. */
function dayspan(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── API shapes (only the fields these reports read) ─────────────────────────

interface LeaveTypeRow {
  id: string
  name: string
  accrual_frequency: string
  accrual_credits: number
}

interface OpeningBalanceRow {
  user_id: string
  leave_type_id: string
  balance_days: number
  user_email: string
  user_full_name: string | null
  leave_type_name: string
}

interface LeaveRequestRow {
  user_id: string
  leave_type_id: string
  leave_type_name: string
  user_email: string
  user_full_name: string | null
  start_date: string
  end_date: string
  status: string
}

interface MemberRow {
  member_id: string
  email: string
  full_name: string | null
  role: string
  status: string
  added_at: string
}

interface InsightBucketRow {
  label: string
  key: string
  unique_users: number
}

// ─── report cards ────────────────────────────────────────────────────────────

interface ReportCardProps {
  title: string
  body: string
  disabled?: boolean
  action: React.ReactNode
}

function ReportCard({ title, body, disabled = false, action }: ReportCardProps) {
  return (
    <Card className={disabled ? 'report-card disabled' : 'report-card'}>
      <p className="t-eyebrow">{title}</p>
      <p className="t-muted">{body}</p>
      <div style={{ marginTop: 'auto' }}>{action}</div>
    </Card>
  )
}

// ─── reports body ────────────────────────────────────────────────────────────

type Busy = null | 'attendance' | 'leave' | 'headcount'

function ReportsBody({
  slug,
  timezone,
  canExport,
  canReadLeaves,
  canReadMembers,
  canReadAnalytics,
}: Props) {
  const today = useMemo(() => todayIn(timezone), [timezone])
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const [trend, setTrend] = useState<InsightBucketRow[] | null>(null)
  const [trendState, setTrendState] = useState<'loading' | 'ready' | 'denied'>(
    canReadAnalytics ? 'loading' : 'denied',
  )

  useEffect(() => {
    if (!canReadAnalytics) return
    let cancelled = false
    const from = addDays(today, -13)
    fetch(`/api/ws/${slug}/insights?interval=custom&from=${from}&to=${today}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) { setTrendState('denied'); return }
        const data = await res.json()
        setTrend(data.buckets ?? [])
        setTrendState('ready')
      })
      .catch(() => { if (!cancelled) setTrendState('denied') })
    return () => { cancelled = true }
  }, [slug, today, canReadAnalytics])

  /** The XLSX month report. Plan gates arrive as 402 with a machine code. */
  const generateAttendance = useCallback(async () => {
    const [year, monthNo] = month.split('-')
    setBusy('attendance')
    setMessage(null)
    try {
      const res = await fetch(`/api/ws/${slug}/export?year=${year}&month=${Number(monthNo)}`)
      if (res.ok) {
        saveBlob(await res.blob(), `attendance-${slug}-${year}-${monthNo}.xlsx`)
        setMessage({ text: t.exportDone, ok: true })
        return
      }
      if (res.status === 403) { setMessage({ text: t.exportForbidden, ok: false }); return }
      const data = await res.json().catch(() => ({}))
      if (data.code === 'PLAN_GATE') { setMessage({ text: t.planGate, ok: false }); return }
      if (data.code === 'PLAN_HISTORY_GATE') { setMessage({ text: t.planHistoryGate, ok: false }); return }
      setMessage({ text: t.exportFailed, ok: false })
    } catch {
      setMessage({ text: t.exportFailed, ok: false })
    } finally {
      setBusy(null)
    }
  }, [slug, month])

  /**
   * Opening balance, days taken and the remainder, per member and leave type.
   * Assembled client-side from three read endpoints - no new API surface.
   */
  const generateLeave = useCallback(async () => {
    setBusy('leave')
    setMessage(null)
    try {
      const [typesRes, balancesRes, requestsRes] = await Promise.all([
        fetch(`/api/ws/${slug}/leave-types`),
        fetch(`/api/ws/${slug}/leave-balances`),
        fetch(`/api/ws/${slug}/leaves`),
      ])
      if ([typesRes, balancesRes, requestsRes].some((r) => r.status === 403)) {
        setMessage({ text: t.exportForbidden, ok: false })
        return
      }
      if (!typesRes.ok || !balancesRes.ok || !requestsRes.ok) {
        setMessage({ text: t.exportFailed, ok: false })
        return
      }
      const types: LeaveTypeRow[] = (await typesRes.json()).leaveTypes ?? []
      const balances: OpeningBalanceRow[] = (await balancesRes.json()).balances ?? []
      const requests: LeaveRequestRow[] = (await requestsRes.json()).leaveRequests ?? []

      const typeById = new Map(types.map((x) => [x.id, x]))

      interface Row {
        name: string
        email: string
        typeName: string
        typeId: string
        opening: number
        taken: number
      }
      const rows = new Map<string, Row>()
      const keyOf = (userId: string, typeId: string) => `${userId}|${typeId}`

      for (const b of balances) {
        rows.set(keyOf(b.user_id, b.leave_type_id), {
          name: b.user_full_name ?? b.user_email,
          email: b.user_email,
          typeName: b.leave_type_name,
          typeId: b.leave_type_id,
          opening: b.balance_days,
          taken: 0,
        })
      }
      for (const r of requests) {
        if (r.status !== 'approved') continue
        const key = keyOf(r.user_id, r.leave_type_id)
        const existing = rows.get(key) ?? {
          name: r.user_full_name ?? r.user_email,
          email: r.user_email,
          typeName: r.leave_type_name,
          typeId: r.leave_type_id,
          opening: 0,
          taken: 0,
        }
        existing.taken += dayspan(r.start_date, r.end_date)
        rows.set(key, existing)
      }

      const sorted = [...rows.values()].sort(
        (a, b) => a.email.localeCompare(b.email) || a.typeName.localeCompare(b.typeName),
      )
      const csv = toCsv([
        ['Employee', 'Email', 'Leave type', 'Accrual', 'Credits per period', 'Opening balance (days)', 'Days taken', 'Opening minus taken'],
        ...sorted.map((r) => {
          const type = typeById.get(r.typeId)
          return [
            r.name, r.email, r.typeName,
            type?.accrual_frequency ?? '', type?.accrual_credits ?? '',
            r.opening, r.taken, r.opening - r.taken,
          ]
        }),
      ])
      saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `leave-balance-${slug}-${today}.csv`)
      setMessage({ text: t.exportDone, ok: true })
    } catch {
      setMessage({ text: t.exportFailed, ok: false })
    } finally {
      setBusy(null)
    }
  }, [slug, today])

  /** Every member, their role, status and join date. Paged 100 at a time. */
  const generateHeadcount = useCallback(async () => {
    setBusy('headcount')
    setMessage(null)
    try {
      const collected: MemberRow[] = []
      let roleNames: Record<string, string> = {}
      let offset = 0
      let total = Infinity
      while (collected.length < total) {
        const res = await fetch(`/api/ws/${slug}/members?limit=100&offset=${offset}`)
        if (res.status === 403) { setMessage({ text: t.exportForbidden, ok: false }); return }
        if (!res.ok) { setMessage({ text: t.exportFailed, ok: false }); return }
        const data = await res.json()
        const page: MemberRow[] = data.members ?? []
        roleNames = data.roleNames ?? roleNames
        total = data.total ?? page.length
        collected.push(...page)
        offset += 100
        if (page.length === 0) break
      }

      const csv = toCsv([
        ['Name', 'Email', 'Role', 'Status', 'Joined'],
        ...collected.map((m) => [
          m.full_name ?? m.email,
          m.email,
          roleNames[m.role] ?? m.role,
          m.status,
          m.added_at.slice(0, 10),
        ]),
      ])
      saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `headcount-${slug}-${today}.csv`)
      setMessage({ text: t.exportDone, ok: true })
    } catch {
      setMessage({ text: t.exportFailed, ok: false })
    } finally {
      setBusy(null)
    }
  }, [slug, today])

  const bars: BarChartBar[] = (trend ?? []).map((b) => ({
    label: b.label,
    value: b.unique_users,
    muted: b.unique_users === 0,
  }))

  return (
    <>
      <p className="t-secondary" style={{ margin: '14px 0 16px' }}>{t.exportIntro}</p>

      <Card style={{ marginBottom: '14px' }}>
        <Field label={t.monthLabel} htmlFor={t.monthFieldId} style={{ maxWidth: '220px' }}>
          <Input
            id={t.monthFieldId}
            type="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => setMonth(e.target.value)}
          />
        </Field>
      </Card>

      <div
        className="fx-spring-stagger"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}
      >
        <ReportCard
          title={t.attendanceTitle}
          body={t.attendanceBody}
          disabled={!canExport}
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={!canExport || busy !== null}
              loading={busy === 'attendance'}
              onClick={generateAttendance}
            >
              {busy === 'attendance' ? t.generatingBtn : t.generateBtn}
            </Button>
          }
        />
        <ReportCard
          title={t.leaveTitle}
          body={t.leaveBody}
          disabled={!canReadLeaves}
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={!canReadLeaves || busy !== null}
              loading={busy === 'leave'}
              onClick={generateLeave}
            >
              {busy === 'leave' ? t.generatingBtn : t.generateBtn}
            </Button>
          }
        />
        <ReportCard
          title={t.headcountTitle}
          body={t.headcountBody}
          disabled={!canReadMembers}
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={!canReadMembers || busy !== null}
              loading={busy === 'headcount'}
              onClick={generateHeadcount}
            >
              {busy === 'headcount' ? t.generatingBtn : t.generateBtn}
            </Button>
          }
        />
        <ReportCard
          title={t.expenseTitle}
          body={t.expenseBody}
          disabled
          action={<Chip tone="roadmap">{t.comingSoon}</Chip>}
        />
      </div>

      {!canExport && (
        <p className="t-muted" style={{ marginTop: '12px' }}>
          {t.planGate}{' '}
          <Link href="/pricing" style={{ color: 'var(--brand)', fontWeight: 600 }}>
            {t.viewPricing}
          </Link>
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: message.ok ? 'var(--brand)' : 'var(--danger)',
          }}
        >
          {message.text}
        </p>
      )}

      <Card className="fx-spring" style={{ marginTop: '16px' }}>
        <p className="t-eyebrow">{t.trendTitle}</p>
        <div style={{ marginTop: '14px' }}>
          {trendState === 'loading' ? (
            <Skeleton height={150} radius="var(--radius-md)" />
          ) : trendState === 'denied' ? (
            <p className="t-muted">{t.trendUnavailable}</p>
          ) : bars.length === 0 ? (
            <p className="t-muted">{t.trendEmpty}</p>
          ) : (
            <BarChart
              bars={bars}
              height={150}
              label={t.trendAria}
              formatTitle={(bar) => t.trendTitleFor(bar.label, bar.value)}
            />
          )}
        </div>
        <p className="t-muted" style={{ marginTop: '10px' }}>{t.trendHint}</p>
      </Card>
    </>
  )
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function ReportsClient(props: Props) {
  return (
    <>
      <h1 className="t-h1 fx-snap">{t.pageTitle}</h1>
      <ReportsBody {...props} />
    </>
  )
}
