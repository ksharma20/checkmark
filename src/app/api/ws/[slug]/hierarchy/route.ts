import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { getHierarchyMembers, getOwnerUserId, setManager } from '@/lib/db/queries/hierarchy'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

/**
 * GET /api/ws/[slug]/hierarchy
 *
 * Every active member with their current manager - the raw pairs the org chart
 * and the Reporting Manager dropdown are built from.
 *
 * Gated on `employees` rather than a resource of its own: the reporting line is
 * part of someone's employment record here, and adding a `hierarchy` resource
 * would mean rewriting every seeded role grid for a distinction nobody has
 * asked for yet.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Employees, Action.Read)
  if (!ctx) return forbidden()

  // The root is returned rather than inferred: `buildReportingTree` needs it to
  // apply the unassigned roll-up, and picking the row whose role reads 'owner'
  // client-side is a guess that breaks the moment a custom role is named that.
  const [members, ownerUserId] = await Promise.all([
    getHierarchyMembers(ctx.workspace.id),
    getOwnerUserId(ctx.workspace.id),
  ])

  return NextResponse.json({
    ownerUserId,
    members: members.map((m) => ({
      userId: m.user_id,
      name: m.full_name ?? m.email,
      email: m.email,
      role: m.role,
      managerUserId: m.manager_user_id,
    })),
  })
}

/**
 * PATCH /api/ws/[slug]/hierarchy   body: { userId, managerUserId | null }
 *
 * Point one member at a manager, or clear it with null.
 *
 * Separate from the employee-record endpoint on purpose: the reporting line
 * lives on workspace_members, not on the employee record, so it is a different
 * table and a different write even though it shares the `employees` gate.
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Employees, Action.Write)
  if (!ctx) return forbidden()

  let body: { userId?: string; managerUserId?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const userId = (body.userId ?? '').trim()
  if (!userId) {
    return NextResponse.json({ error: 'A member is required', code: 'MISSING_USER' }, { status: 400 })
  }

  // Empty string from a <select> means "no manager", same as null.
  const managerUserId = body.managerUserId ? String(body.managerUserId) : null

  // The target must be inside the caller's scope. Without this, a subtree-scoped
  // role holding hierarchy:write could re-parent someone they cannot even see.
  if (!ctx.visibleMemberIds.includes(userId)) return forbidden()
  if (managerUserId && !ctx.visibleMemberIds.includes(managerUserId)) return forbidden()

  const result = await setManager({
    workspaceId: ctx.workspace.id,
    userId,
    managerUserId,
  })

  if (!result.ok) {
    const status = result.code === 'CYCLE_DETECTED' ? 409 : 400
    const message =
      result.code === 'CYCLE_DETECTED'
        ? 'That would create a reporting loop — the person you picked already reports to this member.'
        : result.code === 'SELF_MANAGER'
          ? 'Someone cannot report to themselves.'
          : 'That person is not an active member of this workspace.'
    return NextResponse.json({ error: message, code: result.code }, { status })
  }

  return NextResponse.json({ ok: true, userId, managerUserId })
}
