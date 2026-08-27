"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { resolvePresenceTag, PRESENCE_TAG_CONFIG } from "@/lib/client/presence";
import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";
import RegularizationRequestModal from "@/components/user/RegularizationRequestModal";
import { en } from "@/locales/en";

interface WorkspaceTodayResponse {
  workspace: { id: string; name: string; slug: string };
  viewerRole: string;
  members: MemberTodaySummary[];
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

type MemberDisplayStatus = "in_office" | "remote" | "not_in";

interface LeaveTypeWithBalance {
  id: string
  name: string
  accrual_frequency: 'monthly' | 'quarterly'
  accrual_credits: number
  available_days: number
  total_accrued: number
  used_days: number
}

interface MemberOnLeaveToday {
  user_id: string
  full_name: string | null
  email: string
  leave_type_name: string
}

interface LeaveRequestWithType {
  id: string
  leave_type_id: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
  created_at: string
}

interface RegularizationRequest {
  id: string
  target_date: string
  requested_type: "office" | "remote"
  reason: string
  status: "pending" | "approved" | "rejected"
  rejection_reason: string | null
  created_at: string
}

function resolveMemberDisplayStatus(m: MemberTodaySummary): MemberDisplayStatus {
  if (m.presence_status === "notIn") return "not_in";
  if (m.presence_status === "visited") return "remote";
  const tag = resolvePresenceTag(m.presence_status, m.matched_by, m.event_type);
  return tag === "in_office" ? "in_office" : "remote";
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: "var(--brand)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontFamily: "Syne, sans-serif",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {(name ?? "?")[0].toUpperCase()}
    </div>
  );
}

function MemberRow({ m }: { m: MemberTodaySummary }) {
  const status = resolveMemberDisplayStatus(m);
  const cfg =
    status === "not_in"
      ? PRESENCE_TAG_CONFIG["not_in"]
      : status === "remote"
        ? { label: en.meWsToday.badgeRemote, color: "var(--amber)" }
        : PRESENCE_TAG_CONFIG["in_office"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Avatar name={m.full_name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.full_name ?? m.email}
        </p>
      </div>
      <span
        style={{
          fontSize: "11px",
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
          color: cfg.color,
          background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
          padding: "2px 8px",
          borderRadius: "20px",
          border: `1px solid ${cfg.color}`,
          whiteSpace: "nowrap",
        }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string): { display: string; dayName: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    display: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    dayName: date.toLocaleDateString("en-IN", { weekday: "short" }),
  };
}

type AccordionTab = "office" | "remote" | "leave" | "onLeave" | "holidays" | "myLeaves" | "regularizations";

const TABS: { key: AccordionTab; label: string; accentColor: string }[] = [
  {
    key: "office",
    label: en.meWsToday.tabPeopleInOffice,
    accentColor: "var(--teal)",
  },
  {
    key: "remote",
    label: en.meWsToday.tabPeopleRemote,
    accentColor: "var(--amber)",
  },
  {
    key: "leave",
    label: en.meWsToday.tabPeopleNotCheckedIn,
    accentColor: "var(--brand)",
  },
  {
    key: "onLeave",
    label: en.meWsToday.tabPeopleOnLeave,
    accentColor: "var(--danger)",
  },
  {
    key: "holidays",
    label: en.meWsToday.tabHolidayCalendar,
    accentColor: "var(--text-secondary)",
  },
  {
    key: "myLeaves",
    label: en.meWsToday.tabMyLeaves,
    accentColor: "var(--brand)",
  },
  {
    key: "regularizations",
    label: en.meWsRegularization.tabLabel,
    accentColor: "var(--amber)",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 0.2s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function leaveDays(start: string, end: string): number {
  return (
    Math.floor(
      (new Date(end + "T00:00:00Z").getTime() -
        new Date(start + "T00:00:00Z").getTime()) /
        86400000,
    ) + 1
  );
}

function LeaveRow({ request: leaveRequest, todayKey }: { request: LeaveRequestWithType; todayKey: string }) {
  const isPast = leaveRequest.end_date < todayKey;
  const isUpcoming = leaveRequest.start_date > todayKey;
  const isActive = !isPast && !isUpcoming;
  const totalDays = leaveDays(leaveRequest.start_date, leaveRequest.end_date);
  const [startYear, startMonth, startDay] = leaveRequest.start_date.split("-").map(Number);
  const [endYear, endMonth, endDay] = leaveRequest.end_date.split("-").map(Number);
  const formattedStart = new Date(startYear, startMonth - 1, startDay).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
  const formattedEnd = new Date(endYear, endMonth - 1, endDay).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dateLabel = leaveRequest.start_date === leaveRequest.end_date ? formattedEnd : `${formattedStart} – ${formattedEnd}`;

  return (
    <div
      style={{
        padding: "11px 16px",
        borderBottom: "1px solid var(--border)",
        background: isActive ? "rgba(0,212,170,0.04)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: isPast ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {leaveRequest.leave_type_name}
        </span>
        <span
          style={{
            fontSize: "11px",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            color: isPast ? "var(--text-muted)" : isActive ? "var(--teal)" : "var(--brand)",
            background: isPast
              ? "var(--surface-2)"
              : isActive
                ? "rgba(0,212,170,0.12)"
                : "rgba(27,77,255,0.1)",
            padding: "2px 8px",
            borderRadius: "20px",
            whiteSpace: "nowrap",
          }}
        >
          {en.meWsToday.leaveDaysLabel(totalDays)}
        </span>
      </div>
      <div
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          color: isPast ? "var(--text-muted)" : "var(--text-secondary)",
          marginTop: "2px",
        }}
      >
        {dateLabel}
      </div>
      {leaveRequest.reason && (
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {leaveRequest.reason}
        </div>
      )}
      {leaveRequest.status === "rejected" && leaveRequest.rejection_reason && (
        <div
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--danger)",
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {en.meWsToday.leaveRejectedPrefix} {leaveRequest.rejection_reason}
        </div>
      )}
      <div style={{ marginTop: "4px" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "11px",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            padding: "1px 7px",
            borderRadius: "20px",
            color:
              leaveRequest.status === "approved"
                ? "var(--teal)"
                : leaveRequest.status === "rejected"
                  ? "var(--danger)"
                  : "var(--amber)",
            background:
              leaveRequest.status === "approved"
                ? "rgba(0,212,170,0.12)"
                : leaveRequest.status === "rejected"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(245,158,11,0.12)",
          }}
        >
          {leaveRequest.status === "approved"
            ? en.meWsToday.leaveStatusApproved
            : leaveRequest.status === "rejected"
              ? en.meWsToday.leaveStatusRejected
              : en.meWsToday.leaveStatusPending}
        </span>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "6px 16px",
        fontFamily: "DM Sans, sans-serif",
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--text-muted)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {label}
    </div>
  );
}

function MyLeavesBody({
  leaves,
  loading,
  todayKey,
}: {
  leaves: LeaveRequestWithType[];
  loading: boolean;
  todayKey: string;
}) {
  if (loading) {
    return (
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: "52px",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-2)",
              animation: "vnz-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <p
        style={{
          padding: "16px",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "13px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        {en.meWsToday.myLeavesEmpty}
      </p>
    );
  }

  const active   = leaves.filter((r) => r.start_date <= todayKey && r.end_date >= todayKey);
  const upcoming = leaves.filter((r) => r.start_date > todayKey);
  const past     = leaves.filter((r) => r.end_date < todayKey);

  return (
    <div>
      {active.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesActive} />
          {active.map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesUpcoming} />
          {[...upcoming].reverse().map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
      {past.length > 0 && (
        <>
          <SectionLabel label={en.meWsToday.myLeavesPast} />
          {past.map((r) => (
            <LeaveRow key={r.id} request={r} todayKey={todayKey} />
          ))}
        </>
      )}
    </div>
  );
}

function RegularizationRow({ request }: { request: RegularizationRequest }) {
  const statusColor = request.status === "approved" ? "var(--brand)" : request.status === "rejected" ? "var(--danger)" : "var(--amber)";
  const statusLabel = request.status === "approved" ? en.meWsRegularization.statusApproved : request.status === "rejected" ? en.meWsRegularization.statusRejected : en.meWsRegularization.statusPending;
  return (
    <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
          {request.requested_type === "office" ? en.meWsRegularization.typeOffice : en.meWsRegularization.typeRemote} · {request.target_date}
        </span>
        <span style={{ fontSize: "11px", fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, padding: "1px 7px", borderRadius: "20px" }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", fontStyle: "italic" }}>
        {request.reason}
      </div>
      {request.status === "rejected" && request.rejection_reason && (
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "var(--danger)", marginTop: "2px" }}>
          {en.meWsToday.leaveRejectedPrefix} {request.rejection_reason}
        </div>
      )}
    </div>
  );
}

function MyRegularizationsBody({
  requests, loading, onNewRequest,
}: {
  requests: RegularizationRequest[];
  loading: boolean;
  onNewRequest: () => void;
}) {
  return (
    <div>
      <div style={{ padding: "12px 16px" }}>
        <button
          type="button"
          onClick={onNewRequest}
          style={{
            width: "100%", height: "40px", borderRadius: "var(--radius-md)", border: "1px solid var(--brand)",
            background: "var(--surface-0)", color: "var(--brand)", fontFamily: "DM Sans, sans-serif",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}
        >
          {en.meWsRegularization.newRequestButton}
        </button>
      </div>
      {loading ? (
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: "52px", borderRadius: "var(--radius-md)", background: "var(--surface-2)", animation: "vnz-pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p style={{ padding: "0 16px 16px", fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
          {en.meWsRegularization.myRequestsEmpty}
        </p>
      ) : (
        requests.map((r) => <RegularizationRow key={r.id} request={r} />)
      )}
    </div>
  );
}

export default function WorkspaceTodayPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [data, setData] = useState<WorkspaceTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);

  const [openTab, setOpenTab] = useState<AccordionTab | null>(null);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [modalPortalReady, setModalPortalReady] = useState(false);

  const [applyLeave, setApplyLeave] = useState({
    open: false,
    types: [] as LeaveTypeWithBalance[],
    typesLoading: false,
    selectedTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    submitting: false,
    error: null as string | null,
    success: false,
  });

  const [myLeavesState, setMyLeavesState] = useState<{ data: LeaveRequestWithType[]; loading: boolean }>({ data: [], loading: true });
  const [onLeaveTodayState, setOnLeaveTodayState] = useState<{ data: MemberOnLeaveToday[]; loading: boolean }>({ data: [], loading: true });
  const [myRegularizationsState, setMyRegularizationsState] = useState<{ data: RegularizationRequest[]; loading: boolean; minRequestDate: string | null }>({ data: [], loading: true, minRequestDate: null });
  const [regModalOpen, setRegModalOpen] = useState(false);

  function fetchMyRegularizations() {
    fetch(`/api/me/ws/${slug}/regularizations`)
      .then((r) => r.json())
      .then((d: { regularizationRequests: RegularizationRequest[]; minRequestDate: string | null }) =>
        setMyRegularizationsState({ data: d.regularizationRequests ?? [], loading: false, minRequestDate: d.minRequestDate ?? null }))
      .catch(() => setMyRegularizationsState((prev) => ({ ...prev, loading: false })));
  }

  useEffect(() => {
    setModalPortalReady(true);
  }, []);

  useEffect(() => {
    fetch(`/api/me/ws/${slug}/today`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(en.meWsToday.errorFailedToLoad);
        setLoading(false);
      });

    const year = new Date().getFullYear();
    fetch(`/api/me/ws/${slug}/holidays?year=${year}`)
      .then((r) => r.json())
      .then((d: { holidays: Holiday[] }) => { setHolidays(d.holidays); setHolidaysLoading(false); })
      .catch(() => setHolidaysLoading(false));

    fetch(`/api/me/ws/${slug}/leave-requests`)
      .then((r) => r.json())
      .then((d: { leaveRequests: LeaveRequestWithType[] }) => setMyLeavesState({ data: d.leaveRequests ?? [], loading: false }))
      .catch(() => setMyLeavesState((prev) => ({ ...prev, loading: false })));

    fetch(`/api/me/ws/${slug}/leave-requests/today`)
      .then((r) => r.json())
      .then((d: { members: MemberOnLeaveToday[] }) => setOnLeaveTodayState({ data: d.members ?? [], loading: false }))
      .catch(() => setOnLeaveTodayState((prev) => ({ ...prev, loading: false })));

    fetchMyRegularizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function toggleTab(tab: AccordionTab) {
    setOpenTab((prev) => (prev === tab ? null : tab));
  }

  async function openApplyLeave() {
    setApplyLeave({ open: true, types: [], typesLoading: true, selectedTypeId: "", startDate: "", endDate: "", reason: "", submitting: false, error: null, success: false });
    try {
      const res = await fetch(`/api/me/ws/${slug}/leave-types`);
      if (res.ok) {
        const d = (await res.json()) as { leaveTypes: LeaveTypeWithBalance[] };
        setApplyLeave((prev) => ({ ...prev, types: d.leaveTypes ?? [] }));
      }
    } finally {
      setApplyLeave((prev) => ({ ...prev, typesLoading: false }));
    }
  }

  async function submitLeave() {
    if (!applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate) return;
    setApplyLeave((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const res = await fetch(`/api/me/ws/${slug}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leave_type_id: applyLeave.selectedTypeId,
          start_date: applyLeave.startDate,
          end_date: applyLeave.endDate,
          reason: applyLeave.reason || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setApplyLeave((prev) => ({ ...prev, success: true }));
        fetch(`/api/me/ws/${slug}/leave-requests`)
          .then((r) => r.json())
          .then((d: { leaveRequests: LeaveRequestWithType[] }) => setMyLeavesState({ data: d.leaveRequests ?? [], loading: false }))
          .catch(() => undefined);
        setTimeout(() => {
          setApplyLeave((prev) => ({ ...prev, open: false, success: false, submitting: false }));
        }, 2000);
      } else {
        setApplyLeave((prev) => ({ ...prev, error: body.error ?? en.meWsToday.applyLeaveErrorGeneric, submitting: false }));
      }
    } catch {
      setApplyLeave((prev) => ({ ...prev, error: en.meWsToday.applyLeaveErrorGeneric, submitting: false }));
    }
  }

  async function confirmLeaveWorkspace() {
    if (!data?.workspace.id) return;
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const res = await fetch(`/api/me/workspaces/${data.workspace.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (res.ok) {
        setLeaveModalOpen(false);
        router.push("/me");
        router.refresh();
        return;
      }
      if (body.code === "SOLE_ADMIN") {
        setLeaveError(en.meWsToday.leaveWorkspaceSoleAdmin);
      } else {
        setLeaveError(body.error ?? en.meWsToday.leaveWorkspaceError);
      }
    } catch {
      setLeaveError(en.meWsToday.leaveWorkspaceError);
    } finally {
      setLeaveLoading(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  if (loading) {
    return (
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "52px",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-md)",
              marginBottom: "8px",
              animation: "vnz-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`@keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          padding: "48px 20px",
          textAlign: "center",
          fontFamily: "DM Sans, sans-serif",
          color: "var(--danger)",
        }}
      >
        {error ?? en.meWsToday.errorWorkspaceNotFound}
      </div>
    );
  }

  const inOffice = data.members.filter((m) => resolveMemberDisplayStatus(m) === "in_office");
  const remote   = data.members.filter((m) => resolveMemberDisplayStatus(m) === "remote");
  const checkedInIds = new Set([...inOffice, ...remote].map((m) => m.user_id));
  const onLeaveTodayFiltered = onLeaveTodayState.data.filter((m) => !checkedInIds.has(m.user_id));
  const onLeaveTodayIds = new Set(onLeaveTodayFiltered.map((m) => m.user_id));
  const notIn    = data.members.filter((m) => resolveMemberDisplayStatus(m) === "not_in" && !onLeaveTodayIds.has(m.user_id));

  const tabMembers: Record<AccordionTab, MemberTodaySummary[]> = {
    office:   inOffice,
    remote:   remote,
    leave:    notIn,
    onLeave:  [],
    holidays: [],
    myLeaves: [],
    regularizations: [],
  };

  const todayKey = todayStr();

  const holidayWarning = applyLeave.startDate && applyLeave.endDate
    ? holidays.filter((h) => h.date >= applyLeave.startDate && h.date <= applyLeave.endDate)
    : [];

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "20px 16px" }}>
      <p
        style={{
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        {today}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--navy)",
            margin: 0,
            flex: 1,
            minWidth: 0,
          }}
        >
          {data.workspace.name}
        </h1>
        <button
          type="button"
          aria-label={en.meWsToday.applyLeaveButtonAria}
          title={en.meWsToday.applyLeaveButtonAria}
          onClick={() => void openApplyLeave()}
          style={{
            flexShrink: 0,
            height: "44px",
            padding: "0 14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid var(--brand)",
            borderRadius: "var(--radius-md)",
            background: "var(--surface-0)",
            color: "var(--brand)",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="14" x2="8" y2="14" />
            <line x1="8" y1="18" x2="8" y2="18" />
          </svg>
          {en.meWsToday.applyLeaveButtonText}
        </button>
        {/* The owner can never leave - they must transfer ownership first.
            Admins and members may leave. */}
        {data.viewerRole !== "owner" && (
          <button
            type="button"
            aria-label={en.meWsToday.leaveWorkspaceButtonAria}
            title={en.meWsToday.leaveWorkspaceButtonAria}
            onClick={() => {
              setLeaveError(null);
              setLeaveModalOpen(true);
            }}
            style={{
              flexShrink: 0,
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-0)",
              color: "var(--danger)",
              cursor: "pointer",
            }}
          >
            <LogOut size={20} strokeWidth={2.25} aria-hidden />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {TABS.map((tab) => {
          const isOpen = openTab === tab.key;
          const count =
            tab.key === "holidays"
              ? holidays.length
              : tab.key === "myLeaves"
                ? myLeavesState.data.length
                : tab.key === "onLeave"
                  ? onLeaveTodayFiltered.length
                  : tab.key === "regularizations"
                    ? myRegularizationsState.data.length
                    : tabMembers[tab.key as Exclude<AccordionTab, "holidays" | "myLeaves" | "onLeave" | "regularizations">].length;

          return (
            <div
              key={tab.key}
              style={{
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {/* Accordion header */}
              <button
                onClick={() => toggleTab(tab.key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  gap: "10px",
                  borderBottom: isOpen ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: tab.accentColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      textAlign: "left",
                    }}
                  >
                    {tab.label}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "DM Sans, sans-serif",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: tab.accentColor,
                      background: `color-mix(in srgb, ${tab.accentColor} 12%, transparent)`,
                      padding: "2px 8px",
                      borderRadius: "20px",
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {count}
                  </span>
                  <ChevronIcon open={isOpen} />
                </div>
              </button>

              {/* Accordion body */}
              {isOpen && (
                <>
                  {tab.key === "holidays" ? (
                    holidaysLoading ? (
                      <div
                        style={{
                          padding: "12px 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              style={{
                                height: "14px",
                                width: `${100 + i * 30}px`,
                                borderRadius: "6px",
                                background: "var(--surface-2)",
                                animation:
                                  "vnz-pulse 1.5s ease-in-out infinite",
                              }}
                            />
                            <div
                              style={{
                                height: "12px",
                                width: "80px",
                                borderRadius: "6px",
                                background: "var(--surface-2)",
                                animation:
                                  "vnz-pulse 1.5s ease-in-out infinite",
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : holidays.length === 0 ? (
                      <p
                        style={{
                          padding: "16px",
                          fontFamily: "DM Sans, sans-serif",
                          fontSize: "13px",
                          color: "var(--text-muted)",
                          textAlign: "center",
                        }}
                      >
                        {en.meWsToday.emptyNoHolidaysConfigured(
                          new Date().getFullYear(),
                        )}
                      </p>
                    ) : (
                      holidays.map((h, idx) => {
                        const isPast = h.date < todayKey;
                        const isToday = h.date === todayKey;
                        const { display, dayName } = formatDate(h.date);
                        return (
                          <div
                            key={h.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "11px 16px",
                              borderTop:
                                idx === 0 ? "none" : "1px solid var(--border)",
                              background: isToday
                                ? "rgba(0, 212, 170, 0.06)"
                                : "transparent",
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span
                                style={{
                                  fontFamily: "DM Sans, sans-serif",
                                  fontSize: "13px",
                                  fontWeight: isToday ? 600 : 500,
                                  color: isPast
                                    ? "var(--text-muted)"
                                    : isToday
                                      ? "var(--teal)"
                                      : "var(--text-primary)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "block",
                                }}
                              >
                                {h.name}
                                {isToday && (
                                  <span
                                    style={{
                                      marginLeft: "6px",
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      color: "var(--teal)",
                                      background: "rgba(0,212,170,0.12)",
                                      padding: "1px 6px",
                                      borderRadius: "99px",
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {en.meWsToday.badgeToday}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div
                              style={{
                                marginLeft: "12px",
                                textAlign: "right",
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "DM Sans, sans-serif",
                                  fontSize: "12px",
                                  color: isPast
                                    ? "var(--text-muted)"
                                    : isToday
                                      ? "var(--teal)"
                                      : "var(--brand)",
                                }}
                              >
                                {display}
                              </span>
                              <span
                                style={{
                                  marginLeft: "5px",
                                  fontFamily: "DM Sans, sans-serif",
                                  fontSize: "11px",
                                  color: isPast
                                    ? "var(--border)"
                                    : isToday
                                      ? "rgba(0,212,170,0.7)"
                                      : "var(--brand)",
                                }}
                              >
                                {dayName}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : tab.key === "onLeave" ? (
                    onLeaveTodayState.loading ? (
                      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {[1, 2].map((i) => (
                          <div key={i} style={{ height: "52px", borderRadius: "var(--radius-md)", background: "var(--surface-2)", animation: "vnz-pulse 1.5s ease-in-out infinite" }} />
                        ))}
                      </div>
                    ) : onLeaveTodayFiltered.length === 0 ? (
                      <p style={{ padding: "16px", fontFamily: "DM Sans, sans-serif", fontSize: "13px", color: "var(--text-muted)", textAlign: "center" }}>
                        {en.meWsToday.onLeaveEmpty}
                      </p>
                    ) : (
                      <div>
                        {onLeaveTodayFiltered.map((m) => (
                          <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                            <Avatar name={m.full_name} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                                {m.full_name ?? m.email}
                              </p>
                              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                                {m.leave_type_name}
                              </p>
                            </div>
                            <span style={{ fontSize: "11px", fontFamily: "DM Sans, sans-serif", fontWeight: 600, color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 12%, transparent)", padding: "2px 8px", borderRadius: "20px", border: "1px solid var(--danger)", whiteSpace: "nowrap" }}>
                              {en.meWsToday.onLeaveBadgeLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  ) : tab.key === "myLeaves" ? (
                    <MyLeavesBody leaves={myLeavesState.data} loading={myLeavesState.loading} todayKey={todayKey} />
                  ) : tab.key === "regularizations" ? (
                    <MyRegularizationsBody
                      requests={myRegularizationsState.data}
                      loading={myRegularizationsState.loading}
                      onNewRequest={() => setRegModalOpen(true)}
                    />
                  ) : tabMembers[tab.key as Exclude<AccordionTab, "holidays" | "myLeaves" | "onLeave" | "regularizations">].length === 0 ? (
                    <p
                      style={{
                        padding: "16px",
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      {en.meWsToday.emptyNoOneHereYet}
                    </p>
                  ) : (
                    <div>
                      {tabMembers[tab.key as Exclude<AccordionTab, "holidays" | "myLeaves" | "onLeave" | "regularizations">].map((m) => (
                        <MemberRow key={m.user_id} m={m} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {modalPortalReady &&
        leaveModalOpen &&
        createPortal(
          <div
            role="presentation"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              minHeight: "100dvh",
              zIndex: 1100,
              background: "rgba(13, 27, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              boxSizing: "border-box",
              overflow: "auto",
            }}
            onClick={() => {
              if (!leaveLoading) setLeaveModalOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-ws-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "400px",
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                margin: "auto",
              }}
            >
              <h2
                id="leave-ws-title"
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--navy)",
                  margin: "0 0 12px",
                }}
              >
                {en.meWsToday.leaveWorkspaceTitle}
              </h2>
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  margin: "0 0 16px",
                  lineHeight: 1.5,
                }}
              >
                {en.meWsToday.leaveWorkspaceMessage(data.workspace.name)}
              </p>
              {leaveError && (
                <p
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    color: "var(--danger)",
                    margin: "0 0 12px",
                  }}
                >
                  {leaveError}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={() => setLeaveModalOpen(false)}
                  style={{
                    height: "44px",
                    padding: "0 16px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "transparent",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    cursor: leaveLoading ? "default" : "pointer",
                  }}
                >
                  {en.meWsToday.leaveWorkspaceCancel}
                </button>
                <button
                  type="button"
                  disabled={leaveLoading}
                  onClick={() => void confirmLeaveWorkspace()}
                  style={{
                    height: "44px",
                    padding: "0 16px",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    background: "var(--danger)",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#fff",
                    cursor: leaveLoading ? "default" : "pointer",
                    opacity: leaveLoading ? 0.75 : 1,
                  }}
                >
                  {leaveLoading
                    ? en.meWsToday.leaveWorkspaceLoading
                    : en.meWsToday.leaveWorkspaceConfirm}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {modalPortalReady &&
        applyLeave.open &&
        createPortal(
          <div
            role="presentation"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              minHeight: "100dvh",
              zIndex: 1100,
              background: "rgba(13, 27, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              boxSizing: "border-box",
              overflow: "auto",
            }}
            onClick={() => {
              if (!applyLeave.submitting) setApplyLeave((prev) => ({ ...prev, open: false }));
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="apply-leave-title"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "420px",
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "20px",
                margin: "auto",
              }}
            >
              <h2
                id="apply-leave-title"
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--navy)",
                  margin: "0 0 20px",
                }}
              >
                {en.meWsToday.applyLeaveTitle}
              </h2>

              {applyLeave.success ? (
                <p
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    color: "var(--teal)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  {en.meWsToday.applyLeaveSuccess}
                </p>
              ) : applyLeave.typesLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: "44px",
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-md)",
                        animation: "vnz-pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              ) : applyLeave.types.length === 0 ? (
                <p
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "14px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  {en.meWsToday.applyLeaveNoTypes}
                </p>
              ) : (
                <>
                  <div style={{ marginBottom: "14px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontFamily: "DM Sans, sans-serif",
                        color: "var(--text-secondary)",
                        marginBottom: "5px",
                      }}
                    >
                      {en.meWsToday.applyLeaveFieldLeaveType}
                    </label>
                    <select
                      value={applyLeave.selectedTypeId}
                      onChange={(e) => setApplyLeave((prev) => ({ ...prev, selectedTypeId: e.target.value }))}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        fontFamily: "DM Sans, sans-serif",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        outline: "none",
                        boxSizing: "border-box",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">{en.meWsToday.applyLeaveSelectPlaceholder}</option>
                      {applyLeave.types.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.available_days === 0}>
                          {en.meWsToday.applyLeaveTypeOption(t.name, t.available_days)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontFamily: "DM Sans, sans-serif",
                        color: "var(--text-secondary)",
                        marginBottom: "5px",
                      }}
                    >
                      {en.meWsToday.applyLeaveFieldStartDate}
                    </label>
                    <input
                      type="date"
                      value={applyLeave.startDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setApplyLeave((prev) => ({
                          ...prev,
                          startDate: val,
                          endDate: prev.endDate && val > prev.endDate ? val : prev.endDate,
                        }));
                      }}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        fontFamily: "DM Sans, sans-serif",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontFamily: "DM Sans, sans-serif",
                        color: "var(--text-secondary)",
                        marginBottom: "5px",
                      }}
                    >
                      {en.meWsToday.applyLeaveFieldEndDate}
                    </label>
                    <input
                      type="date"
                      value={applyLeave.endDate}
                      min={applyLeave.startDate || undefined}
                      onChange={(e) => setApplyLeave((prev) => ({ ...prev, endDate: e.target.value }))}
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "0 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        fontFamily: "DM Sans, sans-serif",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {holidayWarning.length > 0 && (
                    <div
                      style={{
                        marginBottom: "14px",
                        padding: "10px 12px",
                        border: "1px solid var(--amber)",
                        borderRadius: "var(--radius-md)",
                        background: "color-mix(in srgb, var(--amber) 10%, transparent)",
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "13px",
                        color: "var(--amber)",
                        lineHeight: 1.5,
                      }}
                    >
                      {en.meWsToday.applyLeaveHolidayWarning(holidayWarning.map((h) => h.name).join(", "))}
                    </div>
                  )}

                  <div style={{ marginBottom: "20px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "12px",
                        fontFamily: "DM Sans, sans-serif",
                        color: "var(--text-secondary)",
                        marginBottom: "5px",
                      }}
                    >
                      {en.meWsToday.applyLeaveFieldReason}
                    </label>
                    <textarea
                      value={applyLeave.reason}
                      onChange={(e) => setApplyLeave((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder={en.meWsToday.applyLeaveFieldReasonPlaceholder}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        fontFamily: "DM Sans, sans-serif",
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {applyLeave.error && (
                    <p
                      style={{
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "13px",
                        color: "var(--danger)",
                        margin: "0 0 12px",
                      }}
                    >
                      {applyLeave.error}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      disabled={applyLeave.submitting}
                      onClick={() => setApplyLeave((prev) => ({ ...prev, open: false }))}
                      style={{
                        height: "44px",
                        padding: "0 16px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        background: "transparent",
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        cursor: applyLeave.submitting ? "default" : "pointer",
                      }}
                    >
                      {en.meWsToday.applyLeaveCancel}
                    </button>
                    <button
                      type="button"
                      disabled={applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0}
                      onClick={() => void submitLeave()}
                      style={{
                        height: "44px",
                        padding: "0 16px",
                        border: "none",
                        borderRadius: "var(--radius-md)",
                        background: "var(--brand)",
                        fontFamily: "DM Sans, sans-serif",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#fff",
                        cursor: applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0
                          ? "not-allowed"
                          : "pointer",
                        opacity: applyLeave.submitting || !applyLeave.selectedTypeId || !applyLeave.startDate || !applyLeave.endDate || holidayWarning.length > 0
                          ? 0.65
                          : 1,
                      }}
                    >
                      {applyLeave.submitting ? en.meWsToday.applyLeaveSubmitting : en.meWsToday.applyLeaveSubmit}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {regModalOpen && (
        <RegularizationRequestModal
          slug={slug}
          minDate={myRegularizationsState.minRequestDate ?? (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })()}
          maxDate={todayStr()}
          onClose={() => setRegModalOpen(false)}
          onSuccess={fetchMyRegularizations}
        />
      )}

      <style>{`@keyframes vnz-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
