'use client'

import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsLeaveScreen } from '@/locales/en/ws-people'
import LeaveAppliedTab from './LeaveAppliedTab'
import LeaveRequestsTab from './LeaveRequestsTab'
import MaternityTab from './MaternityTab'
import type { LeaveRow } from './leave-shared'

type TabKey = 'requests' | 'applied' | 'maternity'

interface Props {
  slug: string
  canWrite: boolean
  canReadEmployees: boolean
}

/**
 * The Leave screen: one fetch, three views of it.
 *
 * Requests and Applied read the same `leaveRequests` payload, so it is loaded
 * once here and an approval updates the row in place - switching tabs after
 * approving must not show the stale queue. Maternity is a different table
 * entirely and owns its own fetch.
 */
export default function LeavesClient({ slug, canWrite, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [tab, setTab] = useState<TabKey>('requests')
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ws/${slug}/leaves`)
      if (!res.ok) { toast(wsLeaveScreen.loadFailed, 'error'); return }
      const data = await res.json() as { leaveRequests: LeaveRow[] }
      setRows(data.leaveRequests ?? [])
    } finally {
      setLoading(false)
    }
  }, [slug, toast])

  useEffect(() => { void load() }, [load])

  const pendingCount = rows.filter(r => r.status === 'pending').length

  const tabs: Tab[] = [
    { key: 'requests', label: wsLeaveScreen.tabRequests, badge: pendingCount },
    { key: 'applied', label: wsLeaveScreen.tabApplied },
    { key: 'maternity', label: wsLeaveScreen.tabMaternity },
  ]

  function onActioned(id: string, status: 'approved' | 'rejected', reason: string | null) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status, rejection_reason: reason } : r)))
  }

  return (
    <div>
      <h1 className="t-h1">{wsLeaveScreen.title}</h1>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={key => setTab(key as TabKey)}
        style={{ margin: '12px 0 16px' }}
      />

      {tab === 'requests' && (
        <LeaveRequestsTab
          slug={slug}
          rows={rows}
          loading={loading}
          canWrite={canWrite}
          onActioned={onActioned}
        />
      )}

      {tab === 'applied' && (
        <LeaveAppliedTab rows={rows} loading={loading} />
      )}

      {tab === 'maternity' && (
        <MaternityTab slug={slug} canWrite={canWrite} canReadEmployees={canReadEmployees} />
      )}
    </div>
  )
}
