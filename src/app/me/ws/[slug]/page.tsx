"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { resolvePresenceTag, PRESENCE_TAG_CONFIG } from "@/lib/client/presence";
import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";
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

type AccordionTab = "office" | "remote" | "leave" | "holidays";

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
    key: "holidays",
    label: en.meWsToday.tabHolidayCalendar,
    accentColor: "var(--text-secondary)",
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
  }, [slug]);

  function toggleTab(tab: AccordionTab) {
    setOpenTab((prev) => (prev === tab ? null : tab));
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
              animation: "cm-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
        <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
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
  const notIn    = data.members.filter((m) => resolveMemberDisplayStatus(m) === "not_in");

  const tabMembers: Record<AccordionTab, MemberTodaySummary[]> = {
    office:   inOffice,
    remote:   remote,
    leave:    notIn,
    holidays: [],
  };

  const todayKey = todayStr();

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
          gap: "12px",
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
        {data.viewerRole !== "admin" && (
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
              : tabMembers[tab.key].length;

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
                                  "cm-pulse 1.5s ease-in-out infinite",
                              }}
                            />
                            <div
                              style={{
                                height: "12px",
                                width: "80px",
                                borderRadius: "6px",
                                background: "var(--surface-2)",
                                animation:
                                  "cm-pulse 1.5s ease-in-out infinite",
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
                  ) : tabMembers[tab.key].length === 0 ? (
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
                      {tabMembers[tab.key].map((m) => (
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

      <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}
