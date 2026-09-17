'use client'

/**
 * The create-or-join card on `/me` home, shown only when the account holds no
 * active membership.
 *
 * What it replaced was a dead end: a card that said "No workspace yet" and
 * offered nothing to do about it. This one carries the three routes in that
 * already exist in code, and invents no fourth - no join-request table, no new
 * endpoint:
 *
 *  1. **Create one** - a link to `/ws/new`, which is the existing creation form.
 *     `POST /api/workspace` no longer refuses a second workspace, so this is
 *     offered to everyone rather than only to people with none.
 *  2. **Accept an invitation** - `POST /api/me/consent`, the same call
 *     `/me/orgs` and `/join/[slug]` make. Accept and decline behave exactly as
 *     they do there, including the `410 INVITE_EXPIRED` handling.
 *  3. **Walk in on a verified domain** - a link to `/join/[slug]`, which does the
 *     `autoEnrolIntoWorkspace()` server-side. Enrolling from a button here would
 *     be a second copy of that decision; a link is the same page the emailed
 *     workspace link goes to.
 *
 * Everything it needs is fetched by the Server Component that renders it
 * (`src/app/me/page.tsx`), so opening `/me` is one render rather than a card
 * that appears and then fills itself in over three client waterfalls.
 *
 * The workspace NAME is printed on every row. That is deliberate and is the
 * exception the `/me` convention names: the reader is choosing BETWEEN
 * workspaces here, so the name is the information. Everywhere else on `/me` the
 * pill above has already answered "which one".
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Card, Chip, Divider } from '@/components/ui'
import { en } from '@/locales/en'
import { me } from '@/locales/en/me'
import { meSettings } from '@/locales/en/me-settings'

/** One pending invitation, already resolved server-side to a name and an age. */
export interface JoinCardInvite {
  /** `workspace_members.id` - what `POST /api/me/consent` is keyed on. */
  memberId: string
  workspaceName: string
  /**
   * Computed on the server, never here: a comparison against `Date.now()` made
   * once during SSR and again on hydration can land either side of the deadline
   * and the row would flip under the reader.
   */
  expired: boolean
}

/** A workspace this email's domain is verified at, and which they are not in. */
export interface JoinCardDomainWorkspace {
  slug: string
  name: string
}

interface Props {
  invites: JoinCardInvite[]
  domainWorkspaces: JoinCardDomainWorkspace[]
}

export default function JoinWorkspaceCard({ invites, domainWorkspaces }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(invites)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Keyed by member id: two invitations can be on screen and only one can fail.
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleConsent(memberId: string, action: 'accept' | 'decline') {
    setBusyId(memberId)
    setErrors((prev) => {
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
        setPending((prev) => prev.filter((i) => i.memberId !== memberId))
        // Accepting gives this account a workspace, which changes the pill, the
        // stat grid and this whole card - all of them server-rendered.
        if (action === 'accept') router.refresh()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string }
      // `410 INVITE_EXPIRED` is the one refusal with a remedy, and the one that
      // can arrive on a row this page painted as live - the deadline can pass
      // while the tab is open. The row STAYS, re-marked expired, so Decline
      // still works and the reader is told what to ask for.
      if (data.code === 'INVITE_EXPIRED') {
        setPending((prev) =>
          prev.map((i) => (i.memberId === memberId ? { ...i, expired: true } : i)),
        )
        setErrors((prev) => ({ ...prev, [memberId]: meSettings.orgs.inviteExpiredError }))
        return
      }
      setErrors((prev) => ({
        ...prev,
        [memberId]: data.error ?? meSettings.orgs.inviteActionFailed,
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card className="fx-spring" style={{ marginTop: '14px' }}>
      <p className="t-h2">{me.joinCard.title}</p>
      <p className="t-secondary" style={{ marginTop: '6px' }}>
        {me.joinCard.body}
      </p>

      <div style={{ marginTop: '14px' }}>
        <Link
          href="/ws/new"
          className="btn btn-primary btn-block pressable link-plain"
        >
          {me.joinCard.createCta}
        </Link>
        <p className="t-muted" style={{ marginTop: '6px' }}>
          {me.joinCard.createHint}
        </p>
      </div>

      {pending.length > 0 && (
        <>
          <Divider />
          <h2 className="t-eyebrow" style={{ margin: '0 0 8px', color: 'var(--amber)' }}>
            {me.joinCard.invitesTitle}
          </h2>
          {pending.map((invite) => (
            <div key={invite.memberId} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{invite.workspaceName}</span>
                {invite.expired && (
                  <Chip tone="none">{meSettings.orgs.invitePendingExpiredBadge}</Chip>
                )}
              </div>
              <p className="t-secondary" style={{ margin: '2px 0 8px' }}>
                {invite.expired ? meSettings.orgs.invitePendingExpiredBody : me.joinCard.inviteBody}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* No Accept on an expired invitation - the server answers 410,
                    so the button's only outcome is a refusal. Decline stays:
                    refusing something you no longer want must never fail, and it
                    is how this row leaves the list. */}
                {!invite.expired && (
                  <Button
                    size="sm"
                    disabled={busyId === invite.memberId}
                    onClick={() => void handleConsent(invite.memberId, 'accept')}
                  >
                    {en.meOrgs.acceptBtn}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busyId === invite.memberId}
                  onClick={() => void handleConsent(invite.memberId, 'decline')}
                >
                  {en.meOrgs.declineBtn}
                </Button>
              </div>
              {errors[invite.memberId] && (
                <p className="field-error">{errors[invite.memberId]}</p>
              )}
            </div>
          ))}
        </>
      )}

      {domainWorkspaces.length > 0 && (
        <>
          <Divider />
          <h2 className="t-eyebrow" style={{ margin: '0 0 8px' }}>
            {me.joinCard.domainTitle}
          </h2>
          {domainWorkspaces.map((ws) => (
            <div key={ws.slug} style={{ marginBottom: '12px' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>{ws.name}</p>
              <p className="t-secondary" style={{ margin: '2px 0 8px' }}>
                {me.joinCard.domainBody}
              </p>
              {/* `/join/[slug]` is what runs the auto-enrol, server-side. */}
              <Link
                href={`/join/${encodeURIComponent(ws.slug)}`}
                className="btn btn-secondary btn-sm pressable link-plain"
              >
                {me.joinCard.domainCta}
              </Link>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
