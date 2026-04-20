'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, BarChart2, Calendar, Bell, Settings,
  PanelLeftOpen, PanelLeftClose, LayoutGrid, User,
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '',           label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/people',    label: 'People',    icon: <Users size={18} /> },
  { path: '/insights',  label: 'Analytics', icon: <BarChart2 size={18} /> },
  { path: '/monthly',   label: 'Activity',  icon: <Calendar size={18} /> },
  { path: '/disputes',  label: 'Alerts',    icon: <Bell size={18} /> },
  { path: '/settings',  label: 'Settings',  icon: <Settings size={18} /> },
]

interface Props {
  slug: string
}

export default function WsSidebar({ slug }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isMobile) setCollapsed(true)
  }, [pathname, isMobile])

  const sidebarBg = `
    radial-gradient(ellipse at 20% 10%, rgba(27,77,255,0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 80%, rgba(0,212,170,0.10) 0%, transparent 50%),
    linear-gradient(160deg, #1E2D3D 0%, #0D1B2A 50%, #0A1520 100%)
  `

  const mobileExpanded = isMobile && !collapsed

  return (
    <>
      {mobileExpanded && (
        <div
          onClick={() => setCollapsed(true)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 39 }}
        />
      )}

      <aside
        className="ws-sidebar"
        style={{
          position: mobileExpanded ? 'fixed' : 'relative',
          top: mobileExpanded ? 0 : undefined,
          left: mobileExpanded ? 0 : undefined,
          width: isMobile ? (collapsed ? '62px' : '100vw') : (collapsed ? '62px' : '220px'),
          minWidth: isMobile ? (collapsed ? '62px' : undefined) : (collapsed ? '62px' : '220px'),
          background: sidebarBg,
          display: 'flex', flexDirection: 'column',
          height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
          flexShrink: 0, zIndex: 40,
          transition: 'width 0.22s ease, min-width 0.22s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0 10px', height: '64px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0, gap: '8px',
        }}>
          {!collapsed && (
            <img src="/logo.png" alt="CheckMark" className="ws-sidebar-logo"
              style={{ height: '32px', width: 'auto', flexShrink: 0 }} />
          )}
          <button
            type="button"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              width: '32px', height: '32px', flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {collapsed
              ? <PanelLeftOpen size={15} />
              : <PanelLeftClose size={15} />
            }
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {NAV_ITEMS.map(({ path, label, icon }) => {
            const href = `/ws/${slug}${path}`
            const isActive = path === ''
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: '8px', marginBottom: '2px',
                  background: isActive ? 'rgba(0,212,170,0.13)' : 'transparent',
                  color: isActive ? '#00D4AA' : 'rgba(255,255,255,0.62)',
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  borderLeft: isActive && !collapsed ? '3px solid #00D4AA' : '3px solid transparent',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}
              >
                <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
                {!collapsed && <span className="ws-sidebar-label">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom links — expanded */}
        {!collapsed && (
          <div className="ws-sidebar-bottom" style={{
            padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '2px',
          }}>
            <Link href="/ws" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12px',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <LayoutGrid size={14} />
              Workspaces
            </Link>
            <Link href="/me" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'DM Sans, sans-serif', fontSize: '12px',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <User size={14} />
              My Profile
            </Link>
          </div>
        )}

        {/* Bottom links — collapsed (icon only) */}
        {collapsed && (
          <div style={{
            padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
          }}>
            <Link href="/ws" title="Workspaces" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '38px', height: '38px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)', textDecoration: 'none',
            }}>
              <LayoutGrid size={15} />
            </Link>
            <Link href="/me" title="My Profile" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '38px', height: '38px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)', textDecoration: 'none',
            }}>
              <User size={15} />
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
