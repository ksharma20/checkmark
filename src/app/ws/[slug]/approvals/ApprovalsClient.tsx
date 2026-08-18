'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { ApprovalItem } from '@/lib/approvals'
import type { ApprovalsResponse } from '@/app/api/ws/[slug]/approvals/route'
import { ApprovalRow } from '@/components/ws/ApprovalRow'
import { en } from '@/locales/en'

interface Props { slug: string }

type TypeFilter = 'all' | 'leave' | 'regularization'

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: en.wsApprovals.filterAll },
  { key: 'leave', label: en.wsApprovals.filterLeave },
  { key: 'regularization', label: en.wsApprovals.filterRegularization },
]

export default function ApprovalsClient({ slug }: Props) {
  const [type, setType] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ type, ...(search ? { search } : {}) })
      const res = await fetch(`/api/ws/${slug}/approvals?${qs}`)
      const data = (await res.json()) as ApprovalsResponse
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [slug, type, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function action(item: ApprovalItem, act: 'approve' | 'reject', rejectionReason?: string) {
    setBusyId(item.id)
    try {
      await fetch(`/api/ws/${slug}/approvals/${item.kind}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, rejection_reason: rejectionReason }),
      })
      setItems((prev) => prev.filter((i) => !(i.id === item.id && i.kind === item.kind)))
      setDecliningId(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="fx-spring" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={en.wsApprovals.searchPlaceholder}
            style={{
              width: '100%', height: '38px', padding: '0 12px 0 34px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', color: 'var(--text-primary)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'var(--surface-2)', borderRadius: '10px' }}>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              style={{
                height: '30px', padding: '0 12px', borderRadius: '7px', border: 'none',
                background: type === t.key ? 'var(--surface-0)' : 'transparent',
                color: type === t.key ? 'var(--brand)' : 'var(--text-secondary)',
                boxShadow: type === t.key ? '0 1px 2px rgba(13,27,42,0.08)' : 'none',
                fontFamily: 'DM Sans, sans-serif', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px 20px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: '52px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
                backgroundSize: '400px 100%', animation: 'shimmer 1.4s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{en.wsApprovals.emptyTitle}</p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>{en.wsApprovals.emptyBody}</p>
          </div>
        ) : (
          <div className="fx-spring-stagger">
            {items.map((item) => (
              <ApprovalRow
                key={`${item.kind}-${item.id}`}
                item={item}
                busy={busyId === item.id}
                declining={decliningId === item.id}
                onApprove={() => action(item, 'approve')}
                onDeclineStart={() => setDecliningId(item.id)}
                onDeclineCancel={() => setDecliningId(null)}
                onDeclineConfirm={(reason) => action(item, 'reject', reason)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
