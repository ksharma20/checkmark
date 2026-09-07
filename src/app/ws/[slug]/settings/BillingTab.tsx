'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Chip, Divider, Modal } from '@/components/ui'
import type { PlanLimits } from '@/lib/plans'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'

const t = en.wsSettings
const b = wsAdmin.billing

interface Props {
  slug: string
  plan: string
  planLimits: PlanLimits
}

/**
 * Billing - read only.
 *
 * There is NO payment integration in this codebase and none is being added
 * here: the plan is a column on the workspace row, and "Manage billing" is a
 * deliberate no-op that says so. Archiving and restoring live in this tab
 * because they are gated on the same resource (`ownership`, labelled
 * "Ownership & billing" in the catalogue), and this is the only tab the
 * Settings screen shows to owners alone.
 */
export default function BillingTab({ slug, plan, planLimits }: Props) {
  const router = useRouter()
  const [portalNoticeOpen, setPortalNoticeOpen] = useState(false)

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

  const includes = [
    b.maxUsers(planLimits.maxUsers),
    b.history(planLimits.historyMonths),
    b.locations(planLimits.maxLocations),
    planLimits.csvExport ? b.csvYes : b.csvNo,
  ]

  return (
    <>
      <Card className="fx-spring">
        <div className="row-between" style={{ flexWrap: 'wrap' }}>
          <div>
            <p className="t-eyebrow">{b.currentPlanLabel}</p>
            <p className="t-h1" style={{ marginTop: '6px', textTransform: 'capitalize' }}>{plan}</p>
          </div>
          <Chip tone="verified" style={{ textTransform: 'capitalize' }}>{plan}</Chip>
        </div>

        <Divider />

        <p className="t-eyebrow" style={{ marginBottom: '8px' }}>{b.limitsLabel}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack-sm">
          {includes.map((line) => (
            <li key={line} className="t-secondary" style={{ display: 'flex', gap: '8px' }}>
              <span aria-hidden style={{ color: 'var(--brand)' }}>·</span>
              {line}
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setPortalNoticeOpen(true)}>{b.manageBtn}</Button>
          <Link href="/pricing" className="t-secondary" style={{ color: 'var(--brand)', fontWeight: 600 }}>
            {b.comparePlans}
          </Link>
        </div>
        <p className="t-muted" style={{ marginTop: '10px' }}>{b.manageNote}</p>
      </Card>

      {isArchived !== null && (
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
      )}

      <Modal
        open={portalNoticeOpen}
        onClose={() => setPortalNoticeOpen(false)}
        title={b.manageBtn}
        footer={<Button size="sm" onClick={() => setPortalNoticeOpen(false)}>{t.cancelBtn}</Button>}
      >
        <p className="t-secondary">{b.manageNote}</p>
      </Modal>
    </>
  )
}
