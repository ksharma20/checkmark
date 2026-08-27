import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import {
  listWorkspaceRoles,
  getRoleMemberCounts,
  createWorkspaceRole,
  getRoleByKey,
} from '@/lib/db/queries/roles'
import { RESOURCES, isSystemRole, Scope, Action, Resource } from '@/lib/permissions/catalogue'
import { can } from '@/lib/permissions/can'
import { validateGridForSave, roleKeyFromName } from '@/lib/permissions/guards'

interface Props { params: Promise<{ slug: string }> }

/**
 * GET /api/ws/[slug]/roles
 *
 * Returns every role in the workspace with its grid, plus the catalogue so the
 * client renders rows from the same source the server validates against, and
 * the caller's own grid so the UI can grey out cells it could not grant anyway.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Roles, Action.Read)
  if (!ctx) return forbidden()

  const [roles, counts] = await Promise.all([
    listWorkspaceRoles(ctx.workspace.id),
    getRoleMemberCounts(ctx.workspace.id),
  ])

  return NextResponse.json({
    roles: roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      scope: r.scope,
      isSystem: isSystemRole(r.key),
      memberCount: counts[r.key] ?? 0,
    })),
    resources: RESOURCES.map((r) => ({ key: r.key, label: r.label, actions: r.actions })),
    viewer: {
      roleKey: ctx.role.key,
      roleName: ctx.role.name,
      permissions: ctx.role.permissions,
      canWrite: can(ctx.role.permissions, Resource.Roles, Action.Write),
      canDelete: can(ctx.role.permissions, Resource.Roles, Action.Delete),
    },
  })
}

/**
 * POST /api/ws/[slug]/roles
 *
 * Create a custom role, optionally seeded from an existing one via
 * `duplicateFrom` (a role key). Duplicating is the main on-ramp: no templates
 * are seeded, so a first custom role would otherwise start from a blank grid.
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Roles, Action.Write)
  if (!ctx) return forbidden()

  let body: {
    name?: string
    description?: string | null
    permissions?: unknown
    duplicateFrom?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'A role name is required', code: 'INVALID_NAME' }, { status: 400 })
  }

  const key = roleKeyFromName(name)
  if (!key) {
    return NextResponse.json(
      { error: 'That name cannot be used — it must contain letters or numbers', code: 'INVALID_NAME' },
      { status: 400 },
    )
  }

  // Seed the grid from another role when duplicating, otherwise take the body.
  let rawPermissions: unknown = body.permissions ?? {}
  if (body.duplicateFrom) {
    const source = await getRoleByKey(ctx.workspace.id, body.duplicateFrom)
    if (!source) {
      return NextResponse.json({ error: 'Unknown role to duplicate', code: 'INVALID_ROLE' }, { status: 400 })
    }
    rawPermissions = source.permissions
  }

  // Scope is not a choice a custom role makes. Every /ws role sees the whole
  // workspace; seeing only your own data is what /me is, and every user already
  // has it regardless of role. Scope.Self is reserved for the seeded `member`
  // role, which means "no org surface at all". When the reporting hierarchy
  // lands the real choice becomes all-vs-subtree, and it comes back here.
  const scope = Scope.All

  // Runs guardCatalogue then guardEscalation (see lib/permissions/guards.ts).
  const validation = validateGridForSave({
    actorPermissions: ctx.role.permissions,
    rawPermissions,
  })
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.failure.message, code: validation.failure.code },
      { status: validation.failure.code === 'ESCALATION' ? 403 : 400 },
    )
  }

  const created = await createWorkspaceRole({
    workspaceId: ctx.workspace.id,
    key,
    name,
    description: body.description ?? null,
    permissions: validation.permissions,
    scope,
  })

  if (!created) {
    return NextResponse.json(
      { error: 'A role with that name already exists', code: 'DUPLICATE' },
      { status: 409 },
    )
  }

  return NextResponse.json({
    role: {
      id: created.id,
      key: created.key,
      name: created.name,
      description: created.description,
      permissions: created.permissions,
      scope: created.scope,
      isSystem: false,
      memberCount: 0,
    },
  })
}
