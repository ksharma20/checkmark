import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
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
} from '@/lib/db/queries/users'
import { generateOtp, otpExpiresAt } from '@/lib/auth'
import { sendOtpEmail } from '@/lib/email'

interface Props { params: Promise<{ slug: string }> }

/**
 * POST /api/ws/[slug]/transfer-ownership
 *
 * Step 1 — { action: 'request', targetMemberId }
 *   targetMemberId is the workspace_members.id (record ID, not user_id).
 *   Sends OTP to the current admin's email.
 *
 * Step 2 — { action: 'confirm', targetMemberId, code }
 *   Validates OTP, swaps roles (admin → member, target → admin).
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { action?: string; targetMemberId?: string; code?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const { action, targetMemberId, code } = body

  if (!targetMemberId) {
    return NextResponse.json({ error: 'targetMemberId is required', code: 'MISSING_TARGET' }, { status: 400 })
  }

  // Lookup target by their member record ID (workspace_members.id)
  const target = await getWorkspaceMemberByRecordId(targetMemberId, ctx.workspace.id)
  if (!target || target.status !== 'active') {
    return NextResponse.json({ error: 'Target member not found or not active', code: 'INVALID_TARGET' }, { status: 400 })
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Target is already an admin', code: 'ALREADY_ADMIN' }, { status: 409 })
  }
  if (target.user_id === ctx.userId) {
    return NextResponse.json({ error: 'Cannot transfer ownership to yourself', code: 'SELF_TRANSFER' }, { status: 400 })
  }

  const adminUser = await getUserById(ctx.userId)
  if (!adminUser) return NextResponse.json({ error: 'Admin user not found', code: 'NOT_FOUND' }, { status: 404 })

  // ── Step 1: request OTP ────────────────────────────────────────────────────
  if (action === 'request') {
    const recentCount = await countRecentOtps(adminUser.email, 60)
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

    // Swap roles
    await updateWorkspaceMember(target.id, ctx.workspace.id, { role: 'admin' })
    await updateWorkspaceMember(adminMember.id, ctx.workspace.id, { role: 'member' })

    return NextResponse.json({
      ok: true,
      new_admin: targetDetails?.full_name ?? target.email,
    })
  }

  return NextResponse.json({ error: 'Invalid action', code: 'INVALID_ACTION' }, { status: 400 })
}
