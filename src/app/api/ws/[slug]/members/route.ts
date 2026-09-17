import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import {
  getAllMembersWithDetailsPaged,
  getWorkspaceDepartments,
  getWorkspaceDomains,
  getWorkspaceMemberByEmail,
  parseDirectoryStatus,
  upsertInvitedMember,
} from "@/lib/db/queries/workspaces";
import { listWorkspaceRoles } from '@/lib/db/queries/roles'
import { can } from '@/lib/permissions/can'
import { canGrant } from '@/lib/permissions/ranks'
import { sendConsentEmail } from '@/lib/email'
import { getUserByEmail } from '@/lib/db/queries/users'
import { deleteNotificationsByRef } from '@/lib/db/queries/notifications'
import { notify } from '@/lib/notify'
import { invitationNotification } from '@/locales/en/notifications'
import { findEmployeeByWorkEmail } from '@/lib/db/queries/employees'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(request, slug, Resource.Members, Action.Read)
  if (!ctx) return forbidden()

  const sp = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get("limit") ?? "25", 10), 100);
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10));
  const search = sp.get("search") ?? "";
  const department = sp.get("department") ?? undefined;
  const status = parseDirectoryStatus(sp.get("status"));

  // This screen is the workforce directory as well as the membership list, so
  // it carries HR columns. They are a SEPARATE permission: `members:read` says
  // who is in the workspace, `employees:read` says what their job title is.
  // Stripped server-side rather than hidden in the table - a column omitted
  // from the UI while still in the JSON is not a permission check.
  const mayReadEmployees = can(ctx.role.permissions, Resource.Employees, Action.Read)

  const [{ members: rawMembers, total }, allRoles, departments] = await Promise.all([
    getAllMembersWithDetailsPaged({
      workspaceId: ctx.workspace.id,
      limit,
      offset,
      search,
      department,
      status,
    }),
    listWorkspaceRoles(ctx.workspace.id),
    mayReadEmployees ? getWorkspaceDepartments(ctx.workspace.id) : Promise.resolve([]),
  ]);

  // An ALLOW-list, not an omit-list. A deny-list silently starts leaking the
  // day somebody adds a column to MemberWithUserFull and forgets this line;
  // naming what may be sent means a new column is invisible until someone
  // decides it should not be.
  const members = mayReadEmployees
    ? rawMembers
    : rawMembers.map((m) => ({
        member_id: m.member_id,
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        email: m.email,
        role: m.role,
        status: m.status,
        full_name: m.full_name,
        added_at: m.added_at,
      }))

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
    departments,
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
      // Drives whether the directory renders its HR columns and the Add
      // employee button at all. The strip above is what actually enforces it.
      readEmployees: mayReadEmployees,
      writeEmployees: can(ctx.role.permissions, Resource.Employees, Action.Write),
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

  // A PENDING INVITATION IS NOT A REFUSAL. Re-sending is the normal repair for
  // a link that was lost, filtered or left to expire, and the old
  // `409 INVITE_PENDING` meant the only way to fix one was to delete the
  // membership first. Every send issues a fresh 7-day token and resets the row
  // to `pending_consent`, so the previous link dies at the moment this one is
  // created.
  //
  // `consent_token` is what says an invitation has ever been sent - a row
  // created by Add employee has none - so it is what tells a first invite from
  // a re-send. The caller says which happened; nothing here behaves differently.
  const resent = existing?.consent_token != null

  const consentToken = crypto.randomUUID()
  const consentTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const member = await upsertInvitedMember({
    workspaceId: ctx.workspace.id,
    email,
    consentToken,
    consentTokenExpiresAt,
  })

  // THE IN-APP HALF OF THE INVITATION.
  //
  // Only for an address that already has an account - a notification needs a
  // `user_id`, and there is nobody to write one for otherwise. For a stranger
  // the email below stays the only channel, and the in-app row is written at
  // registration instead (`POST /api/auth/register`), once there is an account
  // to address.
  //
  // Through `notify()` rather than `createNotification` + `sendPushToUser`
  // (invariant 24). The `membership` category is deliberately not
  // `workspaceSwitchable`, so `notify()` cannot return at its step 2 and drop
  // this: a workspace must not be able to silence the invitation it is itself
  // sending. See `CATEGORY_DEFS.membership`.
  //
  // `refId` is the MEMBERSHIP id, which is what `POST /api/me/consent` is keyed
  // on and what the feed's LEFT JOIN reads the live status back through. Never
  // the consent token: that is a credential, it is issued to an inbox, and it
  // rotates on every re-send.
  const invitee = await getUserByEmail(email)
  if (invitee) {
    // Re-sending is the normal repair for a lost or expired link, and every
    // send mints a fresh token. Without this, three re-sends leave three rows
    // in the feed pointing at one membership - all looking equally live, two of
    // them describing a token that is already dead. Nothing is being unsent
    // (invariant 22): the same offer is being replaced by the same offer with a
    // longer deadline, in one breath.
    await deleteNotificationsByRef({
      userId: invitee.id,
      type: 'invitation',
      refId: member.id,
    })
    await notify({
      userIds: [invitee.id],
      workspaceId: ctx.workspace.id,
      workspaceSlug: ctx.workspace.slug,
      type: 'invitation',
      title: invitationNotification.title(ctx.workspace.name),
      body: invitationNotification.body(ctx.workspace.name),
      refId: member.id,
      refType: 'workspace_member',
      // `/me`, always. The recipient is not a member of this workspace yet, so
      // every `/ws/:slug` screen would refuse them.
      surface: 'me',
    })
  }

  // If HR already filled their record in - the usual order now that People has
  // an Add employee flow - greet them by the name on it.
  const record = await findEmployeeByWorkEmail(ctx.workspace.id, email)
  const recipientName = record
    ? `${record.first_name} ${record.last_name}`.trim() || null
    : null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendConsentEmail({
    to: email,
    workspaceName: ctx.workspace.name,
    consentToken,
    appUrl,
    recipientName,
  })

  return NextResponse.json({ success: true, resent })
}
