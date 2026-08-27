import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import {
  getWorkspaceMemberByRecordId,
  updateWorkspaceMember,
} from '@/lib/db/queries/workspaces'
import { getRoleByKey } from '@/lib/db/queries/roles'
import { canManage, canGrant } from '@/lib/permissions/ranks'
import { guardEscalation } from '@/lib/permissions/guards'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string; memberId: string }> }

/**
 * PATCH /api/ws/[slug]/members/[memberId]/role   body: { role: "admin" }
 *
 * Assign a role to a member. Guarded on THREE axes, all required:
 *
 *   1. can(...'members.role','write')  - does the caller's role permit
 *      assigning roles at all?
 *   2. rank - is the TARGET below the caller, AND is the role being GRANTED
 *      also below the caller? Without the second check an admin could promote
 *      someone to owner and be promoted straight back.
 *   3. grid - are the GRANTED role's permissions a subset of the caller's?
 *      Rank cannot answer this: every custom role shares CUSTOM_ROLE_RANK, so
 *      rank alone lets any custom role with this permission hand out any other
 *      custom role, however powerful.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAccess(request, slug, Resource.AssignRoles, Action.Write)
  if (!ctx) return forbidden()

  let body: { role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const newRoleKey = (body.role ?? '').trim()
  if (!newRoleKey) {
    return NextResponse.json({ error: 'A role is required', code: 'MISSING_ROLE' }, { status: 400 })
  }

  const target = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!target) {
    return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  if (target.status !== 'active') {
    return NextResponse.json(
      { error: 'Only active members can be given a role', code: 'MEMBER_NOT_ACTIVE' },
      { status: 409 },
    )
  }

  // Changing your own role is never allowed - an owner demoting themselves
  // would leave the workspace ownerless. Ownership moves via transfer only.
  if (target.user_id && target.user_id === ctx.userId) {
    return NextResponse.json(
      { error: 'You cannot change your own role', code: 'SELF_ROLE_CHANGE' },
      { status: 400 },
    )
  }

  // The role must exist in THIS workspace - never trust a key from the client.
  const newRole = await getRoleByKey(ctx.workspace.id, newRoleKey)
  if (!newRole) {
    return NextResponse.json({ error: 'Unknown role', code: 'INVALID_ROLE' }, { status: 400 })
  }

  // Ownership is transferred, not assigned - that flow is OTP-gated.
  if (newRoleKey === 'owner') {
    return NextResponse.json(
      { error: 'Use transfer ownership to make someone the owner', code: 'USE_TRANSFER' },
      { status: 400 },
    )
  }

  if (target.role === newRoleKey) {
    return NextResponse.json({ ok: true, role: newRole.key, unchanged: true })
  }

  if (!canManage(ctx.role.key, target.role)) {
    return NextResponse.json(
      { error: 'You cannot change this member’s role', code: 'RANK_TOO_LOW' },
      { status: 403 },
    )
  }
  if (!canGrant(ctx.role.key, newRoleKey)) {
    return NextResponse.json(
      { error: 'You cannot grant a role at or above your own', code: 'RANK_TOO_LOW' },
      { status: 403 },
    )
  }

  // Rank alone is not a ceiling. Every custom role shares CUSTOM_ROLE_RANK, so
  // canGrant lets any custom role hand out any other one - and an admin outranks
  // a custom role holding `ownership`, which no admin has. The grid is the real
  // ceiling: you may only hand out a role whose permissions you already hold.
  //
  // Same guard the roles builder runs on create/edit. Without it here, the
  // builder's escalation check is trivially bypassed by assigning the role
  // instead of writing it.
  const escalation = guardEscalation(ctx.role.permissions, newRole.permissions)
  if (escalation) {
    return NextResponse.json(
      { error: escalation.message, code: escalation.code },
      { status: 403 },
    )
  }

  await updateWorkspaceMember(target.id, ctx.workspace.id, { role: newRoleKey })

  return NextResponse.json({ ok: true, role: newRole.key, name: newRole.name })
}
