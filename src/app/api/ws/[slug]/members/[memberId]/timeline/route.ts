import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/lib/db/queries/workspaces";
import { db } from "@/lib/db";
import { queryWorkspaceEvents } from "@/lib/signals";
import { historyStartDate } from "@/lib/plans";
import { todayInTz } from "@/lib/timezone";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; memberId: string }> },
) {
  const adminId = request.headers.get("x-user-id");
  if (!adminId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, memberId: targetUserId } = await params;

  const ws = await getWorkspaceBySlug(slug);
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify requester is admin of this workspace
  const adminCheck = await db.queryOne<{ role: string }>(
    `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
    [ws.id, adminId],
  );
  if (!adminCheck || adminCheck.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify target is an active member
  const member = await db.queryOne<{
    user_id: string;
    full_name: string | null;
    email: string;
    role: string;
    added_at: string;
  }>(
    `SELECT wm.user_id, u.full_name, wm.email, wm.role, wm.added_at
     FROM workspace_members wm
     LEFT JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.status = 'active'`,
    [ws.id, targetUserId],
  );
  if (!member)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const stats = await db.queryOne<{
    current_streak: number;
    total_checkins: number;
  }>(
    "SELECT current_streak, total_checkins FROM user_stats WHERE user_id = ?",
    [targetUserId],
  );

  const url = new URL(request.url);
  const historyGate = historyStartDate(ws.plan);
  const today = todayInTz(ws.display_timezone);
  const start = url.searchParams.get("start") ?? historyGate ?? "2020-01-01";
  const end = url.searchParams.get("end") ?? today;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = 20;

  const allEvents = await queryWorkspaceEvents(ws.id, ws.plan, {
    startDate: start,
    endDate: end + "T23:59:59Z",
    userId: targetUserId,
  });

  const total = allEvents.length;
  const events = allEvents.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    member: {
      ...member,
      current_streak: stats?.current_streak ?? 0,
      total_checkins: stats?.total_checkins ?? 0,
    },
    events,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
