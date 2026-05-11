"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Holiday {
  id: string;
  name: string;
  date: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarView({ slugs }: { slugs: string[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [holidayMap, setHolidayMap] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchHolidays = useCallback(
    async (y: number) => {
      if (slugs.length === 0) { setLoading(false); return; }
      setLoading(true);
      const results = await Promise.allSettled(
        slugs.map((slug) =>
          fetch(`/api/me/ws/${slug}/holidays?year=${y}`).then((r) => r.json() as Promise<{ holidays: Holiday[] }>)
        ),
      );
      const map = new Map<string, string[]>();
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        (r.value.holidays ?? []).forEach((h) => {
          const existing = map.get(h.date) ?? [];
          if (!existing.includes(h.name)) existing.push(h.name);
          map.set(h.date, existing);
        });
      });
      setHolidayMap(map);
      setLoading(false);
    },
    [slugs],
  );

  useEffect(() => { fetchHolidays(year); }, [year, fetchHolidays]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const today = todayStr();
  const cells = buildCalendarDays(year, month);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 52px - 72px)",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 12px",
          gap: "8px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-0)",
        }}
      >
        <Link
          href="/me"
          aria-label="Back"
          style={{
            color: "var(--brand)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <button
          onClick={prevMonth}
          style={{
            width: "30px", height: "30px", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", background: "var(--surface-1)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--navy)",
            flex: 1,
            textAlign: "center",
          }}
        >
          {MONTHS[month]} {year}
        </div>

        <button
          onClick={nextMonth}
          style={{
            width: "30px", height: "30px", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", background: "var(--surface-1)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button
          onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
          style={{
            height: "30px",
            padding: "0 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-1)",
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-secondary)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Today
        </button>
      </div>

      {/* Calendar grid — fills remaining height */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--surface-0)",
        }}
      >
        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {DAYS.map((d, i) => (
            <div
              key={d}
              style={{
                padding: "8px 4px",
                textAlign: "center",
                fontFamily: "DM Sans, sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: i === 0 || i === 6 ? "var(--amber)" : "var(--text-secondary)",
                borderRight: i < 6 ? "1px solid var(--border)" : "none",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Rows — each row takes equal share of remaining height */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                borderBottom: rowIdx < rows.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              {row.map((day, colIdx) => {
                const isWeekend = colIdx === 0 || colIdx === 6;
                const key = day ? dateKey(year, month, day) : null;
                const isToday = key === today;
                const isPast = key ? key < today : false;
                const holidays = key ? (holidayMap.get(key) ?? []) : [];

                return (
                  <div
                    key={colIdx}
                    style={{
                      padding: "6px 5px 4px",
                      background: isWeekend && day ? "rgba(245,158,11,0.05)" : "transparent",
                      borderRight: colIdx < 6 ? "1px solid var(--border)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    {day && (
                      <>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
                          <span
                            style={{
                              width: "26px",
                              height: "26px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "50%",
                              fontFamily: "DM Sans, sans-serif",
                              fontSize: "12px",
                              fontWeight: isToday ? 700 : 400,
                              color: isToday
                                ? "#fff"
                                : isPast
                                ? "var(--text-muted)"
                                : isWeekend
                                ? "var(--amber)"
                                : "var(--text-primary)",
                              background: isToday ? "var(--teal)" : "transparent",
                              flexShrink: 0,
                            }}
                          >
                            {day}
                          </span>
                        </div>

                        {!loading && holidays.map((name, hi) => (
                          <div
                            key={hi}
                            title={name}
                            style={{
                              fontSize: "10px",
                              fontFamily: "DM Sans, sans-serif",
                              fontWeight: 600,
                              color: isPast
                                ? "var(--text-muted)"
                                : isToday
                                ? "var(--teal)"
                                : "var(--brand)",
                              background: isPast
                                ? "var(--surface-2)"
                                : isToday
                                ? "rgba(0,212,170,0.12)"
                                : "rgba(27,77,255,0.08)",
                              border: `1px solid ${isPast ? "var(--border)" : isToday ? "rgba(0,212,170,0.3)" : "rgba(27,77,255,0.2)"}`,
                              borderRadius: "4px",
                              padding: "2px 4px",
                              marginBottom: "2px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              lineHeight: 1.3,
                            }}
                          >
                            {name}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "8px 12px",
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          background: "var(--surface-0)",
          flexWrap: "wrap",
        }}
      >
        {[
          { bg: "rgba(27,77,255,0.08)", border: "rgba(27,77,255,0.2)", label: "Upcoming holiday" },
          { bg: "var(--surface-2)", border: "var(--border)", label: "Past holiday" },
          { bg: "var(--teal)", border: "transparent", label: "Today" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "28px",
                height: "14px",
                borderRadius: "4px",
                background: item.bg,
                border: `1px solid ${item.border}`,
              }}
            />
            <span
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
