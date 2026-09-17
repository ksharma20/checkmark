'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, SkeletonText } from '@/components/ui'
import { en } from '@/locales/en'

const t = en.wsSettings

interface Props {
  slug: string
}

/**
 * Ownership - archive and restore the workspace.
 *
 * This tab used to be "Billing" and carried the plan, its limits and a
 * "Manage billing" no-op. CheckMark has no payment integration and every plan
 * is unlimited (`src/lib/plans.ts`), so there is nothing to show about a plan.
 * Archiving and restoring stay here because they are gated on
 * `Resource.Ownership`, and this is the only Settings tab shown to owners alone.
 */
export default function OwnershipTab({ slug }: Props) {
  const router = useRouter()

  const [isArchived, setIsArchived] = useState<boolean | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ws/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setIsArchived(!!data.archived_at)
      })
    return () => { cancelled = true }
  }, [slug])

  async function archive() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/archive`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        router.push('/ws')
      } else {
        setError(data.error || t.archiveError)
        setConfirming(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/restore`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setIsArchived(false)
        setConfirming(false)
        router.refresh()
      } else {
        setError(data.error || t.restoreError)
        setConfirming(false)
      }
    } finally {
      setBusy(false)
    }
  }

  if (isArchived === null) {
    return (
      <Card className="fx-spring">
        <SkeletonText lines={2} />
      </Card>
    )
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow">{isArchived ? t.restoreTitle : t.archiveTitle}</p>
      <p className="t-secondary" style={{ margin: '8px 0 14px' }}>
        {isArchived ? t.restoreDescription : t.archiveDescription}
      </p>

      {error && <p style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '10px' }}>{error}</p>}

      {!confirming ? (
        <Button
          variant={isArchived ? 'primary' : 'secondary'}
          onClick={() => setConfirming(true)}
        >
          {isArchived ? t.restoreBtn : t.archiveBtn}
        </Button>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {isArchived ? t.restoreConfirmText : t.archiveConfirmText}
          </p>
          <Button
            variant={isArchived ? 'primary' : 'danger'}
            size="sm"
            loading={busy}
            onClick={isArchived ? restore : archive}
          >
            {isArchived ? t.restoreConfirmBtn : t.archiveConfirmBtn}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{t.cancelBtn}</Button>
        </div>
      )}
    </Card>
  )
}
