import { NextRequest, NextResponse } from "next/server";
import { requireWsAdmin } from "@/lib/ws-admin";
import { queryWorkspaceEvents } from "@/lib/signals";
import { getWorkspaceSignals } from "@/lib/db/queries/signals";
import { getActiveMembersWithDetails } from "@/lib/db/queries/workspaces";
import { getPlanLimits } from "@/lib/plans";
import {
  countWorkdays,
  dateKeyInTimezone,
  nextDateKey,
  summarizeAttendanceDays,
} from "@/lib/attendance-summary";
import { localMidnightToUtc, todayInTz } from "@/lib/timezone";

interface Props {
  params: Promise<{ slug: string }>;
}

export type DayStatus = "office" | "remote" | "absent" | "future";

export interface MemberMonthRow {
  user_id: string;
  name: string;
  email: string;
  joined_date: string; // YYYY-MM-DD in workspace timezone — days before this are pre-join
  days: Record<string, DayStatus>; // key = 'YYYY-MM-DD'
  office_days: number;
  remote_days: number;
  absent_days: number;
}

export interface MonthlyResponse {
  year: number;
  month: number;
  days_in_month: number;
  working_days: number;
  signals_configured: boolean;
  members: MemberMonthRow[];
}

/**
 * GET /api/ws/[slug]/monthly?year=YYYY&month=M
 *
 * Returns per-day attendance status for each active member in the given month.
 * Defaults to current month.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;
  const ctx = await requireWsAdmin(request, slug);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { workspace } = ctx;
  const url = new URL(request.url);
  const tz = workspace.display_timezone;
  const todayStr = todayInTz(tz);
  const [defaultYear, defaultMonth] = todayStr.split("-").map(Number);

  const year = parseInt(
    url.searchParams.get("year") ?? String(defaultYear),
    10,
  );
  const month = parseInt(
    url.searchParams.get("month") ?? String(defaultMonth),
    10,
  );

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  // Plan history gate check
  const planLimits = getPlanLimits(workspace.plan);
  if (planLimits.historyMonths !== null) {
    const gateDate = new Date();
    gateDate.setMonth(gateDate.getMonth() - planLimits.historyMonths);
    const requestDate = new Date(year, month - 1, 1);
    if (requestDate < gateDate) {
      return NextResponse.json(
        {
          error: "Date range outside plan history window",
          code: "PLAN_HISTORY_GATE",
        },
        { status: 402 },
      );
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const startUtc = localMidnightToUtc(startDate, tz);
  const endUtc = localMidnightToUtc(nextDateKey(endDate), tz);

  const [allEvents, memberDetails, workspaceSignals] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, {
      startDate: startUtc,
      endDate: endUtc,
    }),
    getActiveMembersWithDetails(workspace.id),
    getWorkspaceSignals(workspace.id),
  ]);

  const signals_configured = workspaceSignals.length > 0;
  const effectiveEndDate = endDate > todayStr ? todayStr : endDate;
  const working_days = countWorkdays(startDate, effectiveEndDate);
  const byUser = new Map<string, typeof allEvents>();
  for (const ev of allEvents) {
    const userEvents = byUser.get(ev.user_id) ?? [];
    userEvents.push(ev);
    byUser.set(ev.user_id, userEvents);
  }

  const members: MemberMonthRow[] = memberDetails.map((member) => {
    const joinedLocal = dateKeyInTimezone(member.added_at, tz);
    const memberStartDate = joinedLocal > startDate ? joinedLocal : startDate;
    const summary = summarizeAttendanceDays({
      events: byUser.get(member.user_id) ?? [],
      startDate: memberStartDate,
      endDate,
      timezone: tz,
      todayDate: todayStr,
    });

    return {
      user_id: member.user_id,
      name: member.full_name ?? member.email,
      email: member.email,
      joined_date: memberStartDate,
      days: summary.days,
      office_days: summary.officeDays,
      remote_days: summary.remoteDays,
      absent_days: summary.absentDays,
    };
  });

  members.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    year,
    month,
    days_in_month: daysInMonth,
    working_days,
    signals_configured,
    members,
  } satisfies MonthlyResponse);
}
