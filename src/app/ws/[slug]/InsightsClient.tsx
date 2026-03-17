'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InsightInterval, InsightBucket, InsightsResponse } from '@/app/api/ws/[slug]/insights/route'

interface Props { slug: string }

const INTERVALS: { key: InsightInterval; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'Week' },
  { key: 'month',   label: 'Month' },
  { key: '3month',  label: '3 Months' },
  { key: '6month',  label: '6 Months' },
  { key: 'year',    label: 'Year' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const skBase: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: '6px',
}

function InsightsSkeleton() {
  return (
    <div>
      {/* Stat card skeletons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[120, 100, 110, 100, 90].map((w, i) => (
          <div key={i} style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px', flex: '1 1 120px' }}>
            <div style={{ ...skBase, height: '10px', width: '60px', marginBottom: '10px' }} />
            <div style={{ ...skBase, height: '24px', width: `${w - 30}px`, marginBottom: '6px' }} />
            <div style={{ ...skBase, height: '9px', width: `${w}px` }} />
          </div>
        ))}
      </div>
      {/* Chart skeleton */}
      {[1, 2].map((i) => (
        <div key={i} style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
          <div style={{ ...skBase, height: '10px', width: '100px', marginBottom: '16px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '140px' }}>
            {Array.from({ length: 20 }, (_, j) => (
              <div key={j} style={{
                ...skBase,
                flex: 1,
                height: `${30 + Math.abs(Math.sin(j * 1.3) * 100)}px`,
                borderRadius: '4px 4px 0 0',
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SVG Bar Chart ─────────────────────────────────────────────────────────────

interface BarChartProps {
  buckets: InsightBucket[]
  valueKey: 'unique_users' | 'total_hours'
  color: string
  label: string
  totalMembers: number
}

function BarChart({ buckets, valueKey, color, label, totalMembers }: BarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...buckets.map((b) => b[valueKey]), 1)
  const chartH = 140
  const barW = Math.max(4, Math.min(32, Math.floor(600 / buckets.length) - 3))
  const gap = Math.max(2, Math.floor(600 / buckets.length) - barW)
  const totalW = buckets.length * (barW + gap) - gap

  return (
    <div>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
        {label}
      </p>
      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <svg
          width={totalW + 2}
          height={chartH + 40}
          style={{ display: 'block', minWidth: '100%' }}
          viewBox={`0 0 ${totalW + 2} ${chartH + 40}`}
          preserveAspectRatio="none"
        >
          {/* Y-axis guide lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
            <line
              key={frac}
              x1={0} y1={chartH - frac * chartH}
              x2={totalW} y2={chartH - frac * chartH}
              stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3,3"
            />
          ))}

          {buckets.map((b, i) => {
            const val = b[valueKey]
            const barH = max > 0 ? Math.max(val > 0 ? 3 : 0, Math.round((val / max) * chartH)) : 0
            const x = i * (barW + gap)
            const isHovered = hovered === i
            const fillColor = val === 0 ? 'var(--surface-2)' : isHovered ? 'var(--brand)' : color

            return (
              <g key={b.key} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {/* Bar */}
                <rect
                  x={x} y={chartH - barH}
                  width={barW} height={barH}
                  fill={fillColor}
                  rx={Math.min(3, barW / 4)}
                  style={{ transition: 'fill 0.15s' }}
                />

                {/* Hover tooltip */}
                {isHovered && val > 0 && (
                  <g>
                    <rect
                      x={Math.min(x + barW / 2 - 30, totalW - 62)}
                      y={chartH - barH - 28}
                      width={60} height={22}
                      rx={4}
                      fill="var(--navy)"
                    />
                    <text
                      x={Math.min(x + barW / 2, totalW - 32) + 0}
                      y={chartH - barH - 13}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={10}
                      fontFamily="DM Sans, sans-serif"
                    >
                      {valueKey === 'unique_users'
                        ? `${val}/${totalMembers}`
                        : `${val}h`}
                    </text>
                  </g>
                )}

                {/* X-axis label — skip some for dense charts */}
                {(buckets.length <= 14 || i % Math.ceil(buckets.length / 12) === 0) && (
                  <text
                    x={x + barW / 2}
                    y={chartH + 16}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={9}
                    fontFamily="DM Sans, sans-serif"
                  >
                    {b.label.length > 6 ? b.label.slice(0, 6) : b.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 18px',
      flex: '1 1 120px',
    }}>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, color: color ?? 'var(--navy)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function InsightsClient({ slug }: Props) {
  const [interval, setInterval] = useState<InsightInterval>('month')
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (iv: InsightInterval) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/insights?interval=${iv}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { fetchData(interval) }, [fetchData, interval])

  // Derived stats
  const totalCheckins = data?.buckets.reduce((s, b) => s + b.total_checkins, 0) ?? 0
  const totalHours = data?.buckets.reduce((s, b) => s + b.total_hours, 0) ?? 0
  const peakBucket = data?.buckets.find((b) => b.key === data.peak_bucket)
  const presentBuckets = data?.buckets.filter((b) => b.unique_users > 0).length ?? 0

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', margin: 0 }}>
          Insights
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Attendance patterns and trends
        </p>
      </div>

      {/* Interval selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {INTERVALS.map((iv) => (
          <button
            key={iv.key}
            type="button"
            onClick={() => setInterval(iv.key)}
            style={{
              height: '34px', padding: '0 14px',
              background: interval === iv.key ? 'var(--brand)' : 'var(--surface-0)',
              color: interval === iv.key ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${interval === iv.key ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif', fontWeight: interval === iv.key ? 600 : 400,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {loading ? (
        <InsightsSkeleton />
      ) : !data || data.buckets.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No check-in data for this period.</p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>Charts will appear as your team checks in.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <StatCard
              label="Total members"
              value={data.total_members}
              sub="in workspace"
            />
            <StatCard
              label="Avg attendance"
              value={data.avg_daily_users}
              sub={`people per ${interval === 'today' ? 'hour' : 'day'}`}
              color="var(--teal)"
            />
            <StatCard
              label="Check-ins"
              value={totalCheckins}
              sub={`over ${presentBuckets} active ${interval === 'today' ? 'hours' : 'days'}`}
            />
            <StatCard
              label="Hours logged"
              value={`${Math.round(totalHours * 10) / 10}h`}
              sub="total tracked"
              color="var(--brand)"
            />
            {peakBucket && (
              <StatCard
                label="Peak"
                value={`${peakBucket.label}`}
                sub={`${peakBucket.unique_users}/${data.total_members} people`}
                color="var(--amber)"
              />
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Attendance chart */}
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <BarChart
                buckets={data.buckets}
                valueKey="unique_users"
                color="var(--teal)"
                label="People in office"
                totalMembers={data.total_members}
              />
            </div>

            {/* Hours chart */}
            <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <BarChart
                buckets={data.buckets}
                valueKey="total_hours"
                color="var(--brand)"
                label="Hours logged"
                totalMembers={data.total_members}
              />
            </div>

            {/* Attendance % by bucket */}
            {data.total_members > 0 && (
              <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
                  Attendance rate
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {data.buckets
                    .filter((b) => b.unique_users > 0)
                    .sort((a, b) => b.unique_users - a.unique_users)
                    .slice(0, 8)
                    .map((b) => {
                      const pct = Math.round((b.unique_users / data.total_members) * 100)
                      return (
                        <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', minWidth: '60px', flexShrink: 0 }}>
                            {b.label}
                          </span>
                          <div style={{ flex: 1, height: '10px', background: 'var(--surface-2)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: pct >= 80 ? 'var(--teal)' : pct >= 50 ? 'var(--brand)' : 'var(--amber)',
                              borderRadius: '5px',
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)', minWidth: '40px', textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
