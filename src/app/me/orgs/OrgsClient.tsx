'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WorkspaceMember, Workspace } from '@/lib/db/queries/workspaces'

interface Props {
  activeMemberships: WorkspaceMember[]
  pendingMemberships: WorkspaceMember[]
  wsMap: Record<string, Workspace>
}

export default function OrgsClient({ activeMemberships, pendingMemberships, wsMap }: Props) {
  const router = useRouter()
  const [activeList, setActiveList] = useState(activeMemberships)
  const [pendingList, setPendingList] = useState(pendingMemberships)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleLeave(workspaceId: string, wsName: string) {
    if (!confirm(`Leave ${wsName}? You will no longer appear in their presence dashboard.`)) return
    setLoadingId(workspaceId)
    try {
      const res = await fetch(`/api/me/workspaces/${workspaceId}`, { method: 'DELETE' })
      if (res.ok) {
        setActiveList((prev) => prev.filter((m) => m.workspace_id !== workspaceId))
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Could not leave workspace')
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
              fontFamily: 'Syne, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--amber)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            Pending invitations
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
                    fontFamily: 'DM Sans, sans-serif',
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
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  Wants to include your presence events in their dashboard.
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
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Accept
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
                      fontFamily: 'DM Sans, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    Decline
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
              fontFamily: 'Syne, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            Active
          </h2>
          {activeList.map((m) => {
            const ws = wsMap[m.workspace_id]
            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                    }}
                  >
                    {ws?.name ?? m.workspace_id}
                  </p>
                  <p
                    style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {m.role}
                  </p>
                </div>
                {m.role !== 'admin' && (
                  <button
                    onClick={() => handleLeave(m.workspace_id, ws?.name ?? 'this workspace')}
                    disabled={loadingId === m.workspace_id}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      fontFamily: 'DM Sans, sans-serif',
                      cursor: 'pointer',
                      padding: '4px 0',
                    }}
                  >
                    {loadingId === m.workspace_id ? 'Leaving…' : 'Leave'}
                  </button>
                )}
              </div>
            )
          })}
        </section>
      ) : (
        pendingList.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              You&apos;re not part of any workspace yet.
            </p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
              Your employer needs to add you, or you&apos;ll be auto-enrolled if your email domain matches.
            </p>
            <Link
              href="/ws"
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                color: 'var(--brand)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Or create your own workspace →
            </Link>
          </div>
        )
      )}
    </div>
  )
}
