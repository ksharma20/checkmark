'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { WorkspaceMember, Workspace } from '@/lib/db/queries/workspaces'
import { isWorkspaceAdmin } from '@/lib/permissions/ranks'
import { Button, Card, Chip, ConfirmDialog, EmptyState, WorkspaceAvatar } from '@/components/ui'
import { en } from '@/locales/en'
import { meSettings } from '@/locales/en/me-settings'

/**
 * A pending invitation with the server's verdict on its age attached.
 *
 * `expired` is computed on the server, not from `consent_token_expires_at`
 * here: a comparison against `Date.now()` made once during SSR and again on
 * hydration can land either side of the deadline, and the row would flip under
 * the reader.
 */
export type PendingInvite = WorkspaceMember & { expired: boolean }

interface Props {
  activeMemberships: WorkspaceMember[]
  pendingMemberships: PendingInvite[]
  wsMap: Record<string, Workspace>
  /** Role display name per workspace id. */
  roleNames: Record<string, string>
}

export default function OrgsClient({ activeMemberships, pendingMemberships, wsMap, roleNames }: Props) {
  const router = useRouter()
  const [activeList, setActiveList] = useState(activeMemberships)
  const [pendingList, setPendingList] = useState(pendingMemberships)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, { present: number; visited: number; notIn: number }>>({})
  const [pendingLeave, setPendingLeave] = useState<{ workspaceId: string; name: string } | null>(null)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  // Keyed by member id: two invitations can be on screen and only one can fail.
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    activeList.forEach((m) => {
      const ws = wsMap[m.workspace_id]
      if (!ws?.slug) return
      fetch(`/api/me/ws/${ws.slug}/counts`)
        .then((r) => r.json())
        .then((data) => {
          if (data.present !== undefined) {
            setCounts((prev) => ({ ...prev, [m.workspace_id]: data }))
          }
        })
        .catch(() => {})
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmLeave() {
    if (!pendingLeave) return
    const { workspaceId } = pendingLeave
    setLoadingId(workspaceId)
    setLeaveError(null)
    try {
      const res = await fetch(`/api/me/workspaces/${workspaceId}`, { method: 'DELETE' })
      if (res.ok) {
        setActiveList((prev) => prev.filter((m) => m.workspace_id !== workspaceId))
        setPendingLeave(null)
        router.refresh()
      } else {
        // 409 SOLE_ADMIN lands here - the server explains why the leave was
        // refused, and the dialog stays open to carry that explanation.
        const data = await res.json()
        setLeaveError(data.error || en.meOrgs.leaveError)
      }
    } finally {
      setLoadingId(null)
    }
  }

  async function handleConsent(memberId: string, action: 'accept' | 'decline') {
    setLoadingId(memberId)
    setInviteErrors((prev) => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
    try {
      const res = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      })
      if (res.ok) {
        setPendingList((prev) => prev.filter((m) => m.id !== memberId))
        if (action === 'accept') router.refresh()
        return
      }
      // `410 INVITE_EXPIRED` is the one refusal with a remedy, and the one that
      // can arrive on a row this page painted as live - the deadline can pass
      // while the tab is open. The row STAYS, re-marked as expired, so Decline
      // still works and the reader is told what to ask for.
      const data = await res.json().catch(() => ({})) as { code?: string; error?: string }
      if (data.code === 'INVITE_EXPIRED') {
        setPendingList((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, expired: true } : m)),
        )
        setInviteErrors((prev) => ({ ...prev, [memberId]: meSettings.orgs.inviteExpiredError }))
        return
      }
      setInviteErrors((prev) => ({
        ...prev,
        [memberId]: data.error ?? meSettings.orgs.inviteActionFailed,
      }))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="stack">
      {/* Pending consent invites */}
      {pendingList.length > 0 && (
        <section>
          <h2 className="t-eyebrow" style={{ color: 'var(--amber)', margin: '0 0 8px' }}>
            {en.meOrgs.pendingInvitesTitle}
          </h2>

          {pendingList.map((m) => {
            const ws = wsMap[m.workspace_id]
            const name = ws?.name ?? m.workspace_id
            return (
              <Card key={m.id} style={{ borderColor: m.expired ? 'var(--danger)' : 'var(--amber)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p className="t-h2" style={{ margin: 0, color: 'var(--navy)' }}>{name}</p>
                  {m.expired && <Chip tone="none">{meSettings.orgs.invitePendingExpiredBadge}</Chip>}
                </div>
                <p className="t-secondary" style={{ margin: '4px 0 14px' }}>
                  {m.expired ? meSettings.orgs.invitePendingExpiredBody : en.meOrgs.pendingInviteBody}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* No Accept on an expired invitation - the server answers
                      410, so the button's only outcome is a refusal. Decline
                      stays: refusing something you no longer want must never
                      fail, and it is how this row leaves the list. */}
                  {!m.expired && (
                    <Button
                      size="sm"
                      disabled={loadingId === m.id}
                      onClick={() => handleConsent(m.id, 'accept')}
                    >
                      {en.meOrgs.acceptBtn}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={loadingId === m.id}
                    onClick={() => handleConsent(m.id, 'decline')}
                  >
                    {en.meOrgs.declineBtn}
                  </Button>
                </div>
                {inviteErrors[m.id] && <p className="field-error">{inviteErrors[m.id]}</p>}
              </Card>
            )
          })}
        </section>
      )}

      {/* Active memberships */}
      {activeList.length > 0 ? (
        <section>
          <h2 className="t-eyebrow" style={{ margin: '0 0 8px' }}>{en.meOrgs.activeTitle}</h2>

          {activeList.map((m) => {
            const ws = wsMap[m.workspace_id]
            const name = ws?.name ?? m.workspace_id
            const href = `/me/ws/${ws?.slug ?? m.workspace_id}`
            const count = counts[m.workspace_id]

            return (
              <Card
                key={m.id}
                className="hoverlift pressable"
                style={{ position: 'relative', padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Full-card link overlay - keeps the whole row tappable while
                      the Leave button stays a separate, higher-stacked target. */}
                  <Link
                    href={href}
                    aria-label={name}
                    style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)' }}
                  />

                  {/* The WORKSPACE mark, not the person Avatar that used to be
                      here: `workspace-color.ts` keeps the two palettes apart on
                      purpose, so a workspace wearing a member colour reads as a
                      relationship that is not there. */}
                  <span style={{ position: 'relative', pointerEvents: 'none', display: 'flex' }}>
                    <WorkspaceAvatar
                      id={ws?.id ?? m.workspace_id}
                      slug={ws?.slug ?? ''}
                      name={name}
                      logoUpdatedAt={ws?.logo_updated_at}
                      size="lg"
                    />
                  </span>

                  <div style={{ flex: 1, minWidth: 0, position: 'relative', pointerEvents: 'none' }}>
                    <p className="t-h2" style={{ margin: 0, color: 'var(--navy)' }}>{name}</p>
                    {/* The role's display name as stored - never the raw key,
                        which `capitalize` would render as e.g. "Hr-manager". */}
                    <p className="t-muted" style={{ margin: '2px 0 0' }}>
                      {roleNames[m.workspace_id] ?? m.role}
                    </p>
                    {count && (
                      <p className="t-muted" style={{ margin: '4px 0 0' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: 600 }}>
                          {meSettings.orgs.countsInOffice(count.present)}
                        </span>
                        {' · '}
                        {meSettings.orgs.countsVisited(count.visited)}
                        {' · '}
                        {meSettings.orgs.countsNotIn(count.notIn)}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    size={20}
                    strokeWidth={2.5}
                    aria-hidden
                    style={{ position: 'relative', color: 'var(--brand)', flexShrink: 0, pointerEvents: 'none' }}
                  />
                </div>

                {/* Leaving is blocked server-side for a sole admin (409). */}
                {!isWorkspaceAdmin(m.role) && (
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={loadingId === m.workspace_id}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLeaveError(null)
                        setPendingLeave({
                          workspaceId: m.workspace_id,
                          name: name || en.meOrgs.leaveFallbackName,
                        })
                      }}
                    >
                      {loadingId === m.workspace_id ? en.meOrgs.leavingBtn : en.meOrgs.leaveBtn}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </section>
      ) : (
        pendingList.length === 0 && (
          <EmptyState
            title={en.meOrgs.emptyTitle}
            hint={
              <>
                {en.meOrgs.emptyBody}
                <br />
                <Link href="/ws" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                  {en.meOrgs.createLink}
                </Link>
              </>
            }
          />
        )
      )}

      <ConfirmDialog
        open={pendingLeave !== null}
        onClose={() => { setPendingLeave(null); setLeaveError(null) }}
        onConfirm={() => void confirmLeave()}
        title={meSettings.orgs.leaveTitle}
        body={pendingLeave ? en.meOrgs.leaveConfirm(pendingLeave.name) : ''}
        confirmLabel={meSettings.orgs.leaveConfirmAction}
        busyLabel={meSettings.orgs.leaveBusy}
        cancelLabel={meSettings.orgs.leaveCancel}
        loading={loadingId !== null && loadingId === pendingLeave?.workspaceId}
        error={leaveError}
      />
    </div>
  )
}
