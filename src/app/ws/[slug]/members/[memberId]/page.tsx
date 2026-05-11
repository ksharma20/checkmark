"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { en } from "@/locales/en";
import { useParams } from "next/navigation";
import { fmtTime, durationLabel } from "@/lib/client/format-time";
import type { MatchedBy } from "@/lib/signals";
// MatchedBy is kept for the EventWithMatch type below

const SIGNAL_BADGE: Record<MatchedBy, { label: string; color: string }> = {
  verified: { label: "Verified", color: "var(--teal)" },
  partial:  { label: "Partial",  color: "var(--amber)" },
  override: { label: "Override", color: "#8B5CF6" },
  none:     { label: "—",        color: "var(--text-muted)" },
};

const TRUST_LABELS: Record<string, string> = {
  mock_gps_suspected: "Mock GPS - accuracy ≤1m (likely fake GPS app)",
  timezone_mismatch:
    "Timezone mismatch - browser timezone differs from IP location",
  vpn_suspected: "VPN/proxy - IP flagged as hosting or proxy provider",
  impossible_travel:
    "Impossible travel - >500km from previous check-in in <2 hours",
  checkout_outside_radius:
    "Checkout outside office - location was beyond the configured office radius",
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
  matched_signals: string[];
  trust_flags: string | null;
  checkout_location_mismatch: number | null;
  wifi_ssid: string | null;
  ip_address: string;
  gps_lat: number | null;
  gps_lng: number | null;
  checkout_gps_lat: number | null;
  checkout_gps_lng: number | null;
  checkout_location_label: string | null;
  checkout_ip_address: string | null;
  location_label: string | null;
  note: string | null;
}

interface TimelineResponse {
  member: MemberInfo;
  events: EventWithMatch[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    nextOffset: number | null;
  };
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

function SignalBadge({ matchedBy, matchedSignals }: { matchedBy: MatchedBy; matchedSignals: string[] }) {
  const badge = SIGNAL_BADGE[matchedBy]
  const signalLabels: Record<string, string> = { gps: 'GPS', ip: 'IP' }
  const signals = matchedSignals.map((s) => signalLabels[s] ?? s).join(' + ')
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        fontSize: '11px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        color: badge.color,
        background: `color-mix(in srgb,${badge.color} 12%,transparent)`,
        border: `1px solid color-mix(in srgb,${badge.color} 40%,transparent)`,
        borderRadius: '4px',
        padding: '2px 6px',
      }}>
        {badge.label}{signals ? ` (${signals})` : ''}
      </span>
    </span>
  )
}

function EventRow({ ev }: { ev: EventWithMatch }) {
  const flags = (() => {
    try {
      return ev.trust_flags ? (JSON.parse(ev.trust_flags) as string[]) : null;
    } catch {
      return null;
    }
  })();
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
          {ev.checkout_at ? ` - ${fmtTime(ev.checkout_at)}` : ""}
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
        <span style={{ marginLeft: "auto" }}>
          <SignalBadge
            matchedBy={ev.matched_by}
            matchedSignals={ev.matched_signals}
          />
        </span>
        {flags && flags.length > 0 && <TrustPopover flags={flags} />}
        {(ev.matched_by === "verified" || ev.matched_by === "override") &&
          ev.checkout_location_mismatch != null && (
            <span
              style={{
                fontSize: "11px",
                fontFamily: "DM Sans, sans-serif",
                color: flags?.includes("checkout_outside_radius")
                  ? "var(--danger)"
                  : "var(--text-muted)",
                background: flags?.includes("checkout_outside_radius")
                  ? "color-mix(in srgb,var(--danger) 10%,transparent)"
                  : "var(--surface-1)",
                padding: "2px 7px",
                borderRadius: "4px",
                border: flags?.includes("checkout_outside_radius")
                  ? "1px solid var(--danger)"
                  : "1px solid var(--border)",
                fontWeight: flags?.includes("checkout_outside_radius")
                  ? 600
                  : 400,
              }}
            >
              {flags?.includes("checkout_outside_radius")
                ? "⚠ Outside office"
                : "✓ Near office"}{" "}
              ({ev.checkout_location_mismatch}m away)
            </span>
          )}
        {(ev.matched_by === "partial" || ev.matched_by === "none") && (
          <span
            style={{
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              color: "var(--text-muted)",
              background: "var(--surface-1)",
              padding: "2px 7px",
              borderRadius: "4px",
              border: "1px solid var(--border)",
            }}
          >
            🌐 Remote
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Check-in
          </span>
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
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span style={{ color: "var(--teal)" }}>◉</span>{" "}
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

        {ev.checkout_at && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Checkout
            </span>
            {ev.checkout_gps_lat != null && ev.checkout_gps_lng != null ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${ev.checkout_gps_lat}&mlon=${ev.checkout_gps_lng}&zoom=16`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "11px",
                  color: "var(--brand)",
                  textDecoration: "none",
                  fontFamily: "DM Sans, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    color: flags?.includes("checkout_outside_radius")
                      ? "var(--danger)"
                      : "var(--teal)",
                  }}
                >
                  ◉
                </span>{" "}
                {ev.checkout_location_label ??
                  ev.location_label ??
                  `${ev.checkout_gps_lat.toFixed(4)}, ${ev.checkout_gps_lng.toFixed(4)}`}
              </a>
            ) : (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Location not captured
              </span>
            )}
            {ev.checkout_ip_address && (
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: "var(--text-muted)",
                }}
              >
                {ev.checkout_ip_address}
              </span>
            )}
          </div>
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
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [events, setEvents] = useState<EventWithMatch[]>([]);
  const [pagination, setPagination] = useState<{
    total: number;
    nextOffset: number | null;
  } | null>(null);
  const nextOffsetRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        if (!append) nextOffsetRef.current = null;
        const offset = append ? (nextOffsetRef.current ?? 0) : 0;
        const res = await fetch(
          `/api/ws/${slug}/members/${memberId}/timeline?offset=${offset}`,
        );
        if (!res.ok) {
          setMember(null);
          setEvents([]);
          setPagination(null);
          return;
        }
        const d = (await res.json()) as TimelineResponse;
        const next = d.pagination?.nextOffset ?? null;
        nextOffsetRef.current = next;
        if (!append) setMember(d.member);
        setEvents((prev) => (append ? [...prev, ...d.events] : d.events));
        setPagination({
          total: d.pagination.total,
          nextOffset: next,
        });
      } catch {
        if (!append) {
          setMember(null);
          setEvents([]);
          setPagination(null);
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [slug, memberId],
  );

  useEffect(() => {
    nextOffsetRef.current = null;
    setMember(null);
    setEvents([]);
    setPagination(null);
    load();
  }, [load]);

  if (!member && loading)
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

  if (!member) return null;

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
          {pagination?.total ?? 0} events
        </span>
      </div>

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
        <div key={date} style={{ marginBottom: "8px" }}>
          {/* Day heading */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                width: "3px",
                height: "16px",
                borderRadius: "2px",
                background: "var(--brand)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "rgba(27,77,255,0.3)",
              }}
            />
            <span
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "11px",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {items.length} {items.length === 1 ? "event" : "events"}
            </span>
          </div>
          {items.map((ev) => (
            <EventRow key={ev.id} ev={ev} />
          ))}
        </div>
      ))}

      {loadingMore && (
        <div style={{ marginTop: "8px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={`tl-sk-${i}`}
              style={{
                height: "72px",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                marginBottom: "8px",
                animation: "cm-pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {(pagination?.nextOffset ?? null) !== null && (
        <div style={{ marginTop: "16px" }}>
          <button
            type="button"
            onClick={() => load({ append: true })}
            disabled={loadingMore}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: loadingMore ? "default" : "pointer",
            }}
          >
            {loadingMore
              ? en.wsMemberTimeline.loadingMore
              : en.wsMemberTimeline.viewMore}
          </button>
        </div>
      )}
    </div>
  );
}
