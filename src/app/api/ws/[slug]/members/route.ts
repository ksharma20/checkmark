import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import {
  getAllMembersWithDetailsPaged,
  getWorkspaceDomains,
  getWorkspaceMemberByEmail,
  upsertInvitedMember,
} from "@/lib/db/queries/workspaces";
import { listWorkspaceRoles } from '@/lib/db/queries/roles'
import { can } from '@/lib/permissions/can'
import { canGrant } from '@/lib/permissions/ranks'
import { sendConsentEmail } from '@/lib/email'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Members, Action.Read)
  if (!ctx) return forbidden()

  const sp = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get("limit") ?? "10", 10), 100);
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10));
  const search = sp.get("search") ?? "";

  const [{ members, total }, allRoles] = await Promise.all([
    getAllMembersWithDetailsPaged({
      workspaceId: ctx.workspace.id,
      limit,
      offset,
      search,
    }),
    listWorkspaceRoles(ctx.workspace.id),
  ]);

  // Only offer roles the caller is actually allowed to hand out, and only when
  // their role permits assigning at all. The dropdown therefore never renders
  // an option that the server would reject - and the server re-checks anyway,
  // because a hidden option is still a craftable request.
  const mayAssign = can(ctx.role.permissions, Resource.AssignRoles, Action.Write)
  const mayTransferOwnership = can(ctx.role.permissions, Resource.Ownership, Action.Write)

  const grantable = mayAssign
    ? allRoles.filter((r) => canGrant(ctx.role.key, r.key))
    : []

  // `owner` is a deliberate special case and can never arrive via the rank
  // filter above: canGrant requires STRICTLY greater rank, so owner→owner is
  // false and nobody can "grant" ownership. It is appended for holders of
  // `ownership:write` because picking it in the dropdown does not assign a
  // role at all - the People page routes that choice into the OTP-gated
  // transfer flow. PATCH .../role still rejects 'owner' with USE_TRANSFER, so
  // a craftable request gains nothing from this option being listed.
  const ownerRole = mayTransferOwnership
    ? allRoles.find((r) => r.key === 'owner')
    : undefined

  // `restricted` marks an option that is NOT a plain role assignment, so the
  // People page can render it differently (greyed, padlocked) instead of
  // hardcoding a check for the owner key in the view layer.
  const assignableRoles = [
    ...grantable.map((r) => ({
      key: r.key,
      name: r.name,
      description: r.description,
      restricted: false,
    })),
    ...(ownerRole
      ? [{
          key: ownerRole.key,
          name: ownerRole.name,
          description: ownerRole.description,
          restricted: true,
        }]
      : []),
  ]

  return NextResponse.json({
    members,
    total,
    viewerRole: { key: ctx.role.key, name: ctx.role.name },
    assignableRoles,
    roleNames: Object.fromEntries(allRoles.map((r) => [r.key, r.name])),
    permissions: {
      assignRoles: mayAssign,
      removeMembers: can(ctx.role.permissions, Resource.Members, Action.Delete),
      editMembers: can(ctx.role.permissions, Resource.Members, Action.Write),
      // Owner-only in the seeded grids - admins deliberately lack
      // `ownership:write` so they cannot hand the workspace to themselves.
      // Drives whether `owner` appears in assignableRoles above, and is
      // re-checked by POST /transfer-ownership.
      transferOwnership: mayTransferOwnership,
    },
    pagination: {
      offset,
      limit,
      nextOffset:
        offset + members.length < total ? offset + members.length : null,
    },
  });
}

export async function POST(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Members, Action.Write)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  let body: { email?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body', code: 'INVALID_BODY' }, { status: 400 })
  }

  const email = (body.email ?? '').toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required', code: 'MISSING_EMAIL' }, { status: 400 })
  }

  const emailDomain = email.split('@')[1]
  const workspaceDomains = await getWorkspaceDomains(ctx.workspace.id)
  const isDomainVerified = workspaceDomains.some(d => d.domain === emailDomain && d.verified_at !== null)
  if (isDomainVerified) {
    return NextResponse.json({
      error: `The domain @${emailDomain} is verified for this workspace - people with this email domain join automatically when they sign up. No invite needed.`,
      code: 'DOMAIN_AUTO_ENROL',
    }, { status: 409 })
  }

  const existing = await getWorkspaceMemberByEmail(ctx.workspace.id, email)
  if (existing?.status === 'active') {
    return NextResponse.json({ error: 'This person is already an active member', code: 'ALREADY_MEMBER' }, { status: 409 })
  }

  // Block re-invite if consent is already pending - don't silently reset their token
  if (existing?.status === 'pending_consent') {
    return NextResponse.json(
      {
        error: 'An invite is already pending for this email. Wait for them to respond, or remove the existing invite first.',
        code: 'INVITE_PENDING',
      },
      { status: 409 }
    )
  }

  const consentToken = crypto.randomUUID()
  const consentTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await upsertInvitedMember({
    workspaceId: ctx.workspace.id,
    email,
    consentToken,
    consentTokenExpiresAt,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendConsentEmail({
    to: email,
    workspaceName: ctx.workspace.name,
    consentToken,
    appUrl,
  })

  return NextResponse.json({ success: true })
}
