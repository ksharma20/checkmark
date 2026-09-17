'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { me } from '@/locales/en/me'
import { meSpace } from '@/locales/en/me-space'

/**
 * The `/me` bottom navigation: three tabs, Home raised among them.
 *
 * It was THREE, and CLAUDE.md described that as deliberate. The reason it is now
 * four is that `/me/space` is a destination rather than a detail: notes, to-dos
 * and a focus timer are things a member opens several times a day and cannot
 * reach from anything already on screen. The avatar sheet - where Orgs,
 * Documents, Announcements and Settings live - is the right home for a screen
 * you visit occasionally, and the wrong one for a screen you visit constantly.
 * LEAVE IS NOT HERE, and that is the rule this bar follows: every tab must work
 * for every member. Leave only exists inside a workspace and only when that
 * workspace has it switched on, so as a tab it was dead for anyone with no
 * workspace and for any workspace that does not run leave through CheckMark. It
 * lives on `/me` home now, in the part of the page that is already scoped to the
 * active workspace, where its absence is self-explanatory.
 *
 * `/me/orgs`, `/me/settings` and `/me/notifications` are deliberately NOT tabs
 * any more — they stay reachable by URL and from the profile sheet in
 * `MeTopbar`. Nothing here fetches: the tab set is fixed for every member, so
 * the old `/api/me` round-trip that decided whether to show an "Orgs" tab is
 * gone.
 */

interface NavItem {
  href: string
  label: string
  /** True when the tab owns every route beneath its href, not just the href. */
  prefix: boolean
  /**
   * The one raised tab. Home is where a member checks in - the single action
   * this surface exists for - and as a third identical 10.5px label it read as
   * a peer of Timeline and Leave. It is a disc that breaks the bar's top edge
   * instead, so the thumb has an unmissable target it does not have to aim at.
   */
  primary?: boolean
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/me/timeline',
    label: me.nav.timeline,
    prefix: true,
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="9" y1="6" x2="21" y2="6" />
        <line x1="9" y1="12" x2="21" y2="12" />
        <line x1="9" y1="18" x2="21" y2="18" />
        <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/me',
    label: me.nav.home,
    prefix: false,
    primary: true,
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/me/space',
    label: meSpace.navLabel,
    prefix: true,
    // A four-square grid - the one glyph in this bar that is not a list, a house
    // or a calendar, so it stays distinguishable at 20px without its label.
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="me-bottomnav" aria-label={me.nav.label}>
      {NAV_ITEMS.map((item) => {
        const active = item.prefix
          ? pathname === item.href || pathname.startsWith(`${item.href}/`)
          : pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`me-navitem pressable${item.primary ? ' is-primary' : ''}${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.primary ? <span className="me-navdisc">{item.icon}</span> : item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
