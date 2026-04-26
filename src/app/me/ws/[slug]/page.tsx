'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { resolvePresenceTag, PRESENCE_TAG_CONFIG } from '@/lib/client/presence'
import type { MemberTodaySummary } from '@/app/api/me/ws/[slug]/today/route'

interface WorkspaceTodayResponse {
  workspace: { name: string; slug: string }
  members: MemberTodaySummary[]
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontFamily: 'Syne, sans-serif', fontWeight: 700, flexShrink: 0 }}>
      {(name ?? '?')[0].toUpperCase()}
    </div>
  )
}

function StatusPill({ member }: { member: MemberTodaySummary }) {
  const tag = resolvePresenceTag(member.presence_status, member.matched_by, member.event_type)
  const { label, color } = PRESENCE_TAG_CONFIG[tag]
  return (
    <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color, background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${color}`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function MemberRow({ m }: { m: MemberTodaySummary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <Avatar name={m.full_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name ?? m.email}</p>
      </div>
      <StatusPill member={m} />
    </div>
  )
}

function Section({ title, members, color }: { title: string; members: MemberTodaySummary[]; color: string }) {
  if (members.length === 0) return null
  return (
    <section style={{ marginBottom: '24px' }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '13px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {title} ({members.length})
      </h2>
      {members.map((m) => <MemberRow key={m.user_id} m={m} />)}
    </section>
  )
}

export default function WorkspaceTodayPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<WorkspaceTodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/me/ws/${slug}/today`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [slug])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })

  if (loading) return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
      {[1,2,3,4].map((i) => <div key={i} style={{ height: '56px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', marginBottom: '8px', animation: 'cm-pulse 1.5s ease-in-out infinite' }} />)}
      <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)' }}>{error ?? 'Workspace not found'}</div>
  )

  const inOffice = data.members.filter((m) => resolvePresenceTag(m.presence_status, m.matched_by, m.event_type) === 'in_office')
  const remote   = data.members.filter((m) => resolvePresenceTag(m.presence_status, m.matched_by, m.event_type) === 'remote')
  const visited  = data.members.filter((m) => m.presence_status === 'visited')
  const notIn    = data.members.filter((m) => m.presence_status === 'notIn')

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '20px 16px' }}>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{today}</p>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '24px' }}>{data.workspace.name}</h1>
      <Section title="In Office"  members={inOffice} color="var(--teal)" />
      <Section title="Remote"     members={remote}   color="var(--amber)" />
      <Section title="Left Today" members={visited}  color="var(--text-secondary)" />
      <Section title="Not In"     members={notIn}    color="var(--text-muted)" />
      {data.members.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', padding: '48px 0' }}>No members found.</p>
      )}
    </div>
  )
}
