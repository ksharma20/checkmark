'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashboardMember, DashboardResponse } from '@/app/api/ws/[slug]/dashboard/route'
import type { MatchedBy } from '@/lib/signals'
import { formatInTz, durationHours } from '@/lib/timezone'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'present' | 'visited' | 'notIn'
type SignalFilter = 'all' | MatchedBy
type SortBy = 'name' | 'time' | 'duration'
type SortDir = 'asc' | 'desc'

interface Props {
  slug: string
  tz: string
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

const SIGNAL_BADGE: Record<MatchedBy, { label: string; color: string; bg: string }> = {
  wifi:     { label: 'WiFi',     color: 'var(--teal)',    bg: 'color-mix(in srgb, var(--teal) 12%, transparent)' },
  gps:      { label: 'GPS',      color: 'var(--brand)',   bg: 'color-mix(in srgb, var(--brand) 12%, transparent)' },
  ip:       { label: 'IP',       color: 'var(--amber)',   bg: 'color-mix(in srgb, var(--amber) 12%, transparent)' },
  override: { label: 'Override', color: '#8B5CF6',        bg: 'color-mix(in srgb, #8B5CF6 12%, transparent)' },
  none:     { label: '—',        color: 'var(--text-muted)', bg: 'transparent' },
}

function SignalBadge({ matchedBy }: { matchedBy: MatchedBy }) {
  const badge = SIGNAL_BADGE[matchedBy]
  if (matchedBy === 'none') return <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 7px',
      borderRadius: '4px', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
      color: badge.color, background: badge.bg, border: `1px solid ${badge.color}`, whiteSpace: 'nowrap',
    }}>
      {badge.label}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Row components ───────────────────────────────────────────────────────────

function PersonRow({ member, tz }: { member: DashboardMember; tz: string }) {
  const ev = member.latest_event
  const isActive = member.presence_status === 'present'
  const checkinTime = ev ? formatInTz(ev.checkin_at, tz, 'time') : null
  const checkoutTime = ev?.checkout_at ? formatInTz(ev.checkout_at, tz, 'time') : null
  const dur = ev ? durationHours(ev.checkin_at, ev.checkout_at) : null
  const displayName = member.full_name ?? member.email

  return (
    <div style={{
      padding: '11px 14px',
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px',
    }}>
      {/* Row 1: name + signal + duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <span style={{
          fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px',
          color: 'var(--text-primary)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayName}
          {member.event_count > 1 && (
            <span style={{ marginLeft: '5px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              ×{member.event_count}
            </span>
          )}
        </span>
        {ev && <SignalBadge matchedBy={ev.matched_by} />}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
          color: dur !== null ? 'var(--text-secondary)' : 'var(--text-muted)',
          flexShrink: 0,
        }}>
          {dur !== null ? fmtDuration(dur) : isActive ? '…' : '—'}
        </span>
      </div>

      {/* Row 2: email (optional) + time range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {member.full_name && (
          <span style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {member.email}
          </span>
        )}
        {checkinTime && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
            color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: 'auto',
          }}>
            {checkinTime}{checkoutTime ? ` → ${checkoutTime}` : isActive ? ' →' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function NotInRow({ member }: { member: DashboardMember }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: 0.65,
    }}>
      <span style={{
        fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)',
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {member.full_name ?? member.email}
      </span>
      {member.full_name && (
        <span style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%',
        }}>
          {member.email}
        </span>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'Syne, sans-serif', fontSize: '11px', fontWeight: 600,
      color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: '8px', marginTop: '24px',
    }}>
      {children}
    </p>
  )
}

// ─── Filter bar components ────────────────────────────────────────────────────

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      height: '32px', padding: '0 12px',
      border: active ? '1px solid var(--navy)' : '1px solid var(--border)',
      borderRadius: '20px',
      background: active ? 'var(--navy)' : 'var(--surface-0)',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontFamily: 'DM Sans, sans-serif', fontSize: '13px', fontWeight: active ? 500 : 400,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {children}
    </button>
  )
}

function SignalPill({ value, active, onClick }: { value: SignalFilter; active: boolean; onClick: () => void }) {
  const colors: Record<SignalFilter, string> = {
    all: 'var(--text-secondary)', wifi: 'var(--teal)', gps: 'var(--brand)',
    ip: 'var(--amber)', override: '#8B5CF6', none: 'var(--text-muted)',
  }
  const color = active ? colors[value] : 'var(--text-secondary)'
  const bg = active && value !== 'all' && value !== 'none'
    ? SIGNAL_BADGE[value as MatchedBy]?.bg ?? 'transparent'
    : active ? 'var(--surface-2)' : 'var(--surface-0)'

  return (
    <button type="button" onClick={onClick} style={{
      height: '28px', padding: '0 10px',
      border: active ? `1px solid ${color}` : '1px solid var(--border)',
      borderRadius: '4px', background: bg, color,
      fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: active ? 600 : 400,
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>
      {value === 'all' ? 'All signals' : value.toUpperCase()}
    </button>
  )
}

function StatChip({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '14px 20px', minWidth: '100px',
    }}>
      <div style={{
        fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 700,
        color: accent ? 'var(--teal)' : 'var(--navy)', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
        {label}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TodayClient({ slug, tz }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('time')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)

  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 300)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        signal: signalFilter,
        search: debouncedSearch,
        sortBy,
        sortDir,
        page: String(page),
        limit: '25',
      })
      const res = await fetch(`/api/ws/${slug}/dashboard?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [slug, statusFilter, signalFilter, debouncedSearch, sortBy, sortDir, page])

  useEffect(() => { fetchData() }, [fetchData])

  function resetFilters() {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setSignalFilter('all')
    setSortBy('time')
    setSortDir('asc')
    setPage(1)
  }

  function changeStatus(s: StatusFilter) { setStatusFilter(s); setPage(1) }
  function changeSignal(s: SignalFilter) { setSignalFilter(s); setPage(1) }

  const counts = data?.counts ?? { present: 0, visited: 0, notIn: 0, total: 0 }
  const members = data?.members ?? []
  const totalFiltered = data?.total ?? 0
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1
  const isFiltering = debouncedSearch.trim().length > 0 || statusFilter !== 'all' || signalFilter !== 'all'

  // Split members by status for section headers when viewing 'all'
  const presentMembers = statusFilter === 'all' ? members.filter((m) => m.presence_status === 'present') : members.filter((m) => m.presence_status === 'present')
  const visitedMembers = members.filter((m) => m.presence_status === 'visited')
  const notInMembers = members.filter((m) => m.presence_status === 'notIn')

  return (
    <>
      {/* Stat chips */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <StatChip value={counts.present} label="in office" accent={counts.present > 0} />
        <StatChip value={counts.visited} label="visited" />
        <StatChip value={counts.notIn} label="not in" />
        <StatChip value={counts.total} label="total members" />
      </div>

      {/* ── Row 1: search + status tabs + sort ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '160px' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email…"
            style={{
              width: '100%', height: '36px', padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <TabPill active={statusFilter === 'all'}     onClick={() => changeStatus('all')}>All</TabPill>
          <TabPill active={statusFilter === 'present'} onClick={() => changeStatus('present')}>In office ({counts.present})</TabPill>
          <TabPill active={statusFilter === 'visited'} onClick={() => changeStatus('visited')}>Visited ({counts.visited})</TabPill>
          <TabPill active={statusFilter === 'notIn'}   onClick={() => changeStatus('notIn')}>Not in ({counts.notIn})</TabPill>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1) }}
            style={{
              height: '32px', padding: '0 8px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="time">Sort: Time in</option>
            <option value="name">Sort: Name</option>
            <option value="duration">Sort: Duration</option>
          </select>
          <button type="button" onClick={() => { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1) }}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            style={{
              width: '32px', height: '32px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface-0)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
          <button type="button" onClick={() => setShowAdvanced(v => !v)}
            style={{
              height: '32px', padding: '0 10px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: showAdvanced ? 'var(--surface-2)' : 'var(--surface-0)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px',
              fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            }}
          >
            Filters {showAdvanced ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* ── Row 2: signal filters ─────────────────────────────────────────────── */}
      {showAdvanced && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 14px', background: 'var(--surface-1)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '10px',
        }}>
          <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', marginRight: '4px' }}>
            Signal:
          </span>
          {(['all', 'wifi', 'gps', 'ip', 'override'] as SignalFilter[]).map((v) => (
            <SignalPill key={v} value={v} active={signalFilter === v} onClick={() => changeSignal(v)} />
          ))}
          {isFiltering && (
            <button type="button" onClick={resetFilters} style={{
              marginLeft: 'auto', height: '28px', padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: '4px',
              background: 'var(--surface-0)', color: 'var(--text-muted)',
              fontSize: '11px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
            }}>
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
      {loading && (
        <div>
          {[1, 2, 3, 4].map((i) => {
            const sk: React.CSSProperties = {
              background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
              backgroundSize: '600px 100%',
              animation: 'shimmer 1.4s ease-in-out infinite',
              borderRadius: '6px',
            }
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center', gap: '16px', padding: '12px 16px',
                background: 'var(--surface-0)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', marginBottom: '6px',
              }}>
                <div>
                  <div style={{ ...sk, height: '13px', width: '120px', marginBottom: '6px' }} />
                  <div style={{ ...sk, height: '11px', width: '160px' }} />
                </div>
                <div style={{ ...sk, height: '12px', width: '80px' }} />
                <div style={{ ...sk, height: '20px', width: '40px', borderRadius: '4px' }} />
                <div style={{ ...sk, height: '12px', width: '40px' }} />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {!loading && (
        <>
          {/* Present */}
          {(statusFilter === 'all' || statusFilter === 'present') && presentMembers.length > 0 && (
            <>
              {statusFilter === 'all' && <SectionLabel>In office now ({counts.present})</SectionLabel>}
              {presentMembers.map((m) => <PersonRow key={m.member_id} member={m} tz={tz} />)}
            </>
          )}

          {/* Visited */}
          {(statusFilter === 'all' || statusFilter === 'visited') && visitedMembers.length > 0 && (
            <>
              {statusFilter === 'all' && <SectionLabel>Visited today ({counts.visited})</SectionLabel>}
              {visitedMembers.map((m) => <PersonRow key={m.member_id} member={m} tz={tz} />)}
            </>
          )}

          {/* Not in */}
          {(statusFilter === 'all' || statusFilter === 'notIn') && notInMembers.length > 0 && (
            <>
              {statusFilter === 'all' && <SectionLabel>Not in today ({counts.notIn})</SectionLabel>}
              {notInMembers.map((m) => <NotInRow key={m.member_id} member={m} />)}
            </>
          )}

          {/* No results */}
          {members.length === 0 && isFiltering && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)' }}>
                No members match the current filters.
              </p>
              <button type="button" onClick={resetFilters} style={{
                marginTop: '10px', background: 'none', border: 'none',
                fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
                color: 'var(--brand)', cursor: 'pointer', padding: 0,
              }}>
                Reset filters
              </button>
            </div>
          )}

          {/* Empty workspace */}
          {counts.total === 0 && !isFiltering && (
            <div style={{ marginTop: '48px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)' }}>
                No members yet.
              </p>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Invite people from the People tab to get started.
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                style={{
                  height: '32px', padding: '0 14px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--surface-0)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '13px', cursor: page <= 1 ? 'default' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)' }}>
                {page} / {totalPages} · {totalFiltered} members
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                style={{
                  height: '32px', padding: '0 14px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--surface-0)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '13px', cursor: page >= totalPages ? 'default' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
