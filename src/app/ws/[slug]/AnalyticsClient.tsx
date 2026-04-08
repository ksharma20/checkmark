'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AnalyticsMember, AnalyticsResponse } from '@/app/api/ws/[slug]/analytics/route'
import { fmtHours } from '@/lib/client/format-time'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const skeletonStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: '6px',
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ ...skeletonStyle, width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: '0 0 140px' }}>
        <div style={{ ...skeletonStyle, height: '12px', width: '100px', marginBottom: '6px' }} />
        <div style={{ ...skeletonStyle, height: '10px', width: '130px' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ ...skeletonStyle, height: '6px', borderRadius: '3px', marginBottom: '4px' }} />
        <div style={{ ...skeletonStyle, height: '6px', borderRadius: '3px', width: '60%' }} />
      </div>
      <div style={{ ...skeletonStyle, width: '44px', height: '14px', marginLeft: 'auto' }} />
    </div>
  )
}

interface Props {
  slug: string
}

function getThisMonthRange(): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
}

function StatChip({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      flex: '1 1 120px',
      minWidth: '100px',
    }}>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function DayBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)', minWidth: '20px', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'DM Sans, sans-serif',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

function MemberCard({ m, workingDays, signalsConfigured }: { m: AnalyticsMember; workingDays: number; signalsConfigured: boolean }) {
  const initials = m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      {/* Row 1: avatar + name/email + hours */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
          color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.name}
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.email}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
            {fmtHours(m.total_hours)}
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>
            {fmtHours(m.avg_daily_hours)} avg
          </div>
        </div>
      </div>
      {/* Row 2: bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {signalsConfigured ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...labelStyle, width: '50px', flexShrink: 0 }}>Office</span>
              <DayBar value={m.office_days} max={workingDays} color="var(--teal)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...labelStyle, width: '50px', flexShrink: 0 }}>Remote</span>
              <DayBar value={m.wfh_days} max={workingDays} color="var(--amber)" />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...labelStyle, width: '50px', flexShrink: 0 }}>Present</span>
            <DayBar value={m.office_days + m.wfh_days} max={workingDays} color="var(--brand)" />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...labelStyle, width: '50px', flexShrink: 0 }}>Absent</span>
          <DayBar value={m.absent_days} max={workingDays} color="var(--danger)" />
        </div>
      </div>
      {m.multi_location_days > 0 && (
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '10px', color: 'var(--amber)', marginTop: '6px' }}>
          {m.multi_location_days} multi-location days
        </p>
      )}
    </div>
  )
}

function MemberRow({ m, workingDays, signalsConfigured }: { m: AnalyticsMember; workingDays: number; signalsConfigured: boolean }) {
  const initials = m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: signalsConfigured
        ? '200px 1fr 1fr 1fr 90px 90px'
        : '200px 1fr 1fr 90px',
      gap: '16px',
      alignItems: 'center',
      padding: '14px 16px',
      borderBottom: '1px solid var(--border)',
      minWidth: signalsConfigured ? '720px' : '520px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
          color: 'var(--brand)', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.name}
          </div>
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.email}
          </div>
        </div>
      </div>

      {signalsConfigured && (
        <div>
          <DayBar value={m.office_days} max={workingDays} color="var(--teal)" />
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>office</p>
        </div>
      )}

      {signalsConfigured ? (
        <div>
          <DayBar value={m.wfh_days} max={workingDays} color="var(--amber)" />
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>remote</p>
        </div>
      ) : (
        <div>
          <DayBar value={m.office_days + m.wfh_days} max={workingDays} color="var(--brand)" />
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>present</p>
        </div>
      )}

      <div>
        <DayBar value={m.absent_days} max={workingDays} color="var(--danger)" />
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>absent</p>
      </div>

      <div style={{ textAlign: 'right' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
          {fmtHours(m.total_hours)}
        </p>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>total</p>
      </div>

      <div style={{ textAlign: 'right' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
          {fmtHours(m.avg_daily_hours)}
        </p>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)' }}>avg/day</p>
        {m.multi_location_days > 0 && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '10px', color: 'var(--amber)', marginTop: '2px' }}>
            {m.multi_location_days} multi-loc
          </p>
        )}
      </div>
    </div>
  )
}

function TableHeader({ signalsConfigured }: { signalsConfigured: boolean }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: signalsConfigured
        ? '200px 1fr 1fr 1fr 90px 90px'
        : '200px 1fr 1fr 90px',
      gap: '16px',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      minWidth: signalsConfigured ? '720px' : '520px',
    }}>
      <p style={labelStyle}>Member</p>
      {signalsConfigured && <p style={labelStyle}>Office</p>}
      <p style={labelStyle}>{signalsConfigured ? 'Remote' : 'Present'}</p>
      <p style={labelStyle}>Absent</p>
      <p style={{ ...labelStyle, textAlign: 'right' }}>Total hrs</p>
      <p style={{ ...labelStyle, textAlign: 'right' }}>Avg/day</p>
    </div>
  )
}

export default function AnalyticsClient({ slug }: Props) {
  const defaultRange = getThisMonthRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    function check() { setIsNarrow(window.innerWidth < 640) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchAnalytics = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/analytics?start=${start}&end=${end}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchAnalytics(startDate, endDate)
  }, [fetchAnalytics, startDate, endDate])

  function setThisMonth() {
    const r = getThisMonthRange()
    setStartDate(r.start)
    setEndDate(r.end)
  }

  const totalOfficeDays = data?.members.reduce((s, m) => s + m.office_days, 0) ?? 0
  const totalHours = data?.members.reduce((s, m) => s + m.total_hours, 0) ?? 0
  const avgAttendance = data?.members.length
    ? Math.round((data.members.reduce((s, m) => s + m.office_days + m.wfh_days, 0) / data.members.length) * 10) / 10
    : 0

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
            Analytics
          </h2>
          {data && (
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {fmtDate(data.start_date)} – {fmtDate(data.end_date)} · {data.working_days} working days
            </p>
          )}
        </div>

        {/* Date range picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              height: '36px', padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              height: '36px', padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={setThisMonth}
            style={{
              height: '36px', padding: '0 12px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-2)', color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            This month
          </button>
        </div>
      </div>

      {/* Summary chips */}
      {data && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <StatChip label="Members" value={data.members.length} sub="in workspace" />
          {data.signals_configured ? (
            <StatChip label="Office days" value={totalOfficeDays} sub="total across team" />
          ) : (
            <StatChip label="Check-ins" value={data.members.reduce((s, m) => s + m.office_days + m.wfh_days, 0)} sub="total across team" />
          )}
          <StatChip label="Hours tracked" value={fmtHours(totalHours)} sub="total logged" />
          <StatChip label="Avg days" value={avgAttendance} sub="attended per person" />
        </div>
      )}

      {/* Member table */}
      {loading ? (
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : !data || data.members.length === 0 ? (
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            No presence data for this period.
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>
            Members will appear here as they check in.
          </p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: isNarrow ? 'visible' : 'auto' }}>
          {!data.signals_configured && (
            <div style={{
              padding: '10px 16px',
              background: 'color-mix(in srgb, var(--amber) 8%, transparent)',
              borderBottom: '1px solid var(--border)',
              fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)',
            }}>
              No location signals configured — all check-ins are shown. Configure GPS/WiFi signals in Settings to distinguish office vs remote days.
            </div>
          )}
          {isNarrow ? (
            data.members.map((m) => (
              <MemberCard
                key={m.user_id}
                m={m}
                workingDays={data.working_days}
                signalsConfigured={data.signals_configured}
              />
            ))
          ) : (
            <>
              <TableHeader signalsConfigured={data.signals_configured} />
              {data.members.map((m) => (
                <MemberRow
                  key={m.user_id}
                  m={m}
                  workingDays={data.working_days}
                  signalsConfigured={data.signals_configured}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Field force note */}
      {data && data.members.some((m) => m.multi_location_days > 0) && (
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Multi-loc: days where checkout was recorded more than 1km from check-in location (field force / site visits).
        </p>
      )}
    </div>
  )
}
