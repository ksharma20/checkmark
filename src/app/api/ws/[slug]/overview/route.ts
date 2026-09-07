import { NextRequest, NextResponse } from 'next/server'
import { requireWsAccess } from '@/lib/ws-access'
import { todayInTz } from '@/lib/timezone'
import { getActiveMemberIds } from '@/lib/db/queries/workspaces'
import { getMembersOnLeaveToday } from '@/lib/db/queries/leaves'
import { getPendingApprovalItems, type ApprovalItem } from '@/lib/approvals'
import {
  getDepartmentBreakdown,
  getUpcomingCelebrations,
  type DepartmentHeadcount,
  type UpcomingCelebration,
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
  /**
   * The rest of the current calendar month, topped up to at least five.
   *
   * Not a fixed day window: a 14-day one emptied the card for most of the
   * month and then cut the list off mid-month for no reason a reader could
   * see. The count, not the horizon, is what the widget is sized for - see
   * getUpcomingCelebrations.
   */
  celebrations: UpcomingCelebration[]
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAccess(req, slug, Resource.Dashboard, Action.Read)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const today = todayInTz(ctx.workspace.display_timezone)

  const [memberIds, onLeaveMembers, approvals, departmentBreakdown, celebrations] = await Promise.all([
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
    getUpcomingCelebrations(ctx.workspace.id, today),
  ])

  return NextResponse.json({
    activeMembers: memberIds.length,
    onLeaveToday: onLeaveMembers.length,
    pendingApprovals: approvals.items.slice(0, 5),
    pendingApprovalsTotal: approvals.items.length,
    departmentBreakdown,
    celebrations,
  } satisfies OverviewWidgetsResponse)
}
