import { getServerUser } from "@/lib/auth";
import { getOpenEventToday, getUserEvents } from "@/lib/db/queries/events";
import {
  getUserWorkspaces,
  getWorkspacesByIds,
} from "@/lib/db/queries/workspaces";
import { getUserById } from "@/lib/db/queries/users";
import { queryWorkspaceEvents } from "@/lib/signals";
import {
  dateKeyInTimezone,
  summarizeAttendanceDays,
} from "@/lib/attendance-summary";
import { listHolidayDatesInRange } from "@/lib/db/queries/holidays";
import { monthBoundsUtc, todayInTz } from "@/lib/timezone";
import CheckinButtons from "@/components/user/CheckinButtons";
import EventCard from "@/components/user/EventCard";
import TimezoneReporter from "@/components/user/TimezoneReporter";
import WorkspacesStrip from "./WorkspacesStrip";
import { getRolesForUserWorkspaces } from "@/lib/db/queries/roles";
import { hasAnyOrgAccess } from "@/lib/permissions/can";

export default async function MePage() {
  const user = await getServerUser();
  if (!user) return null;

  const todayUtcStr = new Date().toISOString().split("T")[0];

  const [activeEvent, todayResult, memberships, profile, rolesByWorkspace] = await Promise.all([
    getOpenEventToday(user.userId),
    getUserEvents({
      userId: user.userId,
      start: `${todayUtcStr}T00:00:00.000Z`,
      end: `${todayUtcStr}T23:59:59.999Z`,
    }),
    getUserWorkspaces(user.userId),
    getUserById(user.userId),
    // Resolves each membership's role so the strip can show the display name
    // and decide whether to offer a link into the org dashboard.
    getRolesForUserWorkspaces(user.userId),
  ]);

  const todayEvents = todayResult.events;

  // Workspace names for the orgs strip
  const workspaceIds = memberships.map((m) => m.workspace_id);
  const workspaces = await getWorkspacesByIds(workspaceIds);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));
  const primaryMembership = memberships[0] ?? null;
  const primaryWorkspace = primaryMembership
    ? wsMap.get(primaryMembership.workspace_id)
    : null;

  let wfoDays = 0;
  let wfhDays = 0;
  let leaveDays = 0;
  let monthEvents: Awaited<ReturnType<typeof queryWorkspaceEvents>> = [];

  if (primaryMembership && primaryWorkspace) {
    const timezone = primaryWorkspace.display_timezone;
    const todayLocal = todayInTz(timezone);
    const [year, month] = todayLocal.split("-").map(Number);
    const monthStartLocal = `${year}-${String(month).padStart(2, "0")}-01`;
    const joinedLocal = dateKeyInTimezone(primaryMembership.added_at, timezone);
    const summaryStart =
      joinedLocal > monthStartLocal ? joinedLocal : monthStartLocal;
    const bounds = monthBoundsUtc(year, month, timezone);
    const [fetchedMonthEvents, holidayDates] = await Promise.all([
      queryWorkspaceEvents(primaryWorkspace.id, primaryWorkspace.plan, {
        startDate: bounds.start,
        endDate: bounds.end,
        userId: user.userId,
      }),
      listHolidayDatesInRange(primaryWorkspace.id, summaryStart, todayLocal),
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
  }

  // Use workspace-matched events for today when available (shows verified/partial/none badges)
  const displayTodayEvents =
    primaryMembership && primaryWorkspace
      ? monthEvents.filter((e) => e.checkin_at.slice(0, 10) === todayUtcStr)
      : todayEvents;

  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "20px 16px",
      }}
    >
      {/* Silent timezone reporter - keeps DB in sync with browser timezone */}
      <TimezoneReporter />

      {/* Check-in / checkout buttons (includes status line + active indicator) */}
      <CheckinButtons
        activeEvent={activeEvent}
        name={profile?.full_name ?? user.email.split("@")[0]}
        allowRemote={!!primaryWorkspace?.allow_remote}
      />

      {/* This month attendance summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          margin: "20px 0",
        }}
      >
        {(
          [
            {
              value: wfoDays,
              label: "WFO",
              sub: "this month",
              color: "var(--teal)",
            },
            {
              value: wfhDays,
              label: "WFH",
              sub: "this month",
              color: "var(--brand)",
            },
            {
              value: leaveDays,
              label: "On Leave",
              sub: "this month",
              color: "var(--amber)",
            },
          ] as const
        ).map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 8px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Playfair Display, serif",
                fontSize: "22px",
                fontWeight: 700,
                color: card.color,
                lineHeight: 1,
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginTop: "4px",
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontFamily: "Plus Jakarta Sans, sans-serif",
                fontSize: "10px",
                color: "var(--text-muted)",
                marginTop: "1px",
              }}
            >
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Today's events */}
      {displayTodayEvents.length > 0 && (
        <section style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Today
          </h2>
          {displayTodayEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      )}

      {/* Workspaces strip */}
      <WorkspacesStrip
        items={memberships.flatMap((m) => {
          const ws = wsMap.get(m.workspace_id);
          if (!ws) return [];
          const role = rolesByWorkspace[m.workspace_id];
          return [{
            id: m.id,
            slug: ws.slug,
            name: ws.name,
            // Display name, never the raw key - `hr-manager` would otherwise
            // render as "Hr-manager".
            role: role?.name ?? m.role,
            hasOrgAccess: hasAnyOrgAccess(role?.permissions),
          }];
        })}
      />

      {/* Empty state - no activity yet */}
      {displayTodayEvents.length === 0 && memberships.length === 0 && (
        <div
          style={{
            marginTop: "32px",
            padding: "32px 20px",
            textAlign: "center",
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <p
            style={{
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: "15px",
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            Tap &ldquo;I&apos;m here&rdquo; when you arrive somewhere.
          </p>
          <p
            style={{
              fontFamily: "Plus Jakarta Sans, sans-serif",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            Your check-in history will build up here over time.
          </p>
        </div>
      )}
    </div>
  );
}
