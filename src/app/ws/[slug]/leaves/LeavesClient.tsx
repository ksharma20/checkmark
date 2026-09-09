'use client'

import { useCallback, useEffect, useState } from 'react'
import { TabBar, type Tab } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsLeaveScreen } from '@/locales/en/ws-people'
import { wsParental } from '@/locales/en/ws-parental'
import LeaveAppliedTab from './LeaveAppliedTab'
import ParentalCasesTab from './ParentalCasesTab'
import type { LeaveRow } from './leave-shared'

type TabKey = 'applied' | 'maternity' | 'paternity'

interface Props {
  slug: string
  canWrite: boolean
  canReadEmployees: boolean
}

/**
 * The Leave screen: the applied-leave history, and the two parental case lists.
 *
 * There is deliberately NO pending-requests tab here any more. A leave request
 * awaiting a decision is actioned in exactly one place - /ws/:slug/approvals -
 * because the same item used to be approvable from here, from the Approvals
 * page and from the Overview widget, and three surfaces over one decision is
 * how an admin ends up approving something twice.
 *
 * Applied still LISTS pending rows (with a status filter); listing is not
 * actioning, and the history is the point of the tab.
 */
export default function LeavesClient({ slug, canWrite, canReadEmployees }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [tab, setTab] = useState<TabKey>('applied')
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

  const tabs: Tab[] = [
    { key: 'applied', label: wsLeaveScreen.tabApplied },
    { key: 'maternity', label: wsParental.tabMaternity },
    { key: 'paternity', label: wsParental.tabPaternity },
  ]

  return (
    <div>
      <h1 className="t-h1">{wsLeaveScreen.title}</h1>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={key => setTab(key as TabKey)}
        style={{ margin: '12px 0 16px' }}
      />

      {tab === 'applied' && (
        <LeaveAppliedTab rows={rows} loading={loading} />
      )}

      {/* One component, two case types. `key` remounts it on a tab change so
          the fetch, the stat cards and any open dialog belong to the tab you
          are looking at rather than being reused across the two. */}
      {(tab === 'maternity' || tab === 'paternity') && (
        <ParentalCasesTab
          key={tab}
          slug={slug}
          caseType={tab}
          canWrite={canWrite}
          canReadEmployees={canReadEmployees}
        />
      )}
    </div>
  )
}
