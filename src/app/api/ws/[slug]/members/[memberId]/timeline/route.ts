import { NextRequest, NextResponse } from "next/server";
import { requireWsAdmin } from "@/lib/ws-admin";
import {
  getWorkspaceBySlug,
  getActiveMemberWithDetails,
} from "@/lib/db/queries/workspaces";
import { queryWorkspaceEvents } from "@/lib/signals";
import { historyStartDate } from "@/lib/plans";
import { todayInTz } from "@/lib/timezone";
import { getUserStats } from "@/lib/db/queries/stats";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> },
) {
  const { slug, memberId: targetUserId } = await params;

  const ctx = await requireWsAdmin(request, slug);
  if (!ctx) {
    return NextResponse.json(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const ws = await getWorkspaceBySlug(slug);
  if (!ws)
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );

  const member = await getActiveMemberWithDetails(ws.id, targetUserId);
  if (!member) {
    return NextResponse.json(
      { error: "Member not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  const stats = await getUserStats(targetUserId);

  const url = new URL(request.url);
  const historyGate = historyStartDate(ws.plan);
  const today = todayInTz(ws.display_timezone);
  const start = url.searchParams.get("start") ?? historyGate ?? "2020-01-01";
  const end = url.searchParams.get("end") ?? today;
  const offset = Math.max(
    0,
    parseInt(url.searchParams.get("offset") ?? "0", 10),
  );
  const limit = 20;

  const startDay = start.slice(0, 10);
  const endDay = end.slice(0, 10);

  const allEvents = await queryWorkspaceEvents(ws.id, ws.plan, {
    startDate: `${startDay}T00:00:00Z`,
    endDate: `${endDay}T23:59:59Z`,
    userId: targetUserId,
  });

  const total = allEvents.length;
  const events = allEvents.slice(offset, offset + limit);

  return NextResponse.json({
    member: {
      ...member,
      current_streak: stats?.current_streak ?? 0,
      total_checkins: stats?.total_checkins ?? 0,
    },
    events,
    pagination: {
      offset,
      limit,
      total,
      nextOffset:
        offset + events.length < total ? offset + events.length : null,
    },
  });
}
