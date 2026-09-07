'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Avatar, Button, DropdownMenu, Modal, type DropdownMenuItem } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-overview'

interface Props {
  slug: string
  userName: string
  /** Display name of the role, e.g. "Owner". Never the raw key. */
  userRoleName: string
  /**
   * `sidebar` renders the full name + role row pinned to `.sidebar-foot`;
   * `topbar` renders the bare avatar used inside `.topbar-account`. The
   * stylesheet swaps which of the two is visible at the 860px breakpoint, so
   * both are always mounted and only one shows.
   */
  variant: 'sidebar' | 'topbar'
}

/**
 * Account row + its dropdown + the sign-out confirmation.
 *
 * Extracted rather than written twice because the shell renders it in two
 * places (sidebar foot on desktop, topbar on mobile) and the sign-out flow -
 * confirm, POST /api/auth/logout, hard navigate - must not diverge between them.
 */
export default function WsAccountMenu({ slug, userName, userRoleName, variant }: Props) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function signOut() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    // Full document navigation, not router.push: the session cookie is gone and
    // every cached RSC payload for /ws is now unauthorised.
    window.location.href = '/login'
  }

  const items: DropdownMenuItem[] = [
    { key: 'settings', label: wsAdmin.shell.menuSettings, onSelect: () => router.push(`/ws/${slug}/settings`) },
    { key: 'workspaces', label: wsAdmin.shell.menuWorkspaces, onSelect: () => router.push('/ws') },
    { key: 'profile', label: wsAdmin.shell.menuProfile, onSelect: () => router.push('/me') },
    { key: 'signout', label: wsAdmin.shell.menuSignOut, onSelect: () => setConfirmOpen(true), danger: true },
  ]

  const trigger = variant === 'sidebar' ? (
    <button
      type="button"
      className="rowlink pressable"
      onClick={() => setMenuOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label={wsAdmin.shell.accountMenu}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', padding: '8px', width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: '44px',
      }}
    >
      <Avatar name={userName} size={30} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {userName}
        </span>
        <span className="t-muted" style={{ display: 'block', fontSize: '11px' }}>{userRoleName}</span>
      </span>
      <MoreHorizontal size={16} aria-hidden style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  ) : (
    <button
      type="button"
      className="pressable"
      onClick={() => setMenuOpen((v) => !v)}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label={wsAdmin.shell.accountMenu}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <Avatar name={userName} size={32} />
    </button>
  )

  return (
    <>
      {trigger}
      <DropdownMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={items}
        placement={variant === 'sidebar' ? 'above' : 'below'}
      />
      <Modal
        open={confirmOpen}
        onClose={() => { if (!loggingOut) setConfirmOpen(false) }}
        title={en.wsSidebar.signOutTitle}
        footer={
          <>
            <Button variant="secondary" disabled={loggingOut} onClick={() => setConfirmOpen(false)}>
              {en.wsSidebar.cancelBtn}
            </Button>
            <Button variant="danger" loading={loggingOut} onClick={signOut}>
              {loggingOut ? en.wsSidebar.signingOutBtn : en.wsSidebar.signOutConfirmBtn}
            </Button>
          </>
        }
      >
        <p className="t-secondary">{en.wsSidebar.signOutBody}</p>
      </Modal>
    </>
  )
}
