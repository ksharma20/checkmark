'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BottomSheet, Divider, initials, WorkspaceAvatar } from '@/components/ui'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useToast } from '@/components/shared/Toast'
import { useWorkspaceScope } from '@/app/me/workspace-scope'
import { me } from '@/locales/en/me'

export interface MeWorkspaceOption {
  id: string
  slug: string
  /** null when the workspace has no logo; also the image cache-buster. */
  logoUpdatedAt?: string | null
  name: string
  /** Display name of the role, never the raw key. */
  roleName: string
  /** Does this person's role grant them anything on the org surface? */
  hasOrgAccess: boolean
}

interface Props {
  workspaces: MeWorkspaceOption[]
  userName: string
  userEmail: string
}

/**
 * The `/me` top bar: a workspace pill on the left, and an optional admin-view
 * link + notifications + avatar on the right. The pill opens the workspace
 * switcher; the avatar opens the profile sheet.
 */
export default function MeTopbar({ workspaces, userName, userEmail }: Props) {
  const router = useRouter()
  const toast = useToast()
  // The pill is the only workspace selector on `/me`; everything below it -
  // the home summary, Leave, Profile, Documents, the roster - reads the same
  // scope, so picking here is what moves the whole surface.
  const { slug: activeSlug, select } = useWorkspaceScope()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const active = workspaces.find((w) => w.slug === activeSlug) ?? workspaces[0] ?? null

  // The bell follows the active workspace so it only counts what is in scope.
  // With no workspace at all there is no slug to scope by, so it falls back to
  // the global feed - that is where a pending invitation shows up, which is
  // exactly the notification a workspace-less user needs.
  const bellPollUrl = active
    ? `/api/me/ws/${active.slug}/notifications/unread-count`
    : '/api/me/notifications/unread-count'
  const bellHref = active ? `/me/notifications?ws=${active.slug}` : '/me/notifications'

  // Shown only to someone whose role grants the org surface *somewhere*. It
  // targets the active workspace when that one grants it, else the `/ws`
  // picker - they are an admin, just not here.
  const adminHref = workspaces.some((w) => w.hasOrgAccess)
    ? active?.hasOrgAccess
      ? `/ws/${active.slug}`
      : '/ws'
    : null

  function chooseWorkspace(slug: string) {
    select(slug)
    setSwitcherOpen(false)
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error('logout failed')
      setProfileOpen(false)
      router.replace('/login')
      router.refresh()
    } catch {
      toast.show(me.profileSheet.signOutFailed, 'error')
      setSigningOut(false)
    }
  }

  const sheetRow: React.CSSProperties = {
    display: 'block',
    padding: '14px 4px',
    fontSize: '13.5px',
    fontWeight: 600,
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  }

  return (
    <>

      <div
        className="me-topbar"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}
      >
        {active ? (
          <button
            type="button"
            className="ws-pill pressable"
            onClick={() => setSwitcherOpen(true)}
            aria-label={me.topbar.switchWorkspace}
            aria-haspopup="dialog"
            style={{ minWidth: 0 }}
          >
            <WorkspaceAvatar
              id={active.id}
              slug={active.slug}
              name={active.name}
              logoUpdatedAt={active.logoUpdatedAt}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {active.name}
            </span>
            <span aria-hidden="true" style={{ opacity: 0.6 }}>▾</span>
          </button>
        ) : (
          <Link href="/me/orgs" className="ws-pill pressable" style={{ textDecoration: 'none' }}>
            <span className="swatch" style={{ background: 'var(--text-muted)' }} aria-hidden="true">
              +
            </span>
            {me.topbar.noWorkspace}
          </Link>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Persistent, never animated: this is on every `/me` page load, and a
              control the user sees constantly should not draw attention to
              itself by moving. Switching *surface* is a different action from
              switching workspace, so it lives here and not in the switcher. */}
          {adminHref && (
            <Link
              href={adminHref}
              className="icon-btn icon-btn-plain pressable"
              aria-label={me.topbar.adminView}
              style={{
                borderRadius: '999px',
                border: '1px solid var(--border)',
                background: 'transparent',
                textDecoration: 'none',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 21h18" />
                <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
                <path d="M15 21V9h4a2 2 0 0 1 2 2v10" />
                <path d="M9 7h2M9 11h2M9 15h2" />
              </svg>
            </Link>
          )}
          <span className="me-bell-slot" style={{ display: 'inline-flex' }}>
            <NotificationBell pollUrl={bellPollUrl} href={bellHref} />
          </span>
          <button
            type="button"
            className="avatar pressable"
            onClick={() => setProfileOpen(true)}
            aria-label={me.topbar.profileMenu}
            aria-haspopup="dialog"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {initials(userName)}
          </button>
        </div>
      </div>

      {/* ── profile sheet ──────────────────────────────────────────────────── */}
      <BottomSheet open={profileOpen} onClose={() => setProfileOpen(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="avatar" style={{ width: '44px', height: '44px', fontSize: '15px' }} aria-hidden="true">
            {initials(userName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700 }}>{userName}</p>
            <p className="t-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {/* No workspace name here: the pill above already answers "which
                  one", and repeating it inside scoped content is noise. */}
              {active ? active.roleName : userEmail}
            </p>
          </div>
        </div>

        <Divider />

        <Link href="/me/profile" style={sheetRow} onClick={() => setProfileOpen(false)}>
          {me.profileSheet.profile}
        </Link>
        <Divider style={{ margin: 0 }} />
        <Link href="/me/documents" style={sheetRow} onClick={() => setProfileOpen(false)}>
          {me.profileSheet.documents}
        </Link>
        <Divider style={{ margin: 0 }} />
        {/* Navigates rather than handing off to the switcher sheet: `/me/orgs`
            is the full list, with invitations, leave actions and live counts. */}
        <Link href="/me/orgs" style={sheetRow} onClick={() => setProfileOpen(false)}>
          {me.profileSheet.linkedWorkspaces}
        </Link>
        <Divider style={{ margin: 0 }} />
        <Link href="/me/notifications" style={sheetRow} onClick={() => setProfileOpen(false)}>
          {me.profileSheet.notifications}
        </Link>
        <Divider style={{ margin: 0 }} />
        {/* Privacy & data lives on the existing settings screen, which is no
            longer a nav tab but stays reachable from here and by URL. */}
        <Link href="/me/settings" style={sheetRow} onClick={() => setProfileOpen(false)}>
          {me.profileSheet.privacy}
        </Link>
        <Divider style={{ margin: 0 }} />
        <button
          type="button"
          style={{ ...sheetRow, color: 'var(--danger)' }}
          onClick={handleSignOut}
          disabled={signingOut}
          aria-busy={signingOut || undefined}
        >
          {signingOut ? me.profileSheet.signingOut : me.profileSheet.signOut}
        </button>
      </BottomSheet>

      {/* ── workspace switcher ─────────────────────────────────────────────── */}
      <BottomSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)}>
        <p className="t-eyebrow" style={{ marginBottom: '10px' }}>{me.switcher.title}</p>

        {workspaces.length === 0 && <p className="t-muted">{me.switcher.empty}</p>}

        {workspaces.map((w) => (
          // A button, not a link: switching re-scopes the screen you are on
          // rather than navigating away from it.
          <button
            key={w.id}
            type="button"
            className="rowlink"
            onClick={() => chooseWorkspace(w.slug)}
            aria-current={w.slug === active?.slug || undefined}
            style={{
              width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 6px', textDecoration: 'none', color: 'var(--text-primary)',
              background: 'none', border: 'none', textAlign: 'left',
              fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer',
            }}
          >
            <WorkspaceAvatar
              id={w.id}
              slug={w.slug}
              name={w.name}
              logoUpdatedAt={w.logoUpdatedAt}
              size="lg"
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '13.5px' }}>{w.name}</span>
              <span className="t-muted" style={{ display: 'block' }}>{w.roleName}</span>
            </span>
            {w.slug === active?.slug && (
              <span aria-hidden="true" style={{ color: 'var(--brand)', fontSize: '16px' }}>✓</span>
            )}
          </button>
        ))}
      </BottomSheet>
    </>
  )
}
