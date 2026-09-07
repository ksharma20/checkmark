import {
  acceptConsent,
  declineConsent,
  addWorkspaceMember,
  getMembershipsByEmail,
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
 * not. So the moment an account appears, the record has to be claimed.
 *
 * It lives here rather than inside a query file because it spans two domains
 * and `employees.ts` already imports `workspaces.ts` - putting it the other way
 * round would close an import cycle through the query layer. This module is the
 * shell; both query files stay leaves.
 */

export type AcceptResult = { ok: true } | { ok: false; code: 'NOT_FOUND' | 'NOT_PENDING' | 'WRONG_ACCOUNT' }

/**
 * Accept one invitation and attach any HR record waiting on that email.
 *
 * The email check is not ceremony. `memberId` arrives from the client, and
 * without it any signed-in user who learned somebody else's member id could
 * accept an invitation addressed to them - and now also claim the employee
 * record filed under that address, which is where the PAN and bank details
 * live. The consent PAGE has always made this check; the API route did not.
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

  await acceptConsent(memberId, userId)
  await claimEmployeeForUser(member.workspace_id, member.email, userId)
  return { ok: true }
}

/** Decline, with the same ownership check as accept. */
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
 * Every pending invitation for this email becomes active, across workspaces,
 * with the HR record in each one claimed.
 *
 * Used on registration: someone invited to three workspaces before they had an
 * account should not have to open three emails.
 */
export async function claimPendingMemberships(email: string, userId: string): Promise<void> {
  const pending = await getMembershipsByEmail(email)
  await linkUserToMemberRecord(email, userId)
  for (const m of pending) {
    if (m.status !== 'pending_consent') continue
    await claimEmployeeForUser(m.workspace_id, m.email, userId)
  }
}

/**
 * Verified-domain auto-enrol for one workspace, record claim included.
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
