'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, BarChart2, Calendar, CalendarDays, CalendarOff, ClipboardCheck,
  FileText, SlidersHorizontal, PanelLeftOpen, PanelLeftClose, LayoutGrid, User, LogOut,
  ChevronDown, ShieldCheck,
} from 'lucide-react'
import { en } from '@/locales/en'
import type { Resource } from '@/lib/permissions/catalogue'
import {
  Screen,
  ScreenGroup,
  SubScreen,
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
  [Screen.Overview]:  <LayoutDashboard size={18} />,
  [Screen.Employees]: <Users size={18} />,
  [Screen.Analytics]: <BarChart2 size={18} />,
  [Screen.Activity]:  <Calendar size={18} />,
  [Screen.Holidays]:  <CalendarDays size={18} />,
  [Screen.Leave]:     <CalendarOff size={18} />,
  [Screen.Approvals]: <ClipboardCheck size={18} />,
  [Screen.Reports]:   <FileText size={18} />,
  [Screen.Roles]:     <ShieldCheck size={18} />,
  [Screen.Settings]:  <SlidersHorizontal size={18} />,
}

const SCREEN_LABELS: Record<Screen, string> = en.wsNav.screens
const GROUP_LABELS: Record<ScreenGroup, string> = en.wsNav.groups
const SUB_SCREEN_LABELS: Record<SubScreen, string> = en.wsNav.subScreens

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

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    const base = parts[0].includes('@') ? parts[0].split('@')[0] : parts[0]
    return base.slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function WsSidebar({ slug, leavesEnabled, pendingLeaveCount, pendingApprovalsCount, userName, userRoleName, readableResources }: Props) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [leaveExpanded, setLeaveExpanded] = useState(false)

  // Feature switches and permission both applied by the registry, so the
  // sidebar and the server can never disagree about which screens exist.
  const screenGroups = visibleScreenGroups({ readableResources, leavesEnabled })

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

  async function signOut() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const sidebarBg = `
    radial-gradient(ellipse at 20% 10%, rgba(29,158,117,0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 80%, rgba(0,212,170,0.10) 0%, transparent 50%),
    linear-gradient(160deg, #0f2a1e 0%, #0d2118 50%, #081a12 100%)
  `

  const mobileExpanded = isMobile && !collapsed
  const initials = getInitials(userName)
  // Render the role's display name as stored. Capitalising the key would show
  // a role keyed `hr-manager` as "Hr-manager".
  const roleLabel = userRoleName

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
          width: isMobile ? (collapsed ? '62px' : '100vw') : (collapsed ? '62px' : '230px'),
          minWidth: isMobile ? (collapsed ? '62px' : undefined) : (collapsed ? '62px' : '230px'),
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              <img src="/logo.png" alt="Venzio" className="ws-sidebar-logo"
                style={{ height: '32px', width: 'auto', flexShrink: 0 }} />
              <span style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: '#00D4AA', background: 'rgba(0,212,170,0.13)',
                border: '1px solid rgba(0,212,170,0.35)',
                borderRadius: '999px', padding: '3px 7px', flexShrink: 0,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                HRMS
              </span>
            </div>
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

        {/* Nav groups */}
        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {screenGroups.map(({ group, screens }, groupIndex) => (
            <div key={group}>
              {!collapsed && (
                <p style={{
                  fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.3)',
                  margin: groupIndex === 0 ? '4px 12px 6px' : '18px 12px 6px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  {GROUP_LABELS[group]}
                </p>
              )}
              {collapsed && groupIndex > 0 && (
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '8px 10px' }} />
              )}
              {screens.map((screen) => {
                const { key, path, subScreens } = screen
                const label = SCREEN_LABELS[key]
                const href = screenHref(slug, screen)
                const isActive = path === ''
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + '/')
                const hasSubItems = !!subScreens && subScreens.length > 0 && !collapsed
                const badge = SCREEN_BADGES[key]
                const badgeCount = badge === 'leave'
                  ? pendingLeaveCount
                  : badge === 'approvals' ? pendingApprovalsCount : 0
                const showBadge = badgeCount > 0

                const rowContent = (
                  <>
                    <span style={{ flexShrink: 0, display: 'flex' }}>{SCREEN_ICONS[key]}</span>
                    {!collapsed && <span className="ws-sidebar-label" style={{ flex: 1 }}>{label}</span>}
                    {!collapsed && showBadge && (
                      <span style={{
                        minWidth: '16px', height: '16px', borderRadius: '999px',
                        background: 'var(--danger)', color: '#fff',
                        fontSize: '10px', fontWeight: 700, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', flexShrink: 0,
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                      }}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {!collapsed && hasSubItems && (
                      <ChevronDown
                        size={14}
                        style={{
                          flexShrink: 0,
                          transition: 'transform 0.15s',
                          transform: leaveExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                    )}
                  </>
                )

                const rowStyle: React.CSSProperties = {
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '10px', width: '100%',
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: '8px', marginBottom: '2px',
                  background: isActive ? 'rgba(0,212,170,0.13)' : 'transparent',
                  color: isActive ? '#00D4AA' : 'rgba(255,255,255,0.62)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                  borderLeft: isActive && !collapsed ? '3px solid #00D4AA' : '3px solid transparent',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }

                if (hasSubItems) {
                  return (
                    <div key={href}>
                      <button
                        type="button"
                        onClick={() => setLeaveExpanded(v => !v)}
                        title={collapsed ? label : undefined}
                        style={rowStyle}
                      >
                        {rowContent}
                      </button>
                      {leaveExpanded && (
                        <div style={{ paddingLeft: '30px', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '2px' }}>
                          {subScreens!.map((sub) => (
                            <Link
                              key={sub.key}
                              href={screenHref(slug, sub)}
                              style={{
                                display: 'block', padding: '8px 10px',
                                borderRadius: '6px',
                                color: 'rgba(255,255,255,0.5)',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                fontSize: '12.5px', textDecoration: 'none',
                                whiteSpace: 'nowrap', overflow: 'hidden',
                              }}
                            >
                              {SUB_SCREEN_LABELS[sub.key]}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    style={rowStyle}
                  >
                    {rowContent}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom links - expanded */}
        {!collapsed && (
          <div className="ws-sidebar-bottom" style={{
            padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '2px',
          }}>
            <Link href="/ws" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <LayoutGrid size={14} />
              Workspaces
            </Link>
            <Link href="/me" style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderRadius: '8px',
              color: 'rgba(255,255,255,0.38)',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              <User size={14} />
              My Profile
            </Link>

            {/* User card + sign out */}
            <div style={{
              marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                background: '#4F46E5', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  {userName}
                </p>
                <p style={{
                  margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}>
                  {roleLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                title="Sign out"
                style={{
                  width: '28px', height: '28px', flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '7px', color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom links - collapsed (icon only) */}
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
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '38px', height: '38px', borderRadius: '8px',
                color: 'rgba(255,255,255,0.38)', background: 'transparent', border: 'none',
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </aside>

      {/* Sign-out confirmation modal */}
      {confirmOpen && (
        <div
          onClick={() => !loggingOut && setConfirmOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,35,24,0.5)',
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px', padding: '24px',
              maxWidth: '360px', width: '100%',
            }}
          >
            <h2 style={{
              fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: 700,
              color: '#0D1B2A', margin: '0 0 8px',
            }}>
              {en.wsSidebar.signOutTitle}
            </h2>
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px',
              color: '#5b6b74', lineHeight: 1.5, margin: '0 0 20px',
            }}>
              {en.wsSidebar.signOutBody}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loggingOut}
                style={{
                  height: '40px', padding: '0 16px',
                  background: 'transparent', border: '1px solid #E2E8F0', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#334155',
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                }}
              >
                {en.wsSidebar.cancelBtn}
              </button>
              <button
                type="button"
                onClick={signOut}
                disabled={loggingOut}
                style={{
                  height: '40px', padding: '0 16px',
                  background: '#EF4444', border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#fff',
                  fontWeight: 600, cursor: loggingOut ? 'not-allowed' : 'pointer',
                  opacity: loggingOut ? 0.7 : 1,
                }}
              >
                {loggingOut ? en.wsSidebar.signingOutBtn : en.wsSidebar.signOutConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
