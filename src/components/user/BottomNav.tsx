'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { me } from '@/locales/en/me'

/**
 * The `/me` bottom navigation: three tabs, Home in the centre.
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
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/me/leave',
    label: me.nav.leave,
    prefix: true,
    icon: (
      <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
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
            className={`me-navitem pressable${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
