'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { WorkspaceMember, Workspace } from '@/lib/db/queries/workspaces'
import { isWorkspaceAdmin } from '@/lib/permissions/ranks'
import { en } from '@/locales/en'

interface Props {
  activeMemberships: WorkspaceMember[]
  pendingMemberships: WorkspaceMember[]
  wsMap: Record<string, Workspace>
  /** Role display name per workspace id. */
  roleNames: Record<string, string>
}

export default function OrgsClient({ activeMemberships, pendingMemberships, wsMap, roleNames }: Props) {
  const router = useRouter()
  const [activeList, setActiveList] = useState(activeMemberships)
  const [pendingList, setPendingList] = useState(pendingMemberships)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, { present: number; visited: number; notIn: number }>>({})

  useEffect(() => {
    activeList.forEach((m) => {
      const ws = wsMap[m.workspace_id]
      if (!ws?.slug) return
      fetch(`/api/me/ws/${ws.slug}/counts`)
        .then((r) => r.json())
        .then((data) => {
          if (data.present !== undefined) {
            setCounts((prev) => ({ ...prev, [m.workspace_id]: data }))
          }
        })
        .catch(() => {})
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLeave(workspaceId: string, wsName: string) {
    if (!confirm(en.meOrgs.leaveConfirm(wsName))) return
    setLoadingId(workspaceId)
    try {
      const res = await fetch(`/api/me/workspaces/${workspaceId}`, { method: 'DELETE' })
      if (res.ok) {
        setActiveList((prev) => prev.filter((m) => m.workspace_id !== workspaceId))
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || en.meOrgs.leaveError)
      }
    } finally {
      setLoadingId(null)
    }
  }

  async function handleConsent(memberId: string, action: 'accept' | 'decline') {
    setLoadingId(memberId)
    try {
      const res = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      })
      if (res.ok) {
        setPendingList((prev) => prev.filter((m) => m.id !== memberId))
        if (action === 'accept') router.refresh()
      }
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      {/* Pending consent invites */}
      {pendingList.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h2
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--amber)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            {en.meOrgs.pendingInvitesTitle}
          </h2>
          {pendingList.map((m) => {
            const ws = wsMap[m.workspace_id]
            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--amber)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginBottom: '8px',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    marginBottom: '4px',
                  }}
                >
                  {ws?.name ?? m.workspace_id}
                </p>
                <p
                  style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  {en.meOrgs.pendingInviteBody}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleConsent(m.id, 'accept')}
                    disabled={loadingId === m.id}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      background: 'var(--brand)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {en.meOrgs.acceptBtn}
                  </button>
                  <button
                    onClick={() => handleConsent(m.id, 'decline')}
                    disabled={loadingId === m.id}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    {en.meOrgs.declineBtn}
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* Active memberships */}
      {activeList.length > 0 ? (
        <section>
          <h2
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            {en.meOrgs.activeTitle}
          </h2>
          {activeList.map((m) => {
            const ws = wsMap[m.workspace_id]
            const href = `/me/ws/${ws?.slug ?? m.workspace_id}`
            return (
              <div
                key={m.id}
                style={{
                  position: 'relative',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 12px color-mix(in srgb, var(--brand) 12%, transparent)'
                  e.currentTarget.style.borderColor = 'var(--brand)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {/* Full-card link overlay */}
                <Link
                  href={href}
                  style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)' }}
                  aria-label={ws?.name ?? m.workspace_id}
                />

                <div style={{ flex: 1, position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
                  <p
                    style={{
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 600,
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                    }}
                  >
                    {ws?.name ?? m.workspace_id}
                  </p>
                  {/* The role's display name as stored - never the raw key,
                      which `capitalize` would render as e.g. "Hr-manager". */}
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginBottom: counts[m.workspace_id] ? '4px' : '0' }}>
                    {roleNames[m.workspace_id] ?? m.role}
                  </p>
                  {counts[m.workspace_id] && (
                    <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--teal)', fontWeight: 500 }}>{counts[m.workspace_id].present} in office</span>
                      {' · '}
                      <span>{counts[m.workspace_id].visited} visited</span>
                      {' · '}
                      <span>{counts[m.workspace_id].notIn} not in</span>
                    </p>
                  )}
                </div>

                {/* Arrow hint */}
                <ChevronRight size={22} strokeWidth={2.5} style={{ position: 'relative', zIndex: 1, color: 'var(--brand)', flexShrink: 0, pointerEvents: 'none' }} />

                {!isWorkspaceAdmin(m.role) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLeave(m.workspace_id, ws?.name ?? en.meOrgs.leaveFallbackName)
                    }}
                    disabled={loadingId === m.workspace_id}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      cursor: 'pointer',
                      padding: '4px 0',
                      marginLeft: '8px',
                    }}
                  >
                    {loadingId === m.workspace_id ? en.meOrgs.leavingBtn : en.meOrgs.leaveBtn}
                  </button>
                )}
              </div>
            )
          })}
        </section>
      ) : (
        pendingList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {en.meOrgs.emptyTitle}
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
              {en.meOrgs.emptyBody}
            </p>
            <Link
              href="/ws"
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                color: 'var(--brand)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {en.meOrgs.createLink}
            </Link>
          </div>
        )
      )}
    </div>
  )
}
