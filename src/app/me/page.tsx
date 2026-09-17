import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { getOpenEventToday, getUserEvents } from "@/lib/db/queries/events";
import {
  getUserWorkspaces,
  getWorkspacesByIds,
  getMembershipsByEmail,
  getVerifiedDomainsForEmail,
} from "@/lib/db/queries/workspaces";
import { isInviteExpired } from "@/lib/membership";
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
import JoinWorkspaceCard, {
  type JoinCardDomainWorkspace,
  type JoinCardInvite,
} from "./JoinWorkspaceCard";

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

  // With no workspace, the stat grid has nothing to count, so the create-or-join
  // card takes its place. Everything it needs is resolved HERE, in the Server
  // Component, rather than by the card fetching three things after it mounts -
  // this page is already awaiting a batch of queries, and a card that appears
  // empty and then fills in reads as a loading bug on the one screen a new
  // account lands on.
  //
  // Only fetched when there is no workspace: a member of one never sees the card
  // and must not pay for its queries on every home render.
  let joinInvites: JoinCardInvite[] = [];
  let joinDomainWorkspaces: JoinCardDomainWorkspace[] = [];

  if (!primaryWorkspace) {
    const [emailMemberships, domainWorkspaceIds] = await Promise.all([
      getMembershipsByEmail(user.email),
      getVerifiedDomainsForEmail(user.email),
    ]);

    const pending = emailMemberships.filter((m) => m.status === "pending_consent");
    const pendingWorkspaceIds = new Set(pending.map((m) => m.workspace_id));
    // A membership in ANY non-pending state - active, declined, revoked,
    // no_access - is a decision this workspace has already recorded, so the
    // domain offer would be re-offering something the row already answers.
    const knownWorkspaceIds = new Set(
      emailMemberships
        .filter((m) => m.status !== "pending_consent")
        .map((m) => m.workspace_id),
    );

    const domainOnlyIds = domainWorkspaceIds.filter(
      (id) => !pendingWorkspaceIds.has(id) && !knownWorkspaceIds.has(id),
    );

    const joinRows = await getWorkspacesByIds([
      ...pendingWorkspaceIds,
      ...domainOnlyIds,
    ]);
    const joinMap = new Map(joinRows.map((w) => [w.id, w]));

    // An archived workspace is not joinable, so neither row type may name one.
    joinInvites = pending.flatMap((m) => {
      const ws = joinMap.get(m.workspace_id);
      if (!ws || ws.archived_at) return [];
      return [{
        memberId: m.id,
        workspaceName: ws.name,
        // Decided on the server so SSR and hydration cannot land either side of
        // the deadline and flip the row under the reader.
        expired: isInviteExpired(m.consent_token_expires_at),
      }];
    });

    joinDomainWorkspaces = domainOnlyIds.flatMap((id) => {
      const ws = joinMap.get(id);
      if (!ws || ws.archived_at) return [];
      return [{ slug: ws.slug, name: ws.name }];
    });
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
        /* `id` is the anchor the top bar's "+ No workspace" pill points at, so
           the pill has somewhere to go from any `/me` screen. */
        <div id="join">
          <JoinWorkspaceCard
            invites={joinInvites}
            domainWorkspaces={joinDomainWorkspaces}
          />
        </div>
      )}

      {primaryWorkspace && primaryWorkspace.leaves_enabled ? (
        /* LEAVE LIVES HERE, not in the bottom nav. It exists only inside a
           workspace, and only when that workspace runs leave through CheckMark,
           so as a tab it was dead for every member without one. It sits below
           the stat grid, inside the part of this page already scoped to the
           active workspace - the two "Leave taken" / "Leave left" cards above it
           are what it acts on. The workspace is NOT named here: the top-bar pill
           above already answers which one. */
        <Link
          href="/me/leave"
          className="card rowlink fx-spring me-actionrow"
          aria-label={me.home.leaveCtaHint}
        >
          <span className="me-actionrow-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
            </svg>
          </span>
          <span className="me-actionrow-text">
            <span className="me-actionrow-title">{me.home.leaveCta}</span>
            <span className="t-muted me-actionrow-hint">{me.home.leaveCtaHint}</span>
          </span>
          <span className="t-muted me-actionrow-chev" aria-hidden="true">›</span>
        </Link>
      ) : null}

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
