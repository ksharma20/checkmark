"use client";

import { useEffect, useState } from "react";

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
}

type CalendarState =
  | { state: "loading" }
  | { state: "empty" }
  | { state: "ready"; holidays: Holiday[] }
  | { state: "error" };

function formatDate(dateStr: string): { display: string; dayName: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const display = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const dayName = date.toLocaleDateString("en-IN", { weekday: "short" });
  return { display, dayName };
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function HolidayCalendar({ slugs }: { slugs: string[] }) {
  const [calendarBySlug, setCalendarBySlug] = useState<
    Record<string, CalendarState>
  >({});

  useEffect(() => {
    if (slugs.length === 0) return;
    const year = new Date().getFullYear();

    slugs.forEach((slug) => {
      setCalendarBySlug((prev) => ({ ...prev, [slug]: { state: "loading" } }));
      fetch(`/api/me/ws/${slug}/holidays?year=${year}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { holidays: Holiday[] };
          setCalendarBySlug((prev) => ({
            ...prev,
            [slug]: data.holidays.length === 0
              ? { state: "empty" }
              : { state: "ready", holidays: data.holidays },
          }));
        })
        .catch(() => {
          setCalendarBySlug((prev) => ({ ...prev, [slug]: { state: "error" } }));
        });
    });
  }, [slugs]);

  if (slugs.length === 0) return null;

  const today = todayStr();

  return (
    <>
      {slugs.map((slug) => {
        const cal = calendarBySlug[slug] ?? { state: "loading" as const };

        return (
          <section key={slug} style={{ marginTop: "24px" }}>
            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "10px",
              }}
            >
              Holiday Calendar {new Date().getFullYear()}
            </h2>

            <div
              style={{
                background: "var(--surface-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
              }}
            >
              {cal.state === "loading" && (
                <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div
                        style={{
                          height: "14px",
                          width: `${120 + i * 20}px`,
                          borderRadius: "6px",
                          background: "var(--surface-2)",
                          animation: "cm-pulse 1.5s ease-in-out infinite",
                        }}
                      />
                      <div
                        style={{
                          height: "12px",
                          width: "80px",
                          borderRadius: "6px",
                          background: "var(--surface-2)",
                          animation: "cm-pulse 1.5s ease-in-out infinite",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {cal.state === "empty" && (
                <div
                  style={{
                    padding: "16px 14px",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  No holidays configured for {new Date().getFullYear()}
                </div>
              )}

              {cal.state === "error" && (
                <div
                  style={{
                    padding: "16px 14px",
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    textAlign: "center",
                  }}
                >
                  Could not load holidays
                </div>
              )}

              {cal.state === "ready" &&
                cal.holidays.map((h, idx) => {
                  const isPast = h.date < today;
                  const isToday = h.date === today;
                  const { display, dayName } = formatDate(h.date);

                  return (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "11px 14px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        background: isToday ? "rgba(0, 212, 170, 0.06)" : "transparent",
                      }}
                    >
                      {/* Left: name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
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
                              Today
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: date */}
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
                            color: isPast ? "var(--border)" : isToday ? "rgba(0,212,170,0.7)" : "var(--brand)",
                            opacity: isPast ? 0.8 : 1,
                          }}
                        >
                          {dayName}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        );
      })}

      <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </>
  );
}
