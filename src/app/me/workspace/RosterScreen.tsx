'use client'

/**
 * The roster that used to be the first three accordion tabs of
 * `/me/ws/[slug]`: who is in the office, who is working remotely and who is on
 * leave today.
 *
 * The office/remote split is not a field on the row - it is
 * `resolvePresenceTag`, the same helper the old screen used, so the AND
 * semantics described in CLAUDE.md stay in one place. People on leave come
 * from a second endpoint and are subtracted from the checked-in sets first: a
 * member who took leave and then checked in anyway should read as present, not
 * as two rows.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  Avatar,
  Card,
  Divider,
  EmptyState,
  Skeleton,
  StatCard,
} from '@/components/ui'
import { resolvePresenceTag } from '@/lib/client/presence'
import type { MemberTodaySummary } from '@/app/api/me/ws/[slug]/today/route'
import { meScreens } from '@/locales/en/me-screens'
import { useWorkspaceScope } from '../workspace-scope'

interface TodayResponse {
  workspace: { id: string; name: string; slug: string }
  members: MemberTodaySummary[]
}

interface MemberOnLeaveToday {
  user_id: string
  full_name: string | null
  email: string
  leave_type_name: string
}

/** The roster as loaded, tagged with the workspace it belongs to. */
interface RosterData {
  slug: string
  today: TodayResponse | null
  onLeave: MemberOnLeaveToday[]
  failed: boolean
}

interface RosterPerson {
  id: string
  name: string
  secondary: string
  meta: string
}

function displayName(fullName: string | null, email: string): string {
  return fullName?.trim() || email
}

/** `checkin_at` is stored UTC, with or without a trailing Z depending on driver. */
function formatTime(raw: string | null): string {
  if (!raw) return meScreens.common.empty
  const iso = raw.includes('T')
    ? raw.endsWith('Z')
      ? raw
      : `${raw}Z`
    : `${raw.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return meScreens.common.empty
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function Group({ label, people }: { label: string; people: RosterPerson[] }) {
  if (people.length === 0) return null

  return (
    <>
      <p className="t-eyebrow" style={{ margin: '20px 0 8px' }}>
        {meScreens.roster.groupCount(label, people.length)}
      </p>
      <Card padded={false} style={{ padding: '6px' }}>
        {people.map((person, index) => (
          <div key={person.id}>
            {index > 0 && <Divider style={{ margin: '0 8px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px' }}>
              <Avatar name={person.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '13px' }}>{person.name}</p>
                <p className="t-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {person.secondary}
                </p>
              </div>
              <p className="t-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', flexShrink: 0 }}>
                {person.meta}
              </p>
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

export default function RosterScreen() {
  const { slug } = useWorkspaceScope()

  // Tagged with the workspace it was fetched for, so switching workspace
  // invalidates it by construction - no reset effect, and never a moment where
  // one workspace's roster is painted under another's name.
  const [data, setData] = useState<RosterData | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    Promise.all([
      fetch(`/api/me/ws/${encodeURIComponent(slug)}/today`).then((r) => r.json()),
      fetch(`/api/me/ws/${encodeURIComponent(slug)}/leave-requests/today`).then((r) => r.json()),
    ])
      .then(([todayData, leaveData]: [TodayResponse, { members?: MemberOnLeaveToday[] }]) => {
        if (cancelled) return
        setData({
          slug,
          today: Array.isArray(todayData?.members) ? todayData : null,
          onLeave: Array.isArray(leaveData?.members) ? leaveData.members : [],
          failed: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setData({ slug, today: null, onLeave: [], failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const fresh = data?.slug === slug ? data : null
  const loading = fresh === null
  const failed = fresh?.failed ?? false
  const today = fresh?.today ?? null
  const onLeave = fresh?.onLeave ?? []

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <Link
        href="/me"
        aria-label={meScreens.common.back}
        className="btn btn-ghost btn-sm pressable"
        style={{ padding: '0 6px', textDecoration: 'none' }}
      >
        <ArrowLeft size={18} aria-hidden />
      </Link>
      <div>
        <h1 className="t-h1">{meScreens.roster.title}</h1>
        <p className="t-muted" style={{ marginTop: '2px' }}>
          {meScreens.roster.subtitle}
        </p>
      </div>
    </div>
  )

  if (!slug) {
    return (
      <>
        {header}
        <EmptyState
          title={meScreens.common.noWorkspaceTitle}
          hint={meScreens.common.noWorkspaceBody}
        />
      </>
    )
  }

  const members = today?.members ?? []
  const checkedIn = members.filter((m) => m.presence_status !== 'notIn')
  const checkedInIds = new Set(checkedIn.map((m) => m.user_id))

  const present: RosterPerson[] = []
  const remote: RosterPerson[] = []
  for (const m of checkedIn) {
    const person: RosterPerson = {
      id: m.user_id,
      name: displayName(m.full_name, m.email),
      secondary: m.checkout_at ? meScreens.roster.checkedOut : m.email,
      meta: formatTime(m.checkin_at),
    }
    const tag = resolvePresenceTag(m.presence_status, m.matched_by, m.event_type)
    if (tag === 'in_office') present.push(person)
    else remote.push(person)
  }

  const leave: RosterPerson[] = onLeave
    .filter((m) => !checkedInIds.has(m.user_id))
    .map((m) => ({
      id: m.user_id,
      name: displayName(m.full_name, m.email),
      secondary: m.email,
      meta: m.leave_type_name,
    }))

  const nothingToShow =
    !loading && !failed && present.length === 0 && remote.length === 0 && leave.length === 0

  return (
    <>
      {header}

      {failed ? (
        <EmptyState title={meScreens.common.loadFailed} />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginTop: '4px',
            }}
          >
            {[
              { label: meScreens.roster.statPresent, value: present.length, accent: 'brand' as const },
              { label: meScreens.roster.statRemote, value: remote.length, accent: 'amber' as const },
              { label: meScreens.roster.statLeave, value: leave.length, accent: 'default' as const },
            ].map((tile) => (
              <StatCard
                key={tile.label}
                label={tile.label}
                accent={tile.accent}
                value={loading ? <Skeleton width={28} height={24} /> : tile.value}
                style={{ padding: '14px' }}
              />
            ))}
          </div>

          {loading ? (
            <div className="stack" style={{ marginTop: '20px' }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={64} radius="var(--radius-lg)" />
              ))}
            </div>
          ) : nothingToShow ? (
            <EmptyState title={meScreens.roster.empty} hint={meScreens.roster.emptyHint} />
          ) : (
            <>
              <Group label={meScreens.roster.groupPresent} people={present} />
              <Group label={meScreens.roster.groupRemote} people={remote} />
              <Group label={meScreens.roster.groupLeave} people={leave} />
            </>
          )}
        </>
      )}
    </>
  )
}
