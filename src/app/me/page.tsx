import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { getOpenEventToday, getUserEvents } from "@/lib/db/queries/events";
import {
  getUserWorkspaces,
  getWorkspacesByIds,
} from "@/lib/db/queries/workspaces";
import { getUserById } from "@/lib/db/queries/users";
import { getUserStats } from "@/lib/db/queries/stats";
import { getLeaveTypesWithBalance } from "@/lib/db/queries/leaves";
import { queryWorkspaceEvents, type MatchedBy } from "@/lib/signals";
import {
  dateKeyInTimezone,
  summarizeAttendanceDays,
} from "@/lib/attendance-summary";
import { listHolidayDatesInRange } from "@/lib/db/queries/holidays";
import { monthBoundsUtc, todayInTz, localMidnightToUtc } from "@/lib/timezone";
import { StatCard } from "@/components/ui";
import CheckinButtons, {
  type TodaySession,
} from "@/components/user/CheckinButtons";
import { me } from "@/locales/en/me";
import { resolveActiveWorkspaceSlug } from "./active-workspace";

/** Day after `YYYY-MM-DD`, used to close the workspace-local "today" window. */
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Hour-of-day in `tz`, so the greeting is right for the member, not the server. */
function hourInTz(tz: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hour) % 24;
}

function greetingFor(hour: number): string {
  if (hour < 12) return me.home.greetingMorning;
  if (hour < 17) return me.home.greetingAfternoon;
  return me.home.greetingEvening;
}

export default async function MePage() {
  const user = await getServerUser();
  if (!user) return null;

  const todayUtcStr = new Date().toISOString().split("T")[0];

  const [activeEvent, todayResult, memberships, profile, stats] =
    await Promise.all([
      getOpenEventToday(user.userId),
      getUserEvents({
        userId: user.userId,
        start: `${todayUtcStr}T00:00:00.000Z`,
        end: `${todayUtcStr}T23:59:59.999Z`,
      }),
      getUserWorkspaces(user.userId),
      getUserById(user.userId),
      getUserStats(user.userId),
    ]);

  const todayEvents = todayResult.events;

  const workspaceIds = memberships.map((m) => m.workspace_id);
  const workspaces = await getWorkspacesByIds(workspaceIds);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));

  // The summary follows the same active workspace the shell's pill names, so
  // the numbers here always belong to the workspace shown above them. Archived
  // ones are dropped first - the pill hides them too.
  const activeMemberships = memberships.flatMap((m) => {
    const ws = wsMap.get(m.workspace_id);
    return ws && !ws.archived_at ? [{ membership: m, workspace: ws }] : [];
  });
  const activeSlug = await resolveActiveWorkspaceSlug(
    activeMemberships.map((x) => x.workspace.slug),
  );
  const active =
    activeMemberships.find((x) => x.workspace.slug === activeSlug) ?? null;
  const primaryMembership = active?.membership ?? null;
  const primaryWorkspace = active?.workspace ?? null;

  let wfoDays = 0;
  let wfhDays = 0;
  let leaveDays = 0;
  let leaveLeft = 0;
  let inOfficeNow = 0;
  let monthEvents: Awaited<ReturnType<typeof queryWorkspaceEvents>> = [];

  // Fall back to the member's own reported timezone, then UTC, so the greeting
  // and date line still render for someone with no workspace yet.
  const timezone =
    primaryWorkspace?.display_timezone ?? profile?.timezone ?? "UTC";

  if (primaryMembership && primaryWorkspace) {
    const todayLocal = todayInTz(timezone);
    const [year, month] = todayLocal.split("-").map(Number);
    const monthStartLocal = `${year}-${String(month).padStart(2, "0")}-01`;
    const joinedLocal = dateKeyInTimezone(primaryMembership.added_at, timezone);
    const summaryStart =
      joinedLocal > monthStartLocal ? joinedLocal : monthStartLocal;
    const bounds = monthBoundsUtc(year, month, timezone);

    const workingDayNums: number[] = (() => {
      try {
        return JSON.parse(primaryWorkspace.working_days ?? "[1,2,3,4,5]");
      } catch {
        return [1, 2, 3, 4, 5];
      }
    })();

    const [fetchedMonthEvents, holidayDates, leaveTypes, todayWorkspaceEvents] =
      await Promise.all([
        queryWorkspaceEvents(primaryWorkspace.id, primaryWorkspace.plan, {
          startDate: bounds.start,
          endDate: bounds.end,
          userId: user.userId,
        }),
        listHolidayDatesInRange(primaryWorkspace.id, summaryStart, todayLocal),
        primaryWorkspace.leaves_enabled
          ? getLeaveTypesWithBalance(
              primaryWorkspace.id,
              user.userId,
              primaryMembership.added_at,
              workingDayNums,
              primaryWorkspace.leave_cutover_date,
            )
          : Promise.resolve([]),
        // Workspace-wide, today only - powers the "N in office right now" peek.
        queryWorkspaceEvents(primaryWorkspace.id, primaryWorkspace.plan, {
          startDate: localMidnightToUtc(todayLocal, timezone),
          endDate: localMidnightToUtc(nextDay(todayLocal), timezone),
        }),
      ]);

    monthEvents = fetchedMonthEvents;
    const summary = summarizeAttendanceDays({
      events: monthEvents,
      startDate: summaryStart,
      endDate: todayLocal,
      timezone,
      todayDate: todayLocal,
      holidayDates,
    });

    wfoDays = summary.officeDays;
    wfhDays = summary.remoteDays;
    leaveDays = summary.absentDays;
    leaveLeft = leaveTypes.reduce((sum, t) => sum + t.available_days, 0);

    // "In office right now" = still checked in AND the workspace's configured
    // signals all matched (or an admin overrode). Same AND semantics the org
    // dashboard uses; a partial match is not office presence.
    inOfficeNow = new Set(
      todayWorkspaceEvents
        .filter(
          (e) =>
            !e.checkout_at &&
            (e.matched_by === "verified" || e.matched_by === "override"),
        )
        .map((e) => e.user_id),
    ).size;
  }

  // Prefer workspace-matched rows for today so the session list can show the
  // verified/partial badge; fall back to the raw events when there is no
  // workspace to match against.
  const displayTodayEvents =
    primaryMembership && primaryWorkspace
      ? monthEvents.filter((e) => e.checkin_at.slice(0, 10) === todayUtcStr)
      : todayEvents;

  const todaySessions: TodaySession[] = displayTodayEvents.map((e) => ({
    id: e.id,
    checkin_at: e.checkin_at,
    checkout_at: e.checkout_at,
    event_type: e.event_type,
    matched_by: "matched_by" in e ? (e.matched_by as MatchedBy) : null,
  }));

  const firstName = (profile?.full_name?.trim() || user.email.split("@")[0])
    .split(/\s+/)[0];

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <>

      <div className="fx-spring">
        <h1 className="t-h1" style={{ marginTop: "4px" }}>
          {greetingFor(hourInTz(timezone))}, {firstName}
        </h1>
        <p className="t-secondary" style={{ marginTop: "2px" }}>
          {dateLabel}
        </p>
      </div>

      <CheckinButtons
        activeEvent={activeEvent}
        allowRemote={!!primaryWorkspace?.allow_remote}
        streak={stats?.current_streak ?? 0}
        todaySessions={todaySessions}
      />

      {primaryWorkspace ? (
        <div className="me-statgrid fx-spring">
          <StatCard label={me.home.statWfo} value={wfoDays} accent="brand" />
          <StatCard label={me.home.statWfh} value={wfhDays} />
          <StatCard label={me.home.statLeaveTaken} value={leaveDays} />
          <StatCard
            label={me.home.statLeaveLeft}
            value={leaveLeft.toFixed(1)}
          />
        </div>
      ) : (
        <div className="card fx-spring" style={{ marginTop: "14px" }}>
          <p className="t-h2">{me.home.noWorkspaceTitle}</p>
          <p className="t-secondary" style={{ marginTop: "6px" }}>
            {me.home.noWorkspaceBody}
          </p>
        </div>
      )}

      {primaryWorkspace && (
        <Link
          href="/me/workspace"
          className="card rowlink fx-spring"
          aria-label={me.home.openWorkspace}
          style={{
            marginTop: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            textDecoration: "none",
            color: "var(--text-primary)",
          }}
        >
          <span>
            <span
              className="t-eyebrow"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {me.home.workspaceEyebrow}
              <span className="livedot" aria-hidden="true" />
            </span>
            <span
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: "14px",
                marginTop: "4px",
              }}
            >
              {me.home.inOfficeNow(inOfficeNow)}
            </span>
          </span>
          <span className="t-muted" aria-hidden="true" style={{ fontSize: "18px" }}>
            ›
          </span>
        </Link>
      )}
    </>
  );
}
