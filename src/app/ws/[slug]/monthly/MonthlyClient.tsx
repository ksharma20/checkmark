'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Card, EmptyState, IconButton, Skeleton } from '@/components/ui'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { wsAdmin } from '@/locales/en/ws-settings'
import type { MemberMonthRow, MonthlyResponse, DayStatus } from '@/app/api/ws/[slug]/monthly/route'

const t = wsAdmin.monthly

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * The class list for one day cell.
 *
 * `remote` collapses onto the office paint when the workspace has no signals
 * configured: with nothing to match against, "remote" is not a distinction the
 * data can actually make. The colours themselves live in `globals.css` under
 * `.mcal-cell` - they used to be inline style objects here, which put them
 * outside every selector list that file uses to enforce the design rules.
 */
function cellClass(status: DayStatus, signalsConfigured: boolean): string {
  const parts = ['mcal-cell']
  if (status !== 'future') parts.push(`is-${status}`)
  if (status === 'remote' && !signalsConfigured) parts.push('is-unconfigured')
  return parts.join(' ')
}

const STATUS_LABEL: Record<DayStatus, string> = {
  office: t.legendOffice,
  remote: t.legendRemote,
  absent: t.legendAbsent,
  leave: t.legendLeave,
  holiday: t.legendHoliday,
  future: '',
}

/** The swatch renders the grid's own class, so legend and cell cannot drift. */
function LegendItem({ cellClassName, label }: { cellClassName: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span aria-hidden className={`${cellClassName} mcal-swatch`} />
      <span className="t-muted">{label}</span>
    </span>
  )
}

interface CellProps {
  day: number
  dateStr: string
  status: DayStatus | undefined
  signalsConfigured: boolean
  joinedDate: string
  offDays: number[]
}

function CalendarCell({ day, dateStr, status, signalsConfigured, joinedDate, offDays }: CellProps) {
  // Noon UTC, so the weekday never rolls over for a viewer west of UTC.
  const isWeekend = offDays.includes(new Date(`${dateStr}T12:00:00Z`).getUTCDay())

  if (dateStr < joinedDate) {
    return <div className="mcal-cell is-prejoin" title={t.cellPreJoin(dateStr)}>{day}</div>
  }

  if (isWeekend) {
    return (
      <div className="mcal-cell is-weekend" title={t.cellStatus(dateStr, t.legendWeekend)}>{day}</div>
    )
  }

  const resolved: DayStatus = status ?? 'absent'
  return (
    <div
      className={cellClass(resolved, signalsConfigured)}
      title={t.cellStatus(dateStr, STATUS_LABEL[resolved] || t.legendAbsent)}
    >
      {day}
    </div>
  )
}

function MemberRow({
  member, daysInMonth, year, month, signalsConfigured, offDays,
}: {
  member: MemberMonthRow
  daysInMonth: number
  year: number
  month: number
  signalsConfigured: boolean
  offDays: number[]
}) {
  const monthStr = String(month).padStart(2, '0')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 20px',
        borderTop: '1px solid var(--border)',
        minWidth: 'max-content',
      }}
    >
      <div className="mcal-name">
        <Avatar name={member.name} size={30} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.name}
          </div>
          <div className="mono t-muted" style={{ fontSize: '10px' }}>
            {member.office_days}d
            {signalsConfigured && member.remote_days > 0 ? ` / ${member.remote_days}r` : ''}
            {member.absent_days > 0 ? ` / ${member.absent_days}a` : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${daysInMonth}, 22px)`, gap: '2px' }}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`
          return (
            <CalendarCell
              key={dateStr}
              day={day}
              dateStr={dateStr}
              status={member.days[dateStr]}
              signalsConfigured={signalsConfigured}
              joinedDate={member.joined_date}
              offDays={offDays}
            />
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  slug: string
  tz: string
  canExport: boolean
  historyMonths: number | null
}

export default function MonthlyClient({ slug, tz, canExport, historyMonths }: Props) {
  // "Now" is the workspace's now, not the viewer's: an admin in London must not
  // be able to page into a month that has not started in Kolkata yet.
  const [todayYear, todayMonth] = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number)

  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)
  const [data, setData] = useState<MonthlyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [planGated, setPlanGated] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchMonthly = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setPlanGated(false)
    try {
      const res = await fetch(`/api/ws/${slug}/monthly?year=${y}&month=${m}`)
      if (res.status === 402) setPlanGated(true)
      else if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchMonthly(year, month) }, [fetchMonthly, year, month])

  const isCurrentMonth = year === todayYear && month === todayMonth
  const isFutureMonth = year > todayYear || (year === todayYear && month >= todayMonth)
  const isAtHistoryLimit = (() => {
    if (historyMonths === null) return false
    const limit = new Date()
    limit.setMonth(limit.getMonth() - historyMonths)
    return new Date(year, month - 2, 1) <= limit
  })()

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12) } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (isFutureMonth) return
    if (month === 12) { setYear((y) => y + 1); setMonth(1) } else setMonth((m) => m + 1)
  }

  async function handleExport() {
    if (!canExport) return
    setExporting(true)
    try {
      const res = await fetch(`/api/ws/${slug}/export?year=${year}&month=${month}`)
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob())
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance-${slug}-${year}-${String(month).padStart(2, '0')}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  const signalsConfigured = !!data?.signals_configured

  return (
    <div>
      {/* Month stepper */}
      <div className="row-between fx-snap" style={{ flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconButton
            variant="plain"
            label={t.prevMonth}
            icon={<ChevronLeft size={16} />}
            disabled={isAtHistoryLimit}
            onClick={prevMonth}
          />
          <span className="t-h2" style={{ minWidth: '150px', textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <IconButton
            variant="plain"
            label={t.nextMonth}
            icon={<ChevronRight size={16} />}
            disabled={isFutureMonth}
            onClick={nextMonth}
          />
          {!isCurrentMonth && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setYear(todayYear); setMonth(todayMonth) }}
            >
              {t.todayBtn}
            </Button>
          )}
        </div>

        {canExport && (
          <Button
            size="sm"
            icon={<Download size={14} />}
            loading={exporting}
            disabled={!data}
            onClick={handleExport}
          >
            {exporting ? t.exportingBtn : t.exportBtn}
          </Button>
        )}
      </div>

      {/* Legend */}
      {data && (
        <div className="row-between" style={{ flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <LegendItem
              cellClassName={cellClass('office', signalsConfigured)}
              label={signalsConfigured ? t.legendOffice : t.legendPresent}
            />
            {signalsConfigured && (
              <LegendItem cellClassName={cellClass('remote', true)} label={t.legendRemote} />
            )}
            <LegendItem cellClassName={cellClass('absent', signalsConfigured)} label={t.legendAbsent} />
            <LegendItem cellClassName={cellClass('leave', signalsConfigured)} label={t.legendLeave} />
            <LegendItem cellClassName={cellClass('holiday', signalsConfigured)} label={t.legendHoliday} />
            <LegendItem cellClassName="mcal-cell is-weekend" label={t.legendWeekend} />
          </div>
          <span className="t-muted">{t.workingDays(data.working_days)}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="stack-sm">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} radius="var(--radius-md)" />)}
        </div>
      ) : planGated ? (
        <Card>
          <EmptyState title={t.planGatedTitle} hint={t.planGatedHint} />
        </Card>
      ) : !data || data.members.length === 0 ? (
        <Card>
          <EmptyState title={t.emptyTitle} hint={t.emptyHint} />
        </Card>
      ) : (
        <Card className="fx-spring" padded={false} style={{ overflowX: 'auto' }}>
          {!signalsConfigured && (
            <p
              className="t-secondary"
              style={{
                padding: '10px 20px',
                background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
              }}
            >
              {t.noSignalsBanner}
            </p>
          )}
          {data.members.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              daysInMonth={data.days_in_month}
              year={year}
              month={month}
              signalsConfigured={signalsConfigured}
              offDays={data.off_days}
            />
          ))}
        </Card>
      )}
    </div>
  )
}
