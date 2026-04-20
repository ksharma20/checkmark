'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MonthlyResponse, DayStatus, MemberMonthRow } from '@/app/api/ws/[slug]/monthly/route'

const skeletonStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: '4px',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]


function dayColor(status: DayStatus, signalsConfigured: boolean): string {
  if (status === 'future') return 'transparent'
  if (status === 'absent') return 'color-mix(in srgb, var(--danger) 15%, transparent)'
  if (status === 'office') return 'color-mix(in srgb, var(--teal) 25%, transparent)'
  if (status === 'remote') return signalsConfigured
    ? 'color-mix(in srgb, var(--amber) 25%, transparent)'
    : 'color-mix(in srgb, var(--teal) 25%, transparent)'
  return 'transparent'
}

function dayBorder(status: DayStatus, signalsConfigured: boolean): string {
  if (status === 'future') return 'transparent'
  if (status === 'absent') return 'color-mix(in srgb, var(--danger) 35%, transparent)'
  if (status === 'office') return 'color-mix(in srgb, var(--teal) 50%, transparent)'
  if (status === 'remote') return signalsConfigured
    ? 'color-mix(in srgb, var(--amber) 50%, transparent)'
    : 'color-mix(in srgb, var(--teal) 50%, transparent)'
  return 'transparent'
}


interface CalendarCellProps {
  day: number
  dateStr: string
  status: DayStatus | undefined
  signalsConfigured: boolean
}

function CalendarCell({ day, dateStr, status, signalsConfigured }: CalendarCellProps) {
  const isWeekend = (() => {
    const dow = new Date(dateStr + 'T12:00:00Z').getUTCDay()
    return dow === 0 || dow === 6
  })()

  if (isWeekend) {
    return (
      <div style={{
        width: '28px', height: '28px', borderRadius: '4px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.4,
      }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: 'var(--text-muted)' }}>
          {day}
        </span>
      </div>
    )
  }

  const s = status ?? 'absent'

  return (
    <div
      title={`${dateStr}: ${s}`}
      style={{
        width: '28px', height: '28px', borderRadius: '4px',
        background: dayColor(s, signalsConfigured),
        border: `1px solid ${dayBorder(s, signalsConfigured)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
        color: s === 'future' ? 'var(--text-muted)' : 'var(--text-primary)',
        fontWeight: s === 'office' ? 600 : 400,
      }}>
        {day}
      </span>
    </div>
  )
}

interface MemberRowProps {
  member: MemberMonthRow
  daysInMonth: number
  year: number
  month: number
  signalsConfigured: boolean
}

function MemberRow({ member, daysInMonth, year, month, signalsConfigured }: MemberRowProps) {
  const ini = member.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const monthStr = String(month).padStart(2, '0')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px', borderBottom: '1px solid var(--border)',
      minWidth: 'max-content',
    }}>
      {/* Avatar + name */}
      <div style={{ width: '160px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
          background: 'color-mix(in srgb, var(--brand) 12%, transparent)',
          color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ini}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500,
            color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {member.name}
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: 'var(--text-muted)',
          }}>
            {member.office_days}d{signalsConfigured && member.remote_days > 0 ? ` / ${member.remote_days}r` : ''}
            {member.absent_days > 0 && ` / ${member.absent_days}a`}
          </div>
        </div>
      </div>

      {/* Day cells */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1
          const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`
          const status = member.days[dateStr]
          return (
            <CalendarCell
              key={dateStr}
              day={d}
              dateStr={dateStr}
              status={status}
              signalsConfigured={signalsConfigured}
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

export default function MonthlyClient({ slug, tz: _tz, canExport, historyMonths }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<MonthlyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [planGated, setPlanGated] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchMonthly = useCallback(async (y: number, m: number) => {
    setLoading(true)
    setPlanGated(false)
    try {
      const res = await fetch(`/api/ws/${slug}/monthly?year=${y}&month=${m}`)
      if (res.status === 402) {
        setPlanGated(true)
      } else if (res.ok) {
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchMonthly(year, month) }, [fetchMonthly, year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    const futureCheck = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)
    if (futureCheck > now) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const isFutureMonth = (() => {
    const next = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1)
    return next > now
  })()

  const isAtHistoryLimit = (() => {
    if (historyMonths === null) return false
    const limit = new Date()
    limit.setMonth(limit.getMonth() - historyMonths)
    const current = new Date(year, month - 2, 1)
    return current <= limit
  })()

  async function handleExport() {
    if (!canExport) return
    setExporting(true)
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(data?.days_in_month ?? 31).padStart(2, '0')}`
      const res = await fetch(`/api/ws/${slug}/export?start=${startDate}&end=${endDate}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `checkmark-${slug}-${year}-${String(month).padStart(2, '0')}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            disabled={isAtHistoryLimit}
            onClick={prevMonth}
            style={{
              width: '32px', height: '32px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--surface-0)',
              cursor: isAtHistoryLimit ? 'default' : 'pointer', opacity: isAtHistoryLimit ? 0.4 : 1,
              fontFamily: 'DM Sans, sans-serif', fontSize: '16px', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <span style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px',
            color: 'var(--navy)', minWidth: '160px', textAlign: 'center',
          }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            disabled={isFutureMonth}
            onClick={nextMonth}
            style={{
              width: '32px', height: '32px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--surface-0)',
              cursor: isFutureMonth ? 'default' : 'pointer', opacity: isFutureMonth ? 0.4 : 1,
              fontFamily: 'DM Sans, sans-serif', fontSize: '16px', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
              style={{
                height: '32px', padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)', color: 'var(--text-secondary)',
                fontFamily: 'DM Sans, sans-serif', fontSize: '12px', cursor: 'pointer',
              }}
            >
              Today
            </button>
          )}
        </div>

        {canExport && (
          <button
            type="button"
            disabled={exporting || !data}
            onClick={handleExport}
            style={{
              height: '32px', padding: '0 14px',
              border: '1px solid var(--brand)', borderRadius: 'var(--radius-sm)',
              background: 'transparent', color: 'var(--brand)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: (exporting || !data) ? 'default' : 'pointer',
              opacity: (exporting || !data) ? 0.5 : 1,
              marginLeft: 'auto',
            }}
          >
            {exporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
        )}
      </div>

      {/* Legend */}
      {data && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <LegendItem color="color-mix(in srgb, var(--teal) 25%, transparent)" border="color-mix(in srgb, var(--teal) 50%, transparent)" label={data.signals_configured ? 'Office' : 'Present'} />
          {data.signals_configured && (
            <LegendItem color="color-mix(in srgb, var(--amber) 25%, transparent)" border="color-mix(in srgb, var(--amber) 50%, transparent)" label="Remote" />
          )}
          <LegendItem color="color-mix(in srgb, var(--danger) 15%, transparent)" border="color-mix(in srgb, var(--danger) 35%, transparent)" label="Absent" />
          <LegendItem color="var(--surface-2)" border="var(--border)" label="Weekend" />
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {data.working_days} working days
          </span>
        </div>
      )}


      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ...skeletonStyle, height: '48px', borderRadius: 'var(--radius-sm)' }} />
          ))}
        </div>
      ) : planGated ? (
        <div style={{
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
            This month is outside your plan&apos;s history window.
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Upgrade to access more history.
          </p>
        </div>
      ) : !data || data.members.length === 0 ? (
        <div style={{
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '40px 24px', textAlign: 'center',
        }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
            No active members to display.
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto',
        }}>
          {!data.signals_configured && (
            <div style={{
              padding: '10px 16px', background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
              borderBottom: '1px solid var(--border)',
              fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)',
            }}>
              No location signals configured — all check-ins counted as present. Configure GPS/WiFi signals in Settings to distinguish office vs remote.
            </div>
          )}
          {data.members.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              daysInMonth={data.days_in_month}
              year={year}
              month={month}
              signalsConfigured={data.signals_configured}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '14px', height: '14px', borderRadius: '3px',
        background: color, border: `1px solid ${border}`,
      }} />
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
  )
}
