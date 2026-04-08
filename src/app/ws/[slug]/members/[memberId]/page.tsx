"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { fmtTime, durationLabel } from "@/lib/client/format-time";
import type { MatchedBy } from "@/lib/signals";

const SIGNAL_BADGE: Record<MatchedBy, { label: string; color: string }> = {
  wifi: { label: "WiFi", color: "var(--teal)" },
  gps: { label: "GPS", color: "var(--brand)" },
  ip: { label: "IP", color: "var(--amber)" },
  override: { label: "Override", color: "#8B5CF6" },
  none: { label: "—", color: "var(--text-muted)" },
};

const TRUST_LABELS: Record<string, string> = {
  mock_gps_suspected: "Mock GPS — accuracy ≤1m (likely fake GPS app)",
  timezone_mismatch:
    "Timezone mismatch — browser timezone differs from IP location",
  vpn_suspected: "VPN/proxy — IP flagged as hosting or proxy provider",
  impossible_travel:
    "Impossible travel — >500km from previous check-in in <2 hours",
};

interface MemberInfo {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  added_at: string;
  current_streak: number;
  total_checkins: number;
}

interface EventWithMatch {
  id: string;
  checkin_at: string;
  checkout_at: string | null;
  matched_by: MatchedBy;
  trust_flags: string | null;
  checkout_location_mismatch: number | null;
  wifi_ssid: string | null;
  ip_address: string;
  gps_lat: number | null;
  gps_lng: number | null;
  location_label: string | null;
  note: string | null;
}

interface TimelineResponse {
  member: MemberInfo;
  events: EventWithMatch[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

function TrustPopover({ flags }: { flags: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "color-mix(in srgb,var(--amber) 15%,transparent)",
          border: "1px solid var(--amber)",
          borderRadius: "4px",
          padding: "2px 6px",
          fontSize: "11px",
          color: "var(--amber)",
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
          fontWeight: 600,
        }}
      >
        ⚠ Suspicious
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 100,
            marginTop: "4px",
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            minWidth: "260px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--amber)",
              marginBottom: "6px",
            }}
          >
            ⚠ Suspicious signals
          </p>
          {flags.map((f) => (
            <p
              key={f}
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-secondary)",
                marginBottom: "4px",
                lineHeight: 1.4,
              }}
            >
              • {TRUST_LABELS[f] ?? f}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}

function EventRow({ ev }: { ev: EventWithMatch }) {
  const flags = (() => {
    try {
      return ev.trust_flags ? (JSON.parse(ev.trust_flags) as string[]) : null;
    } catch {
      return null;
    }
  })();
  const badge = SIGNAL_BADGE[ev.matched_by];
  const dur = durationLabel(ev.checkin_at, ev.checkout_at);
  return (
    <div
      style={{
        background: "var(--surface-0)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "13px",
            color: "var(--text-primary)",
          }}
        >
          {fmtTime(ev.checkin_at)}
          {ev.checkout_at ? ` — ${fmtTime(ev.checkout_at)}` : ""}
        </span>
        {dur && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {dur}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "11px",
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 600,
            color: badge.color,
            background: `color-mix(in srgb,${badge.color} 12%,transparent)`,
            padding: "2px 7px",
            borderRadius: "4px",
            border: `1px solid ${badge.color}`,
          }}
        >
          {badge.label}
        </span>
        {flags && flags.length > 0 && <TrustPopover flags={flags} />}
        {ev.checkout_location_mismatch != null && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--amber)",
              background: "color-mix(in srgb,var(--amber) 12%,transparent)",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "1px solid var(--amber)",
            }}
          >
            ⚠ {ev.checkout_location_mismatch}m away at checkout
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {ev.wifi_ssid && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--text-muted)",
            }}
          >
            ⌬ {ev.wifi_ssid}
          </span>
        )}
        {ev.gps_lat != null && ev.gps_lng != null && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${ev.gps_lat}&mlon=${ev.gps_lng}&zoom=16`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "11px",
              color: "var(--brand)",
              textDecoration: "none",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            ◉{" "}
            {ev.location_label ??
              `${ev.gps_lat.toFixed(4)}, ${ev.gps_lng.toFixed(4)}`}
          </a>
        )}
        {ev.ip_address && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--text-muted)",
            }}
          >
            {ev.ip_address}
          </span>
        )}
      </div>
      {ev.note && (
        <p
          style={{
            marginTop: "6px",
            fontSize: "12px",
            fontFamily: "DM Sans, sans-serif",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {ev.note}
        </p>
      )}
    </div>
  );
}

function formatDayHeading(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDay(events: EventWithMatch[]): { date: string; label: string; items: EventWithMatch[] }[] {
  const map = new Map<string, EventWithMatch[]>();
  for (const ev of events) {
    const day = ev.checkin_at.slice(0, 10); // YYYY-MM-DD
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(ev);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, label: formatDayHeading(date + 'T00:00:00'), items }));
}

export default function MemberDetailPage() {
  const { slug, memberId } = useParams<{ slug: string; memberId: string }>();
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(
    (p: number) => {
      setLoading(true);
      fetch(`/api/ws/${slug}/members/${memberId}/timeline?page=${p}`)
        .then((r) => r.json())
        .then((d: TimelineResponse) => {
          setData(d);
          setPage(p);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [slug, memberId],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  if (!data && loading)
    return (
      <div
        style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: "72px",
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

  if (!data) return null;
  const { member, events, pagination } = data;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header card */}
      <div
        style={{
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {(member.full_name ?? member.email)[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--navy)",
                marginBottom: "2px",
              }}
            >
              {member.full_name ?? "—"}
            </p>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {member.email}
            </p>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              color: "var(--brand)",
              background: "color-mix(in srgb,var(--brand) 10%,transparent)",
              padding: "3px 8px",
              borderRadius: "20px",
              border: "1px solid var(--brand)",
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          >
            {member.role}
          </span>
        </div>
        <div style={{ display: "flex", gap: "24px" }}>
          <div>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
              }}
            >
              Streak
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {member.current_streak}d
            </p>
          </div>
          <div>
            <p
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
              }}
            >
              Total check-ins
            </p>
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--navy)",
              }}
            >
              {member.total_checkins}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--navy)",
          }}
        >
          Timeline
        </h2>
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {pagination.total} events
        </span>
      </div>

      {loading && (
        <div
          style={{
            height: "4px",
            background: "var(--brand)",
            borderRadius: "2px",
            marginBottom: "12px",
            animation: "cm-pulse 1s ease-in-out infinite",
          }}
        />
      )}

      {events.length === 0 && !loading && (
        <p
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            fontFamily: "DM Sans, sans-serif",
            padding: "40px 0",
          }}
        >
          No events found.
        </p>
      )}

      {groupByDay(events).map(({ date, label, items }) => (
        <div key={date} style={{ marginBottom: '8px' }}>
          {/* Day heading */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
              marginTop: '20px',
            }}
          >
            <div
              style={{
                width: '3px',
                height: '16px',
                borderRadius: '2px',
                background: 'var(--brand)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'rgba(27,77,255,0.3)',
              }}
            />
            <span
              style={{
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '11px',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {items.length} {items.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          {items.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </div>
      ))}

      {pagination.pages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            marginTop: "16px",
          }}
        >
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            style={{
              padding: "6px 16px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              cursor: page <= 1 ? "not-allowed" : "pointer",
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            ← Prev
          </button>
          <span
            style={{
              padding: "6px 12px",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            {page} / {pagination.pages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= pagination.pages}
            style={{
              padding: "6px 16px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              cursor: page >= pagination.pages ? "not-allowed" : "pointer",
              opacity: page >= pagination.pages ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
