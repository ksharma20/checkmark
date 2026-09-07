'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ApprovalItem } from '@/lib/approvals'
import { ApprovalRow } from '@/components/ws/ApprovalRow'
import { Card, Chip, SkeletonText } from '@/components/ui'
import { en } from '@/locales/en'

// ─── Regularization requests (pending queue, echoed from the Approvals page) ──

export default function RegularizationRequestsSection({ slug }: { slug: string }) {
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals?type=regularization`)
      if (res.ok) {
        const data = await res.json()
        setItems((data.items ?? []) as ApprovalItem[])
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  async function action(id: string, act: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/regularization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, rejection_reason: rejectionReason }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
        setDecliningId(null)
      }
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && items.length === 0) return null

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <div className="row-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <p className="t-h2">{en.wsPeople.regularizationSectionTitle}</p>
        {!!items.length && <Chip tone="partial">{items.length}</Chip>}
      </div>
      {loading ? (
        <div style={{ padding: '16px 20px' }}><SkeletonText lines={2} /></div>
      ) : (
        items.map((item) => (
          <ApprovalRow
            key={item.id}
            item={item}
            busy={busyId === item.id}
            declining={decliningId === item.id}
            onApprove={() => action(item.id, 'approve')}
            onDeclineStart={() => setDecliningId(item.id)}
            onDeclineCancel={() => setDecliningId(null)}
            onDeclineConfirm={(reason) => action(item.id, 'reject', reason)}
          />
        ))
      )}
    </Card>
  )
}
