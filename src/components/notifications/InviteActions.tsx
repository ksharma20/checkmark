'use client'

/**
 * Accept / Decline, inside the invitation's own notification row.
 *
 * This is the third caller of `POST /api/me/consent`, after `/me/orgs` and the
 * create-or-join card on `/me` home, and it behaves identically to both on
 * purpose - same endpoint, same `{ memberId, action }` body, same handling of
 * `410 INVITE_EXPIRED`. Nothing new is invented here; an invitation simply
 * became answerable in one more place.
 *
 * WHAT IT MAY RENDER IS NOT ITS OWN OPINION. The list query LEFT JOINs the
 * `workspace_members` row back onto `ref_id` and returns its live status,
 * deadline and email match, and `inviteRowState()` reduces those to one word. A
 * notification is never unsent (invariant 22), so the row survives being
 * accepted, declined, revoked and expired - and an offer that has already been
 * answered must state the answer rather than keep offering a button whose only
 * outcome is a refusal.
 *
 * The server is still the truth. `acceptMembership()` re-checks existence,
 * `pending_consent`, the session email and the expiry on every call, so a row
 * this painted as open can still be refused - the deadline can pass with the tab
 * open. That refusal is HANDLED rather than prevented: the row re-renders as
 * resolved from the code that came back, and Decline stays available, because
 * refusing something you no longer want must never fail.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Chip } from '@/components/ui'
import { inviteRow } from '@/locales/en/notifications'
import { inviteRowState, type InviteRowState } from '@/lib/client/invite-state'
import type { Notification } from '@/lib/db/queries/notifications'

interface Props {
  notification: Notification
  /** Called after a successful answer, so the list can mark the row read. */
  onAnswered: (notificationId: string) => void
}

/** The closed states, each with the one word that says what happened. */
const RESOLVED_LABEL: Record<Exclude<InviteRowState, 'open'>, string> = {
  expired: inviteRow.expired,
  accepted: inviteRow.accepted,
  declined: inviteRow.declined,
  withdrawn: inviteRow.withdrawn,
  notYours: inviteRow.notYours,
}

export default function InviteActions({ notification, onAnswered }: Props) {
  const router = useRouter()
  // Seeded from the server's join, then only ever moved by an answer this
  // component made or a refusal the server returned. It is never recomputed
  // from `Date.now()` on a render: a row must not flip under a reader mid-read.
  const [state, setState] = useState<InviteRowState | null>(() => inviteRowState(notification))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memberId = notification.ref_id
  if (state === null || !memberId) return null

  async function answer(action: 'accept' | 'decline') {
    if (busy || !memberId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/me/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, action }),
      })
      if (res.ok) {
        setState(action === 'accept' ? 'accepted' : 'declined')
        onAnswered(notification.id)
        // Accepting hands this account a membership, which changes the top-bar
        // pill, the bottom nav's counts and every server-rendered scrap of `/me`
        // around this list. Declining changes none of that, so it does not pay
        // for a refresh.
        if (action === 'accept') router.refresh()
        return
      }
      const data = (await res.json().catch(() => ({}))) as { code?: string }
      // The two refusals that mean "this row is out of date", not "something
      // went wrong": re-render it closed rather than showing an error beside a
      // button the reader will only press again.
      if (data.code === 'INVITE_EXPIRED') { setState('expired'); return }
      if (data.code === 'NOT_PENDING') { setState('withdrawn'); onAnswered(notification.id); return }
      if (data.code === 'NOT_FOUND') { setState('withdrawn'); return }
      if (data.code === 'WRONG_ACCOUNT') { setState('notYours'); return }
      setError(inviteRow.failed)
    } catch {
      setError(inviteRow.failed)
    } finally {
      setBusy(false)
    }
  }

  // Expired is the one closed state that still offers something. Decline is how
  // the reader gets it off their list, and the server allows it deliberately.
  const showDecline = state === 'open' || state === 'expired'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {state === 'open' && (
          <Button size="sm" disabled={busy} onClick={() => void answer('accept')}>
            {busy ? inviteRow.working : inviteRow.accept}
          </Button>
        )}
        {showDecline && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void answer('decline')}>
            {busy ? inviteRow.working : inviteRow.decline}
          </Button>
        )}
        {state !== 'open' && (
          <Chip tone={state === 'accepted' ? 'verified' : 'none'}>{RESOLVED_LABEL[state]}</Chip>
        )}
      </div>
      {state === 'expired' && <p className="t-muted" style={{ marginTop: '6px' }}>{inviteRow.expiredHint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
