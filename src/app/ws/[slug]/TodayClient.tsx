'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { DashboardMember, DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { InsightsResponse, InsightBucket } from '@/app/api/ws/[slug]/insights/route'
import type { RealtimeResponse } from '@/app/api/ws/[slug]/realtime/route'
import type { OverviewWidgetsResponse } from '@/app/api/ws/[slug]/overview/route'
import type { ApprovalItem } from '@/lib/approvals'
import { resolvePresenceTag, PRESENCE_TAG_CONFIG } from '@/lib/client/presence'
import { en } from '@/locales/en'
import { Users, Monitor, Home, Activity } from 'lucide-react'

interface Props {
  slug: string
  planLimitBanner?: React.ReactNode
  adminFirstName: string
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(s: string): string {
  const parts = s.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ member }: { member: DashboardMember }) {
  const hasTrust = (member.latest_event?.trust_flags?.length ?? 0) > 0
  if (hasTrust) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px',
        borderRadius: '5px', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
        background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
        color: 'var(--danger)', letterSpacing: '0.04em',
        border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
      }}>
        SUSPICIOUS
      </span>
    )
  }
  const tag = resolvePresenceTag(member.presence_status, member.latest_event?.matched_by, member.latest_event?.event_type)
  const { label, color } = PRESENCE_TAG_CONFIG[tag]
  const isMuted = tag === 'not_in'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 9px',
      borderRadius: '5px', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 700,
      background: isMuted ? 'var(--surface-2)' : `color-mix(in srgb, ${color} 12%, transparent)`,
      color, letterSpacing: '0.04em',
      border: isMuted ? 'none' : `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      {label.toUpperCase()}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, accent, icon, critical, onClick, className,
}: {
  title: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: boolean
  critical?: boolean
  icon: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const borderColor = critical ? 'var(--danger)' : accent ? 'var(--brand)' : 'var(--border)'
  const iconBg = critical
    ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
    : accent
    ? 'color-mix(in srgb, var(--brand) 12%, transparent)'
    : 'var(--surface-2)'
  const iconColor = critical ? 'var(--danger)' : accent ? 'var(--brand)' : 'var(--text-muted)'

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderTop: `3px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        flex: '1 1 0',
        minWidth: '140px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--brand) 15%, transparent)' } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.boxShadow = '' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700,
          color: critical ? 'var(--danger)' : 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {title}
        </span>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontSize: '28px', fontWeight: 700, lineHeight: 1,
          color: critical ? 'var(--danger)' : accent ? 'var(--brand)' : 'var(--navy)',
        }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Members Modal (HEAD) ─────────────────────────────────────────────────────

function MembersModal({
  title, members, slug, onClose,
}: {
  title: string
  members: DashboardMember[]
  slug: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-0)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          width: '100%', maxWidth: '480px',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '15px', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0,
          }}>
            {title}
            <span style={{
              marginLeft: '8px', fontFamily: 'DM Sans, sans-serif',
              fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)',
            }}>
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '28px', height: '28px', borderRadius: '6px',
              border: '1px solid var(--border)', background: 'var(--surface-1)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div className="no-scrollbar" style={{ overflowY: 'auto', flex: 1, maxHeight: '600px', scrollbarWidth: 'none' } as React.CSSProperties}>
          {members.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                No people to show
              </p>
            </div>
          ) : (
            members.map((m) => {
              const name = m.full_name ?? m.email
              const isPresent = m.presence_status === 'present'
              const isVisited = m.presence_status === 'visited'
              const avatarBg = isPresent
                ? 'color-mix(in srgb, var(--brand) 15%, transparent)'
                : isVisited
                ? 'color-mix(in srgb, var(--amber) 15%, transparent)'
                : 'var(--surface-2)'
              const avatarColor = isPresent ? 'var(--brand)' : isVisited ? 'var(--amber)' : 'var(--text-muted)'
              return (
                <Link key={m.member_id} href={`/ws/${slug}/members/${m.user_id}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 20px', borderBottom: '1px solid var(--border)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: avatarBg, color: avatarColor,
                      fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: m.presence_status !== 'notIn'
                        ? `0 0 0 2px ${isPresent ? 'var(--brand)' : 'var(--amber)'}` : 'none',
                    }}>
                      {getInitials(name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                        color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </div>
                      {m.full_name && (
                        <div style={{
                          fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.email}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <StatusBadge member={m} />
                      {m.latest_event?.checkout_location_mismatch != null && m.latest_event.checkout_location_mismatch > 0 && (
                        <span
                          title={`Checked out from a different location (${Math.round(m.latest_event.checkout_location_mismatch)}m away from office). Hours may not count as in-office.`}
                          style={{
                            fontSize: '11px',
                            color: 'var(--amber)',
                            fontFamily: 'var(--font-mono, monospace)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            cursor: 'default',
                          }}
                        >
                          ⚠ Left from different location
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Realtime Widget (HEAD) ───────────────────────────────────────────────────

function RealtimeWidget({ data, loading, activeCount, locationCounts }: {
  data: RealtimeResponse | null
  loading: boolean
  activeCount?: number
  locationCounts?: { label: string; count: number }[]
}) {
  const sk: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
    backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '3px',
  }

  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: '16px',
      height: '100%', boxSizing: 'border-box',
    }}>
      <div>
        <div style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '10px', fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: '6px',
        }}>
          Current Active Members
        </div>
        {loading ? (
          <div style={{ ...sk, height: '32px', width: '48px' }} />
        ) : (
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 700, lineHeight: 1, color: 'var(--navy)' }}>
            {activeCount ?? data?.active_count ?? 0}
          </div>
        )}
      </div>

      <div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px',
        }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Location</span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Members</span>
        </div>
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ ...sk, height: '11px', width: '100px' }} />
              <div style={{ ...sk, height: '11px', width: '16px' }} />
            </div>
          ))
        ) : (locationCounts ?? data?.locations ?? []).length === 0 ? (
          <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            No activity
          </div>
        ) : (
          (locationCounts ?? data?.locations ?? []).map((loc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: i < (locationCounts ?? data?.locations ?? []).length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: '12px',
                color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '75%',
              }}>
                {loc.label}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: 'var(--brand)' }}>
                {loc.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Office Presence Graph (HEAD: smooth bezier + hover tooltip) ──────────────

function OfficePresenceGraph({ buckets, loading }: { buckets: InsightBucket[]; loading: boolean }) {
  const [hovered, setHovered] = useState<{ x: number; y: number; label: string; count: number } | null>(null)

  const hourBuckets = [...buckets].sort((a, b) => parseInt(a.key) - parseInt(b.key))
  const rawMax = Math.max(...hourBuckets.map((b) => b.unique_users), 0)
  const yMax = Math.max(rawMax, 4)
  const tickStep = Math.max(1, Math.ceil(yMax / 4))

  const W = 600, H = 190, padL = 36, padR = 16, padT = 16, padB = 40
  const chartW = W - padL - padR
  const chartH = H - padT - padB

  const pts = hourBuckets.map((b, i) => {
    const x = padL + (i / Math.max(hourBuckets.length - 1, 1)) * chartW
    const y = padT + chartH - (b.unique_users / yMax) * chartH
    const h = parseInt(b.key, 10)
    const ampm = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return { x, y, label: `${h12}${ampm}`, count: b.unique_users, showLabel: h % 2 === 0 }
  })

  const smoothLinePath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return ''
    const d: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d.push(`C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`)
    }
    return d.join(' ')
  }
  const pathD = smoothLinePath(pts)
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
    : ''
  const yTicks = Array.from({ length: Math.floor(yMax / tickStep) + 1 }, (_, i) => ({
    val: i * tickStep,
    y: padT + chartH - ((i * tickStep) / yMax) * chartH,
  }))

  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '18px 20px', height: '100%', boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Activity size={14} />
        </div>
        <div>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Office Presence
          </span>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            people in office by hour · today
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>Loading…</span>
        </div>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', display: 'block', cursor: 'crosshair' }}
          aria-label="Office presence by hour"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const svgX = ((e.clientX - rect.left) / rect.width) * W
            if (pts.length === 0) return
            const nearest = pts.reduce((a, b) => Math.abs(b.x - svgX) < Math.abs(a.x - svgX) ? b : a)
            setHovered(nearest)
          }}
          onMouseLeave={() => setHovered(null)}
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y.toFixed(1)} x2={W - padR} y2={t.y.toFixed(1)} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 3" />
              <text x={padL - 6} y={(t.y + 4).toFixed(1)} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily="JetBrains Mono, monospace">{t.val}</text>
            </g>
          ))}
          {areaD && <path d={areaD} fill="color-mix(in srgb, var(--brand) 10%, transparent)" />}
          {pathD && <path d={pathD} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {hovered && (
            <g>
              <line x1={hovered.x.toFixed(1)} y1={padT.toFixed(1)} x2={hovered.x.toFixed(1)} y2={(padT + chartH).toFixed(1)} stroke="var(--brand)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx={hovered.x.toFixed(1)} cy={hovered.y.toFixed(1)} r="5" fill="var(--brand)" stroke="var(--surface-0)" strokeWidth="2" />
              <rect x={(hovered.x - 28).toFixed(1)} y={(hovered.y - 34).toFixed(1)} width="56" height="22" rx="5" fill="var(--navy)" opacity="0.9" />
              <text x={hovered.x.toFixed(1)} y={(hovered.y - 18).toFixed(1)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="DM Sans, sans-serif">
                {hovered.count} {hovered.count === 1 ? 'person' : 'people'}
              </text>
            </g>
          )}
          {pts.map((p, i) => (
            p.showLabel && (
              <text key={i} x={p.x.toFixed(1)} y={(padT + chartH + 18).toFixed(1)} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="DM Sans, sans-serif">
                {p.label}
              </text>
            )
          ))}
          <line x1={padL} y1={padT} x2={padL} y2={(padT + chartH)} stroke="var(--border)" strokeWidth="1" />
          <line x1={padL} y1={(padT + chartH)} x2={W - padR} y2={(padT + chartH)} stroke="var(--border)" strokeWidth="1" />
        </svg>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TodayClient({ slug, planLimitBanner, adminFirstName }: Props) {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [modal, setModal] = useState<{ title: string; members: DashboardMember[] } | null>(null)

  const [todayHourlyData, setTodayHourlyData] = useState<InsightsResponse | null>(null)
  const [todayHourlyLoading, setTodayHourlyLoading] = useState(true)

  const [realtimeData, setRealtimeData] = useState<RealtimeResponse | null>(null)
  const [realtimeLoading, setRealtimeLoading] = useState(true)

  const [dashLoading, setDashLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDash = useCallback(async (isSilent = false) => {
    if (!isSilent) setDashLoading(true)
    try {
      const res = await fetch(
        `/api/ws/${slug}/dashboard?status=all&signal=all&sortBy=name&sortDir=asc&page=1&limit=10`,
      );
      if (res.ok) {
        setData(await res.json())
        setLastUpdated(new Date())
      }
    } finally {
      if (!isSilent) setDashLoading(false)
    }
  }, [slug])

  const fetchTodayHourly = useCallback(async (isSilent = false) => {
    if (!isSilent) setTodayHourlyLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/insights?interval=today`, { cache: 'no-store' })
      if (res.ok) setTodayHourlyData(await res.json())
    } finally {
      if (!isSilent) setTodayHourlyLoading(false)
    }
  }, [slug])

  const [overview, setOverview] = useState<OverviewWidgetsResponse | null>(null)

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`/api/ws/${slug}/overview`, { cache: 'no-store' })
      if (res.ok) setOverview(await res.json())
    } catch {
      // best-effort widget data; page still works without it
    }
  }, [slug])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchDash(),
      fetchTodayHourly(),
      fetchOverview(),
    ])
  }, [fetchDash, fetchTodayHourly, fetchOverview])

  useEffect(() => {
    refreshAll()
    const dashId = setInterval(() => fetchDash(true), 30000)
    const graphId = setInterval(() => fetchTodayHourly(true), 10000)
    return () => {
      clearInterval(dashId)
      clearInterval(graphId)
    }
  }, [refreshAll, fetchDash, fetchTodayHourly])

  useEffect(() => {
    async function fetchRealtime() {
      setRealtimeLoading(true)
      try {
        const res = await fetch(`/api/ws/${slug}/realtime`)
        if (res.ok) setRealtimeData(await res.json())
      } finally {
        setRealtimeLoading(false)
      }
    }
    fetchRealtime()
    const id = setInterval(fetchRealtime, 60000)
    return () => clearInterval(id)
  }, [slug])

  const counts = data?.counts ?? { present: 0, visited: 0, notIn: 0, total: 0, office: 0, remote: 0 }

  const [approvingId, setApprovingId] = useState<string | null>(null)

  async function approveItem(item: ApprovalItem) {
    setApprovingId(item.id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/${item.kind}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (res.ok) await fetchOverview()
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="dash-page" style={{ padding: '24px', minHeight: '100%' }}>
      {/* Header */}
      <div className="fx-spring" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
            {en.wsOverview.greeting}, {adminFirstName}
          </p>
          <h1 style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '20px', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.2,
          }}>
            {data?.workspace_name ?? slug}
          </h1>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
            {overview
              ? overview.pendingApprovalsTotal === 0
                ? en.wsOverview.subtitleAllClear
                : overview.pendingApprovalsTotal === 1
                  ? en.wsOverview.subtitlePendingSingular
                  : en.wsOverview.subtitlePendingPlural.replace('{count}', String(overview.pendingApprovalsTotal))
              : ' '}
            {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={refreshAll}
            disabled={dashLoading || todayHourlyLoading}
            style={{
              height: '40px', padding: '0 16px',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <Activity size={14} className={dashLoading ? 'animate-spin' : ''} />
            {dashLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const now = new Date()
              const y = now.getFullYear()
              const m = String(now.getMonth() + 1).padStart(2, '0')
              const start = `${y}-${m}-01`
              const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
              const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
              const res = await fetch(`/api/ws/${slug}/export?start=${start}&end=${end}`)
              if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? 'Export failed'); return }
              const blob = await res.blob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `report-${slug}-${y}-${m}.csv`
              document.body.appendChild(a); a.click(); document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
            style={{
              height: '40px', padding: '0 20px',
              background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--brand) 35%, transparent)',
            }}
          >
            Export Report
          </button>
        </div>
      </div>

      {planLimitBanner}

      {/* ── Stat cards ── */}
      <div className="fx-spring-stagger" style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard
          className="dash-stat-card"
          title="Total Employees"
          value={counts.total}
          sub="Active personnel count"
          onClick={() => setModal({ title: 'Total Employees', members: data?.all_members ?? [] })}
          icon={<Users size={16} />}
        />
        <StatCard
          className="dash-stat-card"
          title="In Office"
          value={counts.office}
          sub="currently in office"
          onClick={() => setModal({ title: 'In Office', members: (data?.all_members ?? []).filter(m => resolvePresenceTag(m.presence_status, m.latest_event?.matched_by, m.latest_event?.event_type) === 'in_office') })}
          icon={<Monitor size={16} />}
        />
        <StatCard
          className="dash-stat-card"
          title="Remote"
          value={counts.remote}
          sub="working remotely"
          onClick={() => setModal({ title: 'Remote', members: (data?.all_members ?? []).filter(m => resolvePresenceTag(m.presence_status, m.latest_event?.matched_by, m.latest_event?.event_type) === 'remote') })}
          icon={<Home size={16} />}
        />
        <StatCard
          className="dash-stat-card"
          title={en.wsOverview.onLeaveTitle}
          value={overview?.onLeaveToday ?? '—'}
          sub={en.wsOverview.onLeaveSub}
          icon={<Users size={16} />}
        />
      </div>

      {/* ── Graphs row ── */}
      <div className="fx-spring" style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div className="dash-graph-item" style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <OfficePresenceGraph buckets={todayHourlyData?.buckets ?? []} loading={todayHourlyLoading} />
        </div>
        <div className="dash-graph-item" style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column' }}>
          <RealtimeWidget data={realtimeData} loading={realtimeLoading} activeCount={counts.present} locationCounts={data?.location_counts} />
        </div>
      </div>

      <div className="fx-spring" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '14px', marginTop: '14px' }}>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px' }}>{en.wsOverview.pendingApprovalsTitle}</p>
            {!!overview?.pendingApprovalsTotal && (
              <span style={{ background: 'color-mix(in srgb, var(--amber) 16%, transparent)', color: '#9a6200', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px' }}>
                {overview.pendingApprovalsTotal}
              </span>
            )}
          </div>
          {overview && overview.pendingApprovals.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{en.wsOverview.pendingApprovalsEmpty}</div>
          )}
          {overview?.pendingApprovals.map((item) => (
            <div key={`${item.kind}-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '13px' }}>{item.user_full_name ?? item.user_email}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                  {item.kind === 'leave'
                    ? `${item.leave_type_name} · ${item.start_date} – ${item.end_date} · ${item.days}d`
                    : `${item.requested_type === 'office' ? en.wsApprovals.markWfo : en.wsApprovals.markWfh} · ${item.target_date}`}
                </p>
              </div>
              <button
                onClick={() => approveItem(item)}
                disabled={approvingId === item.id}
                style={{ height: '30px', padding: '0 12px', borderRadius: 'var(--radius-sm)', background: 'var(--brand)', color: '#fff', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                {approvingId === item.id ? '…' : 'Approve'}
              </button>
              <Link
                href={`/ws/${slug}/approvals`}
                style={{ height: '30px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}
              >
                {en.wsOverview.reviewAction}
              </Link>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', marginBottom: '14px' }}>{en.wsOverview.departmentTitle}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {overview?.departmentBreakdown.map((b) => {
              const max = overview.departmentBreakdown[0]?.count || 1
              return (
                <div key={b.department}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{b.department}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{b.count}</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((b.count / max) * 100)}%`, background: 'var(--brand)', borderRadius: '4px' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="fx-spring" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px', marginTop: '14px' }}>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>{en.wsOverview.recentActivityTitle}</p>
          {(data?.all_members ?? [])
            .filter((m) => m.latest_event)
            .sort((a, b) => (b.latest_event!.checkin_at).localeCompare(a.latest_event!.checkin_at))
            .slice(0, 6)
            .map((m) => (
              <div key={m.member_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 20px', borderTop: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand) 16%, transparent)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
                  {getInitials(m.full_name ?? m.email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: '13px' }}>{m.full_name ?? m.email}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(m.latest_event!.checkin_at.includes('T') ? m.latest_event!.checkin_at : m.latest_event!.checkin_at.replace(' ', 'T') + 'Z').toLocaleTimeString()}</p>
                </div>
                <StatusBadge member={m} />
              </div>
            ))}
          {data && (data.all_members ?? []).filter((m) => m.latest_event).length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{en.wsOverview.recentActivityEmpty}</div>
          )}
        </div>
        <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '15px', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>{en.wsOverview.celebrationsTitle}</p>
          {overview?.celebrations.map((c) => (
            <div key={`${c.employeeId}-${c.kind}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '12.5px' }}>{c.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {c.kind === 'birthday' ? en.wsOverview.birthdayLabel : `${c.yearsCount}-year ${en.wsOverview.anniversaryLabel}`}
                </p>
              </div>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
                {new Date(`${c.occursOn}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
          {overview && overview.celebrations.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{en.wsOverview.celebrationsEmpty}</div>
          )}
        </div>
      </div>

      {/* ── Member rows ── */}
      {/* {dashLoading ? (
        [1, 2, 3].map((i) => {
          const sk: React.CSSProperties = {
            background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
            backgroundSize: '600px 100%', animation: 'shimmer 1.4s ease-in-out infinite', borderRadius: '6px',
          }
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
              background: 'var(--surface-0)', border: '1px solid var(--border)',
              borderLeft: '3px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '6px',
            }}>
              <div style={{ ...sk, width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...sk, height: '13px', width: '120px', marginBottom: '6px' }} />
                <div style={{ ...sk, height: '11px', width: '160px' }} />
              </div>
              <div>
                <div style={{ ...sk, height: '11px', width: '70px', marginBottom: '4px' }} />
                <div style={{ ...sk, height: '12px', width: '45px' }} />
              </div>
            </div>
          )
        })
      ) : (
        <>
          {presentMembers.length > 0 && (
            <>
              <SectionLabel color="var(--brand)">In office now ({counts.present})</SectionLabel>
              {presentMembers.map((m) => <PersonRow key={m.member_id} member={m} tz={tz} slug={slug} />)}
            </>
          )}
          {visitedMembers.length > 0 && (
            <>
              <SectionLabel color="var(--amber)">Visited today ({counts.visited})</SectionLabel>
              {visitedMembers.map((m) => <PersonRow key={m.member_id} member={m} tz={tz} slug={slug} />)}
            </>
          )}

          {counts.total === 0 && !dashLoading && (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)' }}>No members yet.</p>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Invite people from the People tab to get started.
              </p>
            </div>
          )}
        </>
      )} */}

      {/* ── Members modal ── */}
      {modal && (
        <MembersModal
          title={modal.title}
          members={modal.members}
          slug={slug}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
