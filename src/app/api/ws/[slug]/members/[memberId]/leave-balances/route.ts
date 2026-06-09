import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { getWorkspaceMemberByRecordId } from '@/lib/db/queries/workspaces'
import {
  getMemberOpeningBalances,
  upsertOpeningBalance,
  getWorkspaceLeaveTypes,
} from '@/lib/db/queries/leaves'

interface Props { params: Promise<{ slug: string; memberId: string }> }

// ─── GET /api/ws/[slug]/members/[memberId]/leave-balances ─────────────────────

export async function GET(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member) return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!member.user_id) return NextResponse.json({ error: 'Member has not accepted the invitation', code: 'MEMBER_PENDING' }, { status: 422 })

  const balances = await getMemberOpeningBalances(ctx.workspace.id, member.user_id)
  return NextResponse.json({ balances })
}

// ─── PUT /api/ws/[slug]/members/[memberId]/leave-balances ─────────────────────
// Body: array of { leave_type_id, balance_days, note? }

export async function PUT(req: NextRequest, { params }: Props) {
  const { slug, memberId } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const member = await getWorkspaceMemberByRecordId(memberId, ctx.workspace.id)
  if (!member) return NextResponse.json({ error: 'Member not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!member.user_id) return NextResponse.json({ error: 'Member has not accepted the invitation', code: 'MEMBER_PENDING' }, { status: 422 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an array', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  // Validate all leave_type_ids belong to this workspace
  const leaveTypes = await getWorkspaceLeaveTypes(ctx.workspace.id)
  const validTypeIds = new Set(leaveTypes.map((t) => t.id))

  const results = []
  for (const item of body) {
    if (typeof item !== 'object' || item === null) continue
    const { leave_type_id, balance_days, note } = item as Record<string, unknown>

    if (typeof leave_type_id !== 'string' || !validTypeIds.has(leave_type_id)) {
      return NextResponse.json(
        { error: `Invalid leave_type_id: ${leave_type_id}`, code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    if (typeof balance_days !== 'number' || balance_days < 0) {
      return NextResponse.json(
        { error: 'balance_days must be a non-negative number', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const row = await upsertOpeningBalance({
      workspaceId: ctx.workspace.id,
      userId: member.user_id,
      leaveTypeId: leave_type_id,
      balanceDays: balance_days,
      note: typeof note === 'string' ? note : null,
    })
    results.push(row)
  }

  return NextResponse.json({ balances: results })
}
