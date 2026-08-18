import { NextRequest, NextResponse } from 'next/server'
import { requireWsAdmin } from '@/lib/ws-admin'
import { todayInTz } from '@/lib/timezone'
import { getMembersOnLeaveToday } from '@/lib/db/queries/leaves'
import { getPendingApprovalItems, type ApprovalItem } from '@/lib/approvals'
import {
  getDepartmentBreakdown,
  getUpcomingCelebrations,
  type DepartmentBreakdown,
  type UpcomingCelebration,
} from '@/lib/db/queries/employees'

export interface OverviewWidgetsResponse {
  onLeaveToday: number
  pendingApprovals: ApprovalItem[]
  pendingApprovalsTotal: number
  departmentBreakdown: DepartmentBreakdown[]
  celebrations: UpcomingCelebration[]
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(req, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const today = todayInTz(ctx.workspace.display_timezone)

  const [onLeaveMembers, approvals, departmentBreakdown, celebrations] = await Promise.all([
    getMembersOnLeaveToday(ctx.workspace.id, today),
    getPendingApprovalItems(ctx.workspace.id, { leavesEnabled: !!ctx.workspace.leaves_enabled }),
    getDepartmentBreakdown(ctx.workspace.id),
    getUpcomingCelebrations(ctx.workspace.id, today, 14),
  ])

  return NextResponse.json({
    onLeaveToday: onLeaveMembers.length,
    pendingApprovals: approvals.items.slice(0, 5),
    pendingApprovalsTotal: approvals.items.length,
    departmentBreakdown,
    celebrations,
  } satisfies OverviewWidgetsResponse)
}
