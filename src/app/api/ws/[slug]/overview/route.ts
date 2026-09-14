import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { todayInTz } from '@/lib/timezone'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { getMembersOnLeaveToday } from '@/lib/db/queries/leaves'
import { getPendingApprovalItems, type ApprovalItem } from '@/lib/approvals'
import {
  getDepartmentBreakdown,
  type DepartmentHeadcount,
} from '@/lib/db/queries/employees'
import { Action, Resource } from '@/lib/permissions/catalogue'

export interface OverviewWidgetsResponse {
  /**
   * Active workspace members - the headline headcount.
   *
   * NOT a count of `employees` rows: an HR record is created lazily, so a real
   * 34-member workspace can hold a single one, and a dashboard whose headline
   * number is 1 while 34 people check in daily is worse than no dashboard.
   */
  activeMembers: number
  onLeaveToday: number
  pendingApprovals: ApprovalItem[]
  pendingApprovalsTotal: number
  departmentBreakdown: DepartmentHeadcount
}

// Celebrations left this payload when the widget gained a month stepper: it is
// addressed by month now, so it owns its own fetch against
// GET /api/ws/[slug]/celebrations rather than riding on a route with no params.

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Dashboard, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const today = todayInTz(ctx.workspace.display_timezone)

  const [memberIds, onLeaveMembers, approvals, departmentBreakdown] = await Promise.all([
    getActiveMemberIds(ctx.workspace.id),
    getMembersOnLeaveToday(ctx.workspace.id, today),
    // ctx.role decides whether the document items are in this feed at all -
    // this route is gated on dashboard:read, which does not imply
    // documents:read. See getPendingApprovalItems.
    getPendingApprovalItems(ctx.workspace.id, {
      leavesEnabled: !!ctx.workspace.leaves_enabled,
      viewer: ctx.role,
    }),
    getDepartmentBreakdown(ctx.workspace.id),
  ])

  return NextResponse.json({
    activeMembers: memberIds.length,
    onLeaveToday: onLeaveMembers.length,
    // Unsliced. The widget is a fixed-height card with its own scroll body, so
    // capping at five bought nothing except an approvals queue that claimed to
    // be five items long. `pendingApprovalsTotal` still feeds the greeting line.
    pendingApprovals: approvals.items,
    pendingApprovalsTotal: approvals.items.length,
    departmentBreakdown,
  } satisfies OverviewWidgetsResponse)
}
