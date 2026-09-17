/**
 * What an `invitation` notification row is actually offering, right now.
 *
 * A notification is a RECORD and invariant 22 means it is never unsent. An
 * invitation is an OFFER, and the two do not age the same way: the row still
 * says "Acme invited you to join" months after the invitation was accepted,
 * declined, revoked or left to expire. So the row alone is never the truth -
 * the list query LEFT JOINs the `workspace_members` row back on and returns its
 * live status, its deadline and whether the invited address still matches the
 * account reading it (`invite_status`, `invite_expires_at`,
 * `invite_email_match` in `db/queries/notifications.ts`). This function turns
 * those three into the one thing a renderer needs.
 *
 * Deliberately PURE and in `lib/client/`, exactly like `notification-href.ts`
 * beside it: it is imported by a client component, and a runtime import that
 * reached `lib/db/**` would drag better-sqlite3 and libSQL into the browser
 * bundle and fail the build with a `Can't resolve 'fs'` trace naming none of
 * this. Same reason `src/lib/presence-ladder.ts` and `src/lib/parental.ts` are
 * pure.
 *
 * It decides PRESENTATION only. `POST /api/me/consent` re-checks existence,
 * `pending_consent`, the session email and the expiry through
 * `acceptMembership()` on every call, so a row this says is actionable can
 * still be refused, and that refusal is handled rather than prevented.
 */

/**
 * Has this invitation's window closed?
 *
 * One rule, one spelling - `src/lib/membership.ts` re-exports this rather than
 * carrying a second copy, so the server's refusal and the browser's rendering
 * cannot disagree about a deadline. A NULL expiry is an invitation with no
 * deadline and never expires; the column is nullable and old rows carry
 * nothing.
 */
export function isInviteExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

/**
 * `open`      - still answerable: Accept and Decline both do something
 * `expired`   - past its deadline. Decline still works (refusing something you
 *               no longer want must never fail), Accept would be a 410
 * `accepted`  - already joined
 * `declined`  - already refused
 * `withdrawn` - the membership row is gone, or has moved to a state that is
 *               neither of the above (`revoked`, `no_access`). One label,
 *               because from the invitee's side they are one fact: there is
 *               nothing here to answer any more
 * `notYours`  - the invited address is no longer this account's. Unreachable in
 *               practice (a row is written to a user id resolved from that
 *               address) but the query answers it, so the renderer must
 */
export type InviteRowState =
  | 'open'
  | 'expired'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'notYours'

export interface InviteStateInput {
  type: string
  invite_status: string | null
  invite_expires_at: string | null
  invite_email_match: number | null
}

/**
 * Returns null for anything that is not an invitation, so a caller can use it
 * as the "does this row have an invitation half?" test as well.
 */
export function inviteRowState(n: InviteStateInput): InviteRowState | null {
  if (n.type !== 'invitation') return null
  // NULL status means the LEFT JOIN found nothing: the membership was hard
  // deleted (`removeWorkspaceMember` is a hard delete), or the workspace went
  // with it.
  if (n.invite_status === null) return 'withdrawn'
  if (n.invite_status === 'active') return 'accepted'
  if (n.invite_status === 'declined') return 'declined'
  if (n.invite_status !== 'pending_consent') return 'withdrawn'
  // Ownership before age, matching `acceptMembership()`: somebody holding a
  // member id that is not theirs learns nothing about the invitation's state.
  if (n.invite_email_match !== 1) return 'notYours'
  if (isInviteExpired(n.invite_expires_at)) return 'expired'
  return 'open'
}
