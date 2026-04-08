'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { path: '',          label: 'Dashboard' },
  { path: '/people',   label: 'People' },
  { path: '/insights', label: 'Insights' },
  { path: '/monthly',  label: 'Monthly' },
  { path: '/disputes', label: 'Disputes' },
  { path: '/settings', label: 'Settings' },
]

export default function NavTabs({ slug }: { slug: string }) {
  const pathname = usePathname()

  return (
    <nav className="scroll-x" style={{ display: 'flex', padding: '0 16px', gap: '2px' }}>
      {TABS.map(({ path, label }) => {
        const href = `/ws/${slug}${path}`
        // Dashboard is exact match; others are prefix match
        const isActive = path === ''
          ? pathname === href
          : pathname === href || pathname.startsWith(href + '/')

        return (
          <Link
            key={href}
            href={href}
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '10px 12px',
              borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
              display: 'block',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
