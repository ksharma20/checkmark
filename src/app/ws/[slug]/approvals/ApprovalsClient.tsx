'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ApprovalItem } from '@/lib/approvals'
import type { ApprovalsResponse } from '@/app/api/ws/[slug]/approvals/route'
import { ApprovalRow } from '@/components/ws/ApprovalRow'
import { Card, EmptyState, Input, Skeleton, TabBar, type Tab } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props {
  slug: string
  /** `approvals:write` - read-only roles still see the queue, without actions. */
  canAction: boolean
}

type TypeFilter = 'all' | 'leave' | 'regularization' | 'doc'

const TYPE_FILTERS: Tab[] = [
  { key: 'all', label: en.wsApprovals.filterAll },
  { key: 'leave', label: en.wsApprovals.filterLeave },
  { key: 'regularization', label: en.wsApprovals.filterRegularization },
  { key: 'doc', label: wsAdmin.approvals.filterDocuments },
]

export default function ApprovalsClient({ slug, canAction }: Props) {
  const { show: showToast } = useToast()
  const [type, setType] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ type, ...(search ? { search } : {}) })
      const res = await fetch(`/api/ws/${slug}/approvals?${qs}`)
      if (!res.ok) { showToast(wsAdmin.approvals.loadFailed, 'error'); return }
      const data = (await res.json()) as ApprovalsResponse
      setItems(data.items ?? [])
      // The unfiltered total is what "N of M" compares against, so it is only
      // refreshed when no filter is applied.
      if (type === 'all' && !search) setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [slug, type, search, showToast])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function action(item: ApprovalItem, act: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/ws/${slug}/approvals/${item.kind}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, rejection_reason: rejectionReason }),
      })
      if (!res.ok) { showToast(wsAdmin.approvals.actionFailed, 'error'); return }
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.kind === item.kind)))
      setTotal((prev) => Math.max(0, prev - 1))
      setDecliningId(null)
    } finally {
      setBusyId(null)
    }
  }

  const noop = () => {}

  return (
    <div>
      <p className="t-secondary fx-spring" style={{ marginTop: '2px' }}>
        {wsAdmin.approvals.countOf(items.length, Math.max(total, items.length))}
      </p>

      <div
        className="fx-spring"
        style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', margin: '16px 0 14px' }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={en.wsApprovals.searchPlaceholder}
          style={{ maxWidth: '260px' }}
        />
        <TabBar tabs={TYPE_FILTERS} active={type} onChange={(key) => setType(key as TypeFilter)} />
      </div>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="stack" style={{ padding: '16px 20px' }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={52} radius="var(--radius-md)" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={en.wsApprovals.emptyTitle} hint={en.wsApprovals.emptyBody} />
        ) : (
          <div className="fx-spring-stagger">
            {items.map((item) => (
              <ApprovalRow
                key={`${item.kind}-${item.id}`}
                item={item}
                busy={busyId === item.id || !canAction}
                declining={decliningId === item.id}
                onApprove={canAction ? () => action(item, 'approve') : noop}
                onDeclineStart={canAction ? () => setDecliningId(item.id) : noop}
                onDeclineCancel={() => setDecliningId(null)}
                onDeclineConfirm={(reason) => action(item, 'reject', reason)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
