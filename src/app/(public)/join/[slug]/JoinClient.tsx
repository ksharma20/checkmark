'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  memberId: string
  workspaceName: string
}

export default function JoinClient({ memberId, workspaceName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handle(action: 'accept' | 'decline') {
    setLoading(action)
    setError(null)
    try {
      const res = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      })
      if (res.ok) {
        router.push('/me')
      } else {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
        setLoading(null)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '8px',
        }}
      >
        You&apos;ve been invited
      </h1>
      <p
        style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}
      >
        <strong>{workspaceName}</strong> wants to include your presence events in their dashboard.
        Your data always belongs to you — you can revoke this at any time.
      </p>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => handle('accept')}
          disabled={!!loading}
          style={{
            flex: 1,
            height: '48px',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 600,
            fontSize: '15px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading === 'accept' ? 'Accepting…' : 'Accept'}
        </button>
        <button
          onClick={() => handle('decline')}
          disabled={!!loading}
          style={{
            flex: 1,
            height: '48px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '15px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>

      {error && (
        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--danger)', fontFamily: 'DM Sans, sans-serif' }}>
          {error}
        </p>
      )}
    </div>
  )
}
