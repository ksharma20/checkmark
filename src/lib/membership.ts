import {
  acceptConsent,
  declineConsent,
  addWorkspaceMember,
  getWorkspaceMemberById,
  linkUserToMemberRecord,
  updateWorkspaceMember,
} from '@/lib/db/queries/workspaces'
import { claimEmployeeForUser } from '@/lib/db/queries/employees'

/**
 * The seam between MEMBERSHIP and the HR RECORD.
 *
 * These two live in separate tables with no automatic link, on purpose - being
 * in a workspace and having an employee record are different facts, and the
 * record is optional. But the add-employee flow can now create a record BEFORE
 * the person has an account, so for the length of an open invitation the record
 * carries only a work email and no `user_id`. The directory copes with that
 * (its join falls back to email); everything keyed on `employees.user_id` does
 * not. So the moment the person CONSENTS, the record has to be claimed - at
 * consent, not at sign-up: an account that has agreed to nothing has no claim
 * on a payroll record, and registering with an invited email links `user_id`
 * and no more.
 *
 * It lives here rather than inside a query file because it spans two domains
 * and `employees.ts` already imports `workspaces.ts` - putting it the other way
 * round would close an import cycle through the query layer. This module is the
 * shell; both query files stay leaves.
 */

export type AcceptResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PENDING' | 'WRONG_ACCOUNT' | 'EXPIRED' }

/**
 * Has this invitation's 7-day window closed?
 *
 * One rule, one spelling. The emailed consent page needs it BEFORE it sends a
 * logged-out visitor round the login flow, and `acceptMembership` needs it at
 * the moment of the write; two hand-written date comparisons would be two
 * things to keep in step. A NULL expiry is an invitation with no deadline and
 * never expires - the column is nullable and old rows carry nothing.
 */
export function isInviteExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

/**
 * Accept one invitation and attach any HR record waiting on that email.
 *
 * The email check is not ceremony. `memberId` arrives from the client, and
 * without it any signed-in user who learned somebody else's member id could
 * accept an invitation addressed to them - and now also claim the employee
 * record filed under that address, which is where the PAN and bank details
 * live. The consent PAGE has always made this check; the API route did not.
 *
 * EXPIRY IS CHECKED HERE AND ONLY HERE. It used to live on the emailed consent
 * page alone, so `/api/me/consent`, `/join/[slug]` and `/me/orgs` all accepted
 * an invitation that had expired weeks earlier. Every accept path already calls
 * this function; a check written once cannot be forgotten by the fifth caller.
 * It runs AFTER the email match so a hijacker is told WRONG_ACCOUNT rather than
 * learning anything about the invitation's age.
 *
 * The HR record is claimed here rather than at sign-up, because consent is what
 * entitles an account to a payroll record, encrypted PAN and bank details, and
 * uploaded documents. Registering with an invited email links `user_id` and
 * nothing else.
 */
export async function acceptMembership(
  memberId: string,
  userId: string,
  userEmail: string,
): Promise<AcceptResult> {
  const member = await getWorkspaceMemberById(memberId)
  if (!member) return { ok: false, code: 'NOT_FOUND' }
  if (member.status !== 'pending_consent') return { ok: false, code: 'NOT_PENDING' }
  if (member.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, code: 'WRONG_ACCOUNT' }
  }
  if (isInviteExpired(member.consent_token_expires_at)) {
    return { ok: false, code: 'EXPIRED' }
  }

  await acceptConsent(memberId, userId)
  await claimEmployeeForUser(member.workspace_id, member.email, userId)
  return { ok: true }
}

/**
 * Decline, with the same ownership check as accept.
 *
 * DELIBERATELY NOT EXPIRY-CHECKED. Refusing something you no longer want must
 * never fail, and an expired invitation is exactly the one somebody wants off
 * their list. Never add the check here to match accept.
 */
export async function declineMembership(
  memberId: string,
  userEmail: string,
): Promise<AcceptResult> {
  const member = await getWorkspaceMemberById(memberId)
  if (!member) return { ok: false, code: 'NOT_FOUND' }
  if (member.status !== 'pending_consent') return { ok: false, code: 'NOT_PENDING' }
  if (member.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, code: 'WRONG_ACCOUNT' }
  }
  await declineConsent(memberId)
  return { ok: true }
}

/**
 * Point every pending invitation for this email at the new account. NOTHING
 * ELSE.
 *
 * Used on registration. The invitations stay `pending_consent` - signing up is
 * not consent, and a person creating an account for their own reasons must not
 * silently join an employer's workspace. All this buys is that when they do
 * accept, from the email, `/me/orgs` or `/join/[slug]`, the row already knows
 * who they are.
 *
 * It USED to claim the employee record here too, which attached payroll,
 * documents and encrypted PAN and bank details to an account that had agreed to
 * nothing. That claim moved into `acceptMembership()`, where consent is.
 */
export async function claimPendingMemberships(email: string, userId: string): Promise<void> {
  await linkUserToMemberRecord(email, userId)
}

/**
 * Verified-domain auto-enrol for one workspace, record claim included.
 *
 * The claim belongs here for the same reason it belongs in `acceptMembership`:
 * THIS PATH IS THE CONSENT. A workspace that has verified a domain has already
 * declared everyone on it staff, and the member lands `active` in one step -
 * there is no later moment at which to ask.
 *
 * Returns true when this call changed something, so a caller can tell "joined"
 * from "was already in".
 */
export async function autoEnrolIntoWorkspace(params: {
  workspaceId: string
  userId: string
  email: string
  existingMemberId?: string | null
  existingStatus?: string | null
}): Promise<boolean> {
  const { workspaceId, userId, email, existingMemberId, existingStatus } = params

  if (!existingMemberId) {
    await addWorkspaceMember({ workspaceId, userId, email, role: 'member', status: 'active' })
  } else if (existingStatus === 'pending_consent') {
    await updateWorkspaceMember(existingMemberId, workspaceId, { status: 'active', user_id: userId })
  } else {
    return false
  }

  await claimEmployeeForUser(workspaceId, email, userId)
  return true
}
