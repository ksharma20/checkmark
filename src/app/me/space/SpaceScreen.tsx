'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { TabBar, type Tab } from '@/components/ui'
import { meSpace } from '@/locales/en/me-space'
import NotesTab from './NotesTab'
import TodosTab from './TodosTab'
import FocusTab, { type FocusSeed } from './FocusTab'

/**
 * The four tabs of `/me/space`.
 *
 * NO WORKSPACE PICKER, and not because one was forgotten: three of the four tabs
 * read tables with no `workspace_id` in them, and the fourth resolves the active
 * workspace on the SERVER, from the same cookie the top-bar pill writes. The
 * pill is the only selector on this surface and this screen adds none.
 *
 * `insights` arrives as an already-rendered SERVER node rather than as a
 * component this file imports. That is what keeps the presence-event read - and
 * `lib/db` with it - out of the browser bundle while still letting a client
 * component decide when it is on screen. React mounts and unmounts the node like
 * any other child; it is just markup by the time it gets here.
 *
 * Each tab owns its own fetching. There is no shared store, because the only
 * thing that genuinely crosses a tab boundary is "start a focus session on this
 * task" - one value, handed over once, held here.
 */

type TabKey = 'notes' | 'todos' | 'focus' | 'insights'

const TABS: Tab[] = [
  { key: 'notes', label: meSpace.tabNotes },
  { key: 'todos', label: meSpace.tabTodos },
  { key: 'focus', label: meSpace.tabFocus },
  { key: 'insights', label: meSpace.tabInsights },
]

export default function SpaceScreen({ insights }: { insights: ReactNode }) {
  const [tab, setTab] = useState<TabKey>('notes')

  /**
   * The one piece of state two tabs share: a task the member pressed play on.
   *
   * It is a seed, not a binding - Focus copies it into its own fields and the
   * member may change either before starting. Holding it here rather than in
   * Focus is what lets the hand-off happen while Focus is still unmounted.
   */
  const [focusSeed, setFocusSeed] = useState<FocusSeed | null>(null)

  const startFocus = useCallback((seed: FocusSeed) => {
    setFocusSeed(seed)
    setTab('focus')
  }, [])

  return (
    <div className="stack">
      <div>
        <h1 className="t-h1">{meSpace.title}</h1>
        <p className="t-muted space-mt-6">{meSpace.subtitle}</p>
      </div>

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={(key) => setTab(key as TabKey)}
        className="space-tabbar"
      />

      {tab === 'notes' ? <NotesTab /> : null}
      {tab === 'todos' ? <TodosTab onStartFocus={startFocus} /> : null}
      {tab === 'focus' ? <FocusTab seed={focusSeed} onSeedUsed={() => setFocusSeed(null)} /> : null}
      {tab === 'insights' ? insights : null}
    </div>
  )
}
