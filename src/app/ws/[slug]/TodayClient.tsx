'use client'

import { useState, useMemo } from 'react'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import type { PresenceEventWithMatch, MatchedBy } from '@/lib/signals'
import { formatInTz, durationHours } from '@/lib/timezone'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonEntry {
  member: MemberWithUser
  latest: PresenceEventWithMatch
  all: PresenceEventWithMatch[]
}

interface Props {
  present: PersonEntry[]
  visited: PersonEntry[]
  notIn: MemberWithUser[]
  tz: string
  totalMembers: number
}

type StatusFilter = 'all' | 'present' | 'visited' | 'notIn'
type SignalFilter = 'all' | 'wifi' | 'gps' | 'ip' | 'override'
type SortBy = 'name' | 'time' | 'duration'
type SortDir = 'asc' | 'desc'

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

function memberName(member: MemberWithUser): string {
  return member.full_name || member.email
}

function matchesSearch(member: MemberWithUser, q: string): boolean {
  if (!q) return true
  const lower = q.toLowerCase()
  return memberName(member).toLowerCase().includes(lower) || member.email.toLowerCase().includes(lower)
}

function sortEntries(entries: PersonEntry[], sortBy: SortBy, sortDir: SortDir): PersonEntry[] {
  return [...entries].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') {
      cmp = memberName(a.member).localeCompare(memberName(b.member))
    } else if (sortBy === 'time') {
      cmp = a.latest.checkin_at.localeCompare(b.latest.checkin_at)
    } else {
      const dA = durationHours(a.latest.checkin_at, a.latest.checkout_at) ?? 0
      const dB = durationHours(b.latest.checkin_at, b.latest.checkout_at) ?? 0
      cmp = dA - dB
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

// ─── Row components ───────────────────────────────────────────────────────────

function PersonRow({ member, latestEvent, allEvents, isActive, tz }: {
  member: MemberWithUser
  latestEvent: PresenceEventWithMatch
  allEvents: PresenceEventWithMatch[]
  isActive: boolean
  tz: string
}) {
  const duration = durationHours(latestEvent.checkin_at, latestEvent.checkout_at)
  const name = memberName(member)
  const checkinTime = formatInTz(latestEvent.checkin_at, tz, 'time')
  const checkoutTime = latestEvent.checkout_at ? formatInTz(latestEvent.checkout_at, tz, 'time') : null

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto',
      alignItems: 'center', gap: '16px', padding: '12px 16px',
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px',
    }}>
      <div>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)' }}>
          {name}
          {allEvents.length > 1 && (
            <span style={{ marginLeft: '6px', fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
              ×{allEvents.length}
            </span>
          )}
        </p>
        {member.full_name && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
            {member.email}
          </p>
        )}
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {checkinTime}{checkoutTime ? ` → ${checkoutTime}` : isActive ? ' →' : ''}
      </span>
      <SignalBadge matchedBy={latestEvent.matched_by} />
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: duration !== null ? 'var(--text-secondary)' : 'var(--text-muted)', width: '52px', textAlign: 'right' }}>
        {duration !== null ? fmtDuration(duration) : isActive ? '…' : '—'}
      </span>
    </div>
  )
}

function NotInRow({ member }: { member: MemberWithUser }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 16px',
      background: 'var(--surface-0)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', marginBottom: '6px', opacity: 0.7,
    }}>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', flex: 1 }}>
        {memberName(member)}
      </span>
      {member.full_name && (
        <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)' }}>
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

// ─── Filter bar sub-components ────────────────────────────────────────────────

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: '32px',
        padding: '0 12px',
        border: active ? '1px solid var(--navy)' : '1px solid var(--border)',
        borderRadius: '20px',
        background: active ? 'var(--navy)' : 'var(--surface-0)',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function SignalPill({ value, active, onClick }: { value: SignalFilter; active: boolean; onClick: () => void }) {
  const colors: Record<SignalFilter, string> = {
    all: 'var(--text-secondary)',
    wifi: 'var(--teal)',
    gps: 'var(--brand)',
    ip: 'var(--amber)',
    override: '#8B5CF6',
  }
  const color = active ? colors[value] : 'var(--text-secondary)'
  const bg = active && value !== 'all' ? SIGNAL_BADGE[value as MatchedBy]?.bg ?? 'transparent' : active ? 'var(--surface-2)' : 'var(--surface-0)'

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: '28px',
        padding: '0 10px',
        border: active ? `1px solid ${color}` : '1px solid var(--border)',
        borderRadius: '4px',
        background: bg,
        color,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {value === 'all' ? 'All signals' : value.toUpperCase()}
    </button>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export default function TodayClient({ present, visited, notIn, tz, totalMembers }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('time')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Apply search + signal filter to present/visited, search to notIn
  const filteredPresent = useMemo(() => {
    let entries = present.filter(({ member }) => matchesSearch(member, search))
    if (signalFilter !== 'all') entries = entries.filter(({ latest }) => latest.matched_by === signalFilter)
    return sortEntries(entries, sortBy, sortDir)
  }, [present, search, signalFilter, sortBy, sortDir])

  const filteredVisited = useMemo(() => {
    let entries = visited.filter(({ member }) => matchesSearch(member, search))
    if (signalFilter !== 'all') entries = entries.filter(({ latest }) => latest.matched_by === signalFilter)
    return sortEntries(entries, sortBy, sortDir)
  }, [visited, search, signalFilter, sortBy, sortDir])

  const filteredNotIn = useMemo(() => {
    if (signalFilter !== 'all') return [] // signal filter implies "has events" — notIn is irrelevant
    const entries = notIn.filter((member) => matchesSearch(member, search))
    return [...entries].sort((a, b) => {
      const cmp = memberName(a).localeCompare(memberName(b))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [notIn, search, signalFilter, sortDir])

  const showPresent = statusFilter === 'all' || statusFilter === 'present'
  const showVisited = statusFilter === 'all' || statusFilter === 'visited'
  const showNotIn   = statusFilter === 'all' || statusFilter === 'notIn'

  const totalVisible =
    (showPresent ? filteredPresent.length : 0) +
    (showVisited ? filteredVisited.length : 0) +
    (showNotIn   ? filteredNotIn.length   : 0)

  const isFiltering = search.trim().length > 0 || statusFilter !== 'all' || signalFilter !== 'all'

  function resetFilters() {
    setSearch('')
    setStatusFilter('all')
    setSignalFilter('all')
    setSortBy('time')
    setSortDir('asc')
  }

  return (
    <>
      {/* ── Row 1: search + status + sort ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '160px' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{
              width: '100%', height: '36px', padding: '0 32px 0 10px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              background: 'var(--surface-0)', color: 'var(--text-primary)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {search && (
            <span style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '11px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}>
              {totalVisible}/{totalMembers}
            </span>
          )}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <TabPill active={statusFilter === 'all'}     onClick={() => setStatusFilter('all')}>All</TabPill>
          <TabPill active={statusFilter === 'present'} onClick={() => setStatusFilter('present')}>In office ({present.length})</TabPill>
          <TabPill active={statusFilter === 'visited'} onClick={() => setStatusFilter('visited')}>Visited ({visited.length})</TabPill>
          <TabPill active={statusFilter === 'notIn'}   onClick={() => setStatusFilter('notIn')}>Not in ({notIn.length})</TabPill>
        </div>

        {/* Sort + advanced toggle */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
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
          <button
            type="button"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
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
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
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

      {/* ── Row 2: advanced filters ─────────────────────────────────────────── */}
      {showAdvanced && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 14px', background: 'var(--surface-1)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          marginBottom: '10px',
        }}>
          <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', marginRight: '4px' }}>
            Signal:
          </span>
          {(['all', 'wifi', 'gps', 'ip', 'override'] as SignalFilter[]).map((v) => (
            <SignalPill key={v} value={v} active={signalFilter === v} onClick={() => setSignalFilter(v)} />
          ))}
          {isFiltering && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                marginLeft: 'auto', height: '28px', padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: '4px',
                background: 'var(--surface-0)', color: 'var(--text-muted)',
                fontSize: '11px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Present ─────────────────────────────────────────────────────────── */}
      {showPresent && filteredPresent.length > 0 && (
        <>
          <SectionLabel>In office now ({filteredPresent.length})</SectionLabel>
          {filteredPresent.map(({ member, latest, all }) => (
            <PersonRow key={member.member_id} member={member} latestEvent={latest} allEvents={all} isActive={true} tz={tz} />
          ))}
        </>
      )}

      {/* ── Visited ─────────────────────────────────────────────────────────── */}
      {showVisited && filteredVisited.length > 0 && (
        <>
          <SectionLabel>Visited today ({filteredVisited.length})</SectionLabel>
          {filteredVisited.map(({ member, latest, all }) => (
            <PersonRow key={member.member_id} member={member} latestEvent={latest} allEvents={all} isActive={false} tz={tz} />
          ))}
        </>
      )}

      {/* ── Not in ──────────────────────────────────────────────────────────── */}
      {showNotIn && filteredNotIn.length > 0 && (
        <>
          <SectionLabel>Not in today ({filteredNotIn.length})</SectionLabel>
          {filteredNotIn.map((member) => (
            <NotInRow key={member.member_id} member={member} />
          ))}
        </>
      )}

      {/* ── No results ──────────────────────────────────────────────────────── */}
      {isFiltering && totalVisible === 0 && (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-muted)' }}>
            No members match the current filters.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              marginTop: '10px', background: 'none', border: 'none',
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
              color: 'var(--brand)', cursor: 'pointer', padding: 0,
            }}
          >
            Reset filters
          </button>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!isFiltering && totalMembers === 0 && (
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)' }}>
            No members yet.
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Invite people from the People tab to get started.
          </p>
        </div>
      )}
    </>
  )
}
