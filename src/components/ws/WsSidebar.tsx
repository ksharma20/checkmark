'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, BarChart2, Calendar, CalendarDays, CalendarOff, ClipboardCheck,
  FileText, SlidersHorizontal, ShieldCheck, Laptop, UserCheck, Network,
} from 'lucide-react'
import { en } from '@/locales/en'
import { Logo } from "@/components/ui";
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
 */
const SCREEN_ICONS: Record<Screen, React.ReactNode> = {
  [Screen.Overview]:   <LayoutDashboard size={18} />,
  [Screen.Organisation]: <Network size={18} />,
  [Screen.Assets]:     <Laptop size={18} />,
  [Screen.Attendance]: <UserCheck size={18} />,
  [Screen.Leave]:      <CalendarOff size={18} />,
  [Screen.Holidays]:   <CalendarDays size={18} />,
  [Screen.Approvals]:  <ClipboardCheck size={18} />,
  [Screen.People]:     <Users size={18} />,
  [Screen.Analytics]:  <BarChart2 size={18} />,
  [Screen.Activity]:   <Calendar size={18} />,
  [Screen.Reports]:    <FileText size={18} />,
  [Screen.Roles]:      <ShieldCheck size={18} />,
  [Screen.Settings]:   <SlidersHorizontal size={18} />,
}

const SCREEN_LABELS: Record<Screen, string> = en.wsNav.screens
const GROUP_LABELS: Record<ScreenGroup, string> = en.wsNav.groups

/** Screens that carry a pending-count badge, and which count they read. */
const SCREEN_BADGES: Partial<Record<Screen, 'leave' | 'approvals'>> = {
  [Screen.Leave]: 'leave',
  [Screen.Approvals]: 'approvals',
}

interface Props {
  slug: string
  leavesEnabled: boolean
  pendingLeaveCount: number
  pendingApprovalsCount: number
  userName: string
  /** Display name of the role, e.g. "Owner". Never the raw key. */
  userRoleName: string
  /** Resources this role can read - drives which screens are shown. */
  readableResources: Resource[]
}

/**
 * The `.sidebar` half of `.shell-ws`.
 *
 * Every element below is a DIRECT child of `.sidebar` on purpose: at ≤860px the
 * stylesheet turns `.sidebar` into a horizontally scrolling tab strip, and a
 * wrapper element around the nav items would collapse the whole strip into one
 * flex item. That is also why this file adds no responsive JS - the breakpoint
 * is handled entirely in globals.css.
 */
export default function WsSidebar({
  slug, leavesEnabled, pendingLeaveCount, pendingApprovalsCount,
  userName, userRoleName, readableResources,
}: Props) {
  const pathname = usePathname()

  // Feature switches and permission both applied by the registry, so the
  // sidebar and the server can never disagree about which screens exist.
  const screenGroups = visibleScreenGroups({ readableResources, leavesEnabled })

  return (
    <nav className="sidebar" aria-label={wsAdmin.shell.navLabel}>
      {/* The asset IS the wordmark - a pin followed by "checkmark" - so there is
            no text beside it. Rendering both printed the name twice. It is also
            not decorative for the same reason: with no adjacent text, the alt
            is the only thing that names the product to a screen reader. */}
      <Logo height={50} width={150} />

      {screenGroups.map(({ group, screens }, groupIndex) => (
        <div key={group} style={{ display: "contents" }}>
          <p
            className="t-eyebrow"
            style={{
              margin: groupIndex === 0 ? "2px 12px 6px" : "18px 12px 6px",
            }}
          >
            {GROUP_LABELS[group]}
          </p>
          {screens.map((screen) => {
            const href = screenHref(slug, screen);
            const isActive =
              screen.path === ""
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
            const badge = SCREEN_BADGES[screen.key];
            const badgeCount =
              badge === "leave"
                ? pendingLeaveCount
                : badge === "approvals"
                  ? pendingApprovalsCount
                  : 0;

            return (
              <Link
                key={href}
                href={href}
                className={["navitem", isActive && "active"]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="ic" aria-hidden>
                  {SCREEN_ICONS[screen.key]}
                </span>
                {SCREEN_LABELS[screen.key]}
                {badgeCount > 0 && (
                  <span className="navbadge">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
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
  );
}
