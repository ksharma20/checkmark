'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { RefObject } from 'react'
import {
  Activity, BarChart2, CheckCircle, Clock, Flag, LayoutDashboard, Laptop, Network,
  PanelLeftClose, PanelLeftOpen, Plane, ShieldCheck, SlidersHorizontal, Users, FileText,
} from 'lucide-react'
import { en } from '@/locales/en'
import { Logo } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-overview'
import WsAccountMenu from './WsAccountMenu'
import type { Resource } from '@/lib/permissions/catalogue'
import {
  Screen,
  ScreenGroup,
  screenHref,
  visibleScreenGroups,
} from '@/lib/permissions/screens'

/**
 * Which screens exist, where they live and which permission each needs is the
 * registry's business (src/lib/permissions/screens.ts). All the sidebar owns
 * is how they LOOK: an icon per screen and a label per screen.
 *
 * Both maps are `Record<Screen, …>`, so adding a screen to the registry
 * without an icon or a label fails the build instead of rendering a blank row.
 *
 * **Every glyph has to be legible on its own.** In the 64px rail the label is
 * removed from the visual (it stays in the accessibility tree), so the icon is
 * the only thing distinguishing one screen from another. Three of these used to
 * be calendar variants - Leave `CalendarOff`, Holidays `CalendarDays`, Activity
 * `Calendar` - and Attendance/Approvals were both check marks. Stacked in a
 * label-less column they were indistinguishable. Pick a glyph that survives
 * that test, not just one that reads well beside its own label.
 */
const SCREEN_ICONS: Record<Screen, React.ReactNode> = {
  [Screen.Overview]:     <LayoutDashboard size={18} />,
  [Screen.Organisation]: <Network size={18} />,
  [Screen.Assets]:       <Laptop size={18} />,
  [Screen.Attendance]:   <Clock size={18} />,
  [Screen.Leave]:        <Plane size={18} />,
  [Screen.Holidays]:     <Flag size={18} />,
  [Screen.Approvals]:    <CheckCircle size={18} />,
  [Screen.People]:       <Users size={18} />,
  [Screen.Analytics]:    <BarChart2 size={18} />,
  [Screen.Activity]:     <Activity size={18} />,
  [Screen.Reports]:      <FileText size={18} />,
  [Screen.Roles]:        <ShieldCheck size={18} />,
  [Screen.Settings]:     <SlidersHorizontal size={18} />,
}

const SCREEN_LABELS: Record<Screen, string> = en.wsNav.screens
const GROUP_LABELS: Record<ScreenGroup, string> = en.wsNav.groups

/**
 * Screens that carry a pending-count badge, and which count they read.
 *
 * Approvals is the only one, deliberately: it is the ONE screen from which a
 * pending item can be actioned, and its count is leave + regularization. Leave
 * used to carry its own badge pointing at a Requests tab that no longer exists
 * - a badge whose destination cannot action anything is worse than no badge.
 */
const SCREEN_BADGES: Partial<Record<Screen, 'approvals'>> = {
  [Screen.Approvals]: 'approvals',
}

interface Props {
  slug: string
  /** 64px icon rail instead of the 228px column. Only expressed at ≥861px. */
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Closes the ≤860px drawer. A tap on a link must not leave it covering the
   *  page it just navigated to. */
  onNavigate: () => void
  /** The shell's overlay panel ref - `useOverlay` focuses and traps on it while
   *  the drawer is open. Passed as an ordinary prop because no component in
   *  this repo forwards a ref (see docs/design/components.md). */
  navRef: RefObject<HTMLElement | null>
  leavesEnabled: boolean
  /** Leave + regularization, both actioned on /ws/:slug/approvals. */
  pendingApprovalsCount: number
  userName: string
  /** Display name of the role, e.g. "Owner". Never the raw key. */
  userRoleName: string
  /** Resources this role can read - drives which screens are shown. */
  readableResources: Resource[]
}

/**
 * The `.sidebar` half of `.shell-ws`, at every width.
 *
 * Every nav element below is a DIRECT child of `.sidebar` (the group wrappers
 * are `display: contents`), which the stylesheet relies on. This file adds no
 * responsive JS: which of the three presentations is on screen - 228px column,
 * 64px rail, or off-canvas drawer - is entirely a matter of the breakpoint and
 * the two `data-` attributes the shell sets on `.shell-ws`.
 */
export default function WsSidebar({
  slug, collapsed, onToggleCollapsed, onNavigate, navRef, leavesEnabled,
  pendingApprovalsCount, userName, userRoleName, readableResources,
}: Props) {
  const pathname = usePathname()

  // Feature switches and permission both applied by the registry, so the
  // sidebar and the server can never disagree about which screens exist.
  const screenGroups = visibleScreenGroups({ readableResources, leavesEnabled })

  return (
    <nav
      id="ws-sidebar"
      ref={navRef}
      className="sidebar"
      aria-label={wsAdmin.shell.navLabel}
      tabIndex={-1}
    >
      <div className="sidebar-head">
        {/* Two marks, one visible at a time. The wordmark is a 16:9 lockup - a
            pin followed by "venzio" - and there is no width for it in a 64px
            rail, so the rail shows `icon-192.png`, which is that same pin on
            its own. Both are always rendered and the stylesheet picks; swapping
            the `src` would re-request an image on every toggle. */}
        <span className="sidebar-wordmark">
          <Logo height={50} width={150} />
        </span>
        <Image
          className="sidebar-mark"
          src="/icon-192.png"
          alt={en.brand.name}
          width={28}
          height={28}
          priority
        />

        {/* ≥861px only. At ≤860px the sidebar is an overlay with no width to
            trade, so the topbar's hamburger is the only control. */}
        <button
          type="button"
          className="icon-btn icon-btn-plain nav-rail-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? wsAdmin.shell.expandNav : wsAdmin.shell.collapseNav}
          title={collapsed ? wsAdmin.shell.expandNav : wsAdmin.shell.collapseNav}
          aria-expanded={!collapsed}
          aria-controls="ws-sidebar"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {screenGroups.map(({ group, screens }, groupIndex) => (
        <div key={group} style={{ display: 'contents' }}>
          <p
            className={['t-eyebrow', 'sidebar-group-label', groupIndex === 0 && 'is-first']
              .filter(Boolean)
              .join(' ')}
          >
            {GROUP_LABELS[group]}
          </p>
          {screens.map((screen) => {
            const href = screenHref(slug, screen)
            const isActive =
              screen.path === ''
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`)
            const badge = SCREEN_BADGES[screen.key]
            const badgeCount = badge === 'approvals' ? pendingApprovalsCount : 0
            const label = SCREEN_LABELS[screen.key]

            return (
              <Link
                key={href}
                href={href}
                className={['navitem', isActive && 'active'].filter(Boolean).join(' ')}
                aria-current={isActive ? 'page' : undefined}
                onClick={onNavigate}
                // The rail's only affordance for a label. `title` needs hover,
                // which is why the icons above must stand alone regardless.
                title={collapsed ? label : undefined}
              >
                <span className="ic" aria-hidden>
                  {SCREEN_ICONS[screen.key]}
                </span>
                {/* `.navitem-label` is hidden VISUALLY in the rail, never with
                    `display: none` - the accessible name of the link has to
                    survive the collapse. */}
                <span className="navitem-label">{label}</span>
                {badgeCount > 0 && (
                  <span className="navbadge">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="sidebar-foot">
        <WsAccountMenu
          slug={slug}
          userName={userName}
          userRoleName={userRoleName}
          variant="sidebar"
        />
      </div>
    </nav>
  )
}
