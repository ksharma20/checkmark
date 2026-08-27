import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import {
  getWorkspaceMemberByRecordId,
  getWorkspaceMember,
  updateWorkspaceMember,
  getActiveMembersWithDetails,
} from '@/lib/db/queries/workspaces'
import {
  getUserById,
  createOtp,
  getValidOtp,
  markOtpUsed,
  countRecentOtps,
  getRateLimitCount,
  recordRateLimitHit,
} from '@/lib/db/queries/users'
import { generateOtp, otpExpiresAt, verifyPassword } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'
import { isWorkspaceOwner } from '@/lib/permissions/ranks'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

/** Password attempts allowed per PASSWORD_WINDOW_MINUTES, keyed on the actor. */
const PASSWORD_MAX_ATTEMPTS = 5
const PASSWORD_WINDOW_MINUTES = 15

/**
 * POST /api/ws/[slug]/transfer-ownership
 *
 * The most destructive action in a workspace - it hands over full control AND
 * demotes the person doing it to a plain member, with no way back except
 * through the new owner. Gated on TWO factors, in this order:
 *
 * Step 1 - { action: 'request', targetMemberId, password }
 *   targetMemberId is the workspace_members.id (record ID, not user_id).
 *   Re-authenticates with the account password, then emails an OTP. The
 *   password gates ISSUANCE of the code, so a hijacked session with access to
 *   the same inbox is no longer sufficient on its own.
 *
 * Step 2 - { action: 'confirm', targetMemberId, code }
 *   Validates the OTP, swaps roles (owner → member, target → owner).
 *   The password is not re-checked here: the code is single-use, short-lived,
 *   and only exists because the password already succeeded.
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Ownership, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { action?: string; targetMemberId?: string; code?: string; password?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { action, targetMemberId, code, password } = body

  if (!targetMemberId) {
    return NextResponse.json({ error: 'targetMemberId is required', code: 'MISSING_TARGET' }, { status: 400 })
  }

  // Lookup target by their member record ID (workspace_members.id)
  const target = await getWorkspaceMemberByRecordId(targetMemberId, ctx.workspace.id)
  if (!target || target.status !== 'active') {
    return NextResponse.json({ error: 'Target member not found or not active', code: 'INVALID_TARGET' }, { status: 400 })
  }
  // Admins ARE valid targets - promoting your most trusted admin to owner is
  // the normal path. Only the current owner is rejected.
  if (isWorkspaceOwner(target.role)) {
    return NextResponse.json({ error: 'This member is already the owner', code: 'ALREADY_OWNER' }, { status: 409 })
  }
  if (target.user_id === ctx.userId) {
    return NextResponse.json({ error: 'Cannot transfer ownership to yourself', code: 'SELF_TRANSFER' }, { status: 400 })
  }

  const adminUser = await getUserById(ctx.userId)
  if (!adminUser) return NextResponse.json({ error: 'Admin user not found', code: 'NOT_FOUND' }, { status: 404 })

  // ── Step 1: re-authenticate, then request OTP ──────────────────────────────
  if (action === 'request') {
    if (!password) {
      return NextResponse.json(
        { error: 'Your password is required to transfer ownership', code: 'MISSING_PASSWORD' },
        { status: 400 },
      )
    }

    // Keyed on the actor, not the IP or the target, so the limit cannot be
    // dodged by picking a different person to transfer to. Every attempt is
    // counted - success included - the same way the login route does it.
    const pwKey = ctx.userId
    if (
      (await getRateLimitCount(pwKey, 'transfer_ownership_password', PASSWORD_WINDOW_MINUTES)) >=
      PASSWORD_MAX_ATTEMPTS
    ) {
      return NextResponse.json(
        { error: 'Too many password attempts. Try again later.', code: 'RATE_LIMITED' },
        { status: 429 },
      )
    }
    await recordRateLimitHit(pwKey, 'transfer_ownership_password')

    if (!(await verifyPassword(password, adminUser.password_hash))) {
      return NextResponse.json(
        { error: 'That password is incorrect', code: 'INVALID_PASSWORD' },
        { status: 401 },
      )
    }

    // Separate limit from the password one: 5 password tries per 15 min stops
    // brute force, 3 codes per 15 min stops this being used as an email bomb.
    const recentCount = await countRecentOtps(adminUser.email, 15);
    if (recentCount >= 3) {
      return NextResponse.json({ error: 'Too many requests. Try again later.', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const otpCode = generateOtp()
    const expiresAt = otpExpiresAt()
    await createOtp({ email: adminUser.email, code: otpCode, purpose: 'transfer_ownership', expiresAt })
    await sendOtpEmail(adminUser.email, otpCode)

    return NextResponse.json({ sent: true, email: adminUser.email })
  }

  // ── Step 2: confirm with OTP ───────────────────────────────────────────────
  if (action === 'confirm') {
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required', code: 'MISSING_CODE' }, { status: 400 })
    }

    const otp = await getValidOtp(adminUser.email, code, 'transfer_ownership')
    if (!otp) {
      return NextResponse.json({ error: 'Invalid or expired verification code', code: 'INVALID_OTP' }, { status: 400 })
    }

    await markOtpUsed(otp.id)

    // Get the current admin's member record
    const adminMember = await getWorkspaceMember(ctx.workspace.id, ctx.userId)
    if (!adminMember) {
      return NextResponse.json({ error: 'Admin member record not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Get target's member details for the response name
    const allMembers = await getActiveMembersWithDetails(ctx.workspace.id)
    const targetDetails = allMembers.find((m) => m.user_id === target.user_id)

    // Hand over ownership. The outgoing owner becomes a plain MEMBER - this is
    // exactly what the transfer modal asked them to consent to ("You will become
    // a regular member"), and the role must match what they agreed to rather
    // than quietly leaving them more access than the screen promised.
    //
    // This does remove their org-surface access immediately, and only the new
    // owner can restore it. The OTP step is the guard against doing it by
    // accident.
    await updateWorkspaceMember(target.id, ctx.workspace.id, { role: 'owner' })
    await updateWorkspaceMember(adminMember.id, ctx.workspace.id, { role: 'member' })

    return NextResponse.json({
      ok: true,
      new_admin: targetDetails?.full_name ?? target.email,
    })
  }

  return NextResponse.json({ error: 'Invalid action', code: 'INVALID_ACTION' }, { status: 400 })
}
