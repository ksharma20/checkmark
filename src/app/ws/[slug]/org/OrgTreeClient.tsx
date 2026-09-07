'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react'
import { Avatar, Button, Card, EmptyState, Input, SkeletonText } from '@/components/ui'
import { buildReportingTree, ancestorsOf, type ReportingTree } from '@/lib/hierarchy'
import { personColor } from '@/lib/workspace-color'
import { wsOrg } from '@/locales/en/ws-people'

interface HierarchyMember {
  userId: string
  name: string
  email: string
  role: string
  managerUserId: string | null
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 1.4
const ZOOM_STEP = 0.1

/**
 * The org chart, hand-rolled.
 *
 * No layout library. A strict tree needs no edge routing that avoids nodes,
 * which is the only thing a graph engine would buy here - the connectors are
 * four `::before`/`::after` borders and the browser's own flex layout does the
 * rest. `src/components/ui/index.ts` records that the absence of a charting
 * dependency is deliberate; this follows it.
 *
 * The tree is built by `src/lib/hierarchy.ts`, the same pure module the server
 * uses to decide whether a reporting change would create a loop. Reusing it
 * means the picture and the write guard can never disagree about who is under
 * whom - including the roll-up that puts everyone unassigned under the owner.
 */
export default function OrgTreeClient({ slug, viewerUserId }: { slug: string; viewerUserId: string }) {
  const router = useRouter()

  const [members, setMembers] = useState<HierarchyMember[]>([])
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [query, setQuery] = useState('')

  const viewportRef = useRef<HTMLDivElement>(null)
  const matchRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ws/${slug}/hierarchy`)
        if (cancelled) return
        if (!res.ok) { setFailed(true); return }
        const data = await res.json() as { members: HierarchyMember[]; ownerUserId: string | null }
        setMembers(data.members ?? [])
        setOwnerUserId(data.ownerUserId ?? null)
      } finally {
        // A rejected fetch must not leave a skeleton on screen forever - the
        // empty state below says "could not load" rather than pretending the
        // workspace has nobody in it.
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  const byId = useMemo(
    () => new Map(members.map(m => [m.userId, m])),
    [members],
  )

  const tree: ReportingTree = useMemo(
    () => buildReportingTree(
      members.map(m => ({ userId: m.userId, managerUserId: m.managerUserId })),
      ownerUserId,
    ),
    [members, ownerUserId],
  )

  /**
   * The roots to render.
   *
   * Normally exactly one - the owner. But a workspace whose owner row is
   * missing (an ownership transfer mid-flight, or a seed that never ran) has no
   * root to roll up to, and every unassigned member is then their own root. The
   * chart says so by drawing them all rather than rendering nothing.
   */
  const roots = useMemo(
    () => members.filter(m => (tree.parentOf.get(m.userId) ?? null) === null).map(m => m.userId),
    [members, tree],
  )

  const match = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return members.find(m =>
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    ) ?? null
  }, [query, members])

  // Reveal the match by un-collapsing its ancestors, then centre it. This is
  // the one place the upward walk earns its keep in the UI - the same function
  // the notification fan-out would use.
  useEffect(() => {
    if (!match) return
    setCollapsed(prev => {
      const chain = ancestorsOf(tree, match.userId)
      if (!chain.some(id => prev.has(id))) return prev
      const next = new Set(prev)
      for (const id of chain) next.delete(id)
      return next
    })
  }, [match, tree])

  useEffect(() => {
    if (!match) return
    const t = setTimeout(() => {
      matchRef.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    }, 60)
    return () => clearTimeout(t)
  }, [match, collapsed])

  const toggle = useCallback((userId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  function renderNode(userId: string, depth: number) {
    const member = byId.get(userId)
    if (!member) return null
    const children = tree.childrenOf.get(userId) ?? []
    const isCollapsed = collapsed.has(userId)
    const isMatch = match?.userId === userId

    return (
      <div className="org-node" key={userId}>
        <button
          type="button"
          ref={isMatch ? matchRef : undefined}
          className={[
            'org-card',
            depth === 0 && 'is-root',
            isMatch && 'is-match',
          ].filter(Boolean).join(' ')}
          onClick={() => router.push(`/ws/${slug}/people?search=${encodeURIComponent(member.email)}`)}
          aria-label={wsOrg.openPerson(member.name)}
        >
          <Avatar name={member.name} color={personColor(member.userId)} />
          <span className="org-card-body">
            <span className="org-card-name">
              {member.name}
              {member.userId === viewerUserId && ` ${wsOrg.youSuffix}`}
            </span>
            <span className="org-card-meta">
              {children.length > 0 ? wsOrg.reportCount(children.length) : member.email}
            </span>
          </span>
        </button>

        {children.length > 0 && (
          <button type="button" className="org-toggle" onClick={() => toggle(userId)}>
            {isCollapsed
              ? <><ChevronRight size={12} aria-hidden />{wsOrg.expand(children.length)}</>
              : <><ChevronDown size={12} aria-hidden />{wsOrg.collapse}</>}
          </button>
        )}

        {children.length > 0 && !isCollapsed && (
          <div className="org-node-children">
            {children.map(childId => (
              <div className="org-child" key={childId}>
                {renderNode(childId, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card padded={false} className="overflow-hidden mt-16">
      <div className="org-toolbar">
        <Input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={wsOrg.searchPlaceholder}
          aria-label={wsOrg.searchPlaceholder}
          className="filter-search"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          disabled={zoom <= ZOOM_MIN}
          icon={<Minus size={14} />}
          aria-label={wsOrg.zoomOut}
        />
        <span className="org-zoom-label">{Math.round(zoom * 100)}%</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          disabled={zoom >= ZOOM_MAX}
          icon={<Plus size={14} />}
          aria-label={wsOrg.zoomIn}
        />
        <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
          {wsOrg.expandAll}
        </Button>
      </div>

      {loading ? (
        <div className="pad-list"><SkeletonText lines={5} /></div>
      ) : failed ? (
        <EmptyState title={wsOrg.loadFailed} hint={wsOrg.loadFailedHint} />
      ) : roots.length === 0 ? (
        <EmptyState title={wsOrg.emptyTitle} hint={wsOrg.emptyHint} />
      ) : (
        <div className="org-viewport" ref={viewportRef}>
          {/* The zoom step is a data attribute, not an inline style object.
              A `--org-zoom` written here would sit outside globals.css and so
              outside the reduced-motion and touch-target selector lists that
              govern this component (invariant 15). Ten discrete steps is what
              the buttons produce anyway, so the stylesheet can hold them all. */}
          <div className="org-canvas" data-zoom={Math.round(zoom * 100)}>
            {roots.map(id => renderNode(id, 0))}
          </div>
        </div>
      )}
    </Card>
  )
}
