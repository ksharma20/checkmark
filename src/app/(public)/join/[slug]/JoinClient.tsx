'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { access } from '@/locales/en/access'

interface Props {
  memberId: string
  workspaceName: string
}

export default function JoinClient({ memberId, workspaceName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Set by a `410 INVITE_EXPIRED`. The seven days can run out between this page
  // being served and the button being pressed, and re-offering Accept after the
  // server has refused it is offering a second refusal. Decline stays - it is
  // never expiry-checked, and it is how the row leaves this person's list.
  const [expired, setExpired] = useState(false)

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
        if (data.code === 'INVITE_EXPIRED') setExpired(true)
        setError(data.error || access.join.genericError)
        setLoading(null)
      }
    } catch {
      setError(access.join.genericError)
      setLoading(null)
    }
  }

  return (
    <>
      <h1 className="auth-title">{access.join.invitedTitle}</h1>
      <p className="auth-body">{access.join.invitedBody(workspaceName)}</p>

      <div className="auth-actions">
        {!expired && (
          <Button onClick={() => handle('accept')} loading={loading === 'accept'} disabled={!!loading}>
            {loading === 'accept' ? access.join.accepting : access.join.accept}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => handle('decline')}
          loading={loading === 'decline'}
          disabled={!!loading}
        >
          {loading === 'decline' ? access.join.declining : access.join.decline}
        </Button>
      </div>

      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
    </>
  )
}
