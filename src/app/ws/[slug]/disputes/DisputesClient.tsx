'use client'

import { useState, useEffect, useCallback, useRef } from "react";
import type { DisputeEvent, DisputesResponse } from '@/app/api/ws/[slug]/disputes/route'
import { fmtHours } from '@/lib/client/format-time'
import { en } from "@/locales/en";

const skeletonStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
  backgroundSize: '600px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: '6px',
}

function formatUtc(s: string | null, tz: string): string {
  if (!s) return '—'
  const norm = s.includes('T') ? (s.endsWith('Z') ? s : s + 'Z') : s.replace(' ', 'T') + 'Z'
  return new Date(norm).toLocaleString('en-IN', {
    timeZone: tz, day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function durationHours(checkin: string, checkout: string | null): string {
  if (!checkout) return '—'
  const cin = new Date(checkin.includes('T') ? checkin : checkin.replace(' ', 'T') + 'Z').getTime()
  const cout = new Date(checkout.includes('T') ? checkout : checkout.replace(' ', 'T') + 'Z').getTime()
  const h = (cout - cin) / 3_600_000
  return fmtHours(h)
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function getThisMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(last).padStart(2, '0')}` }
}

interface Props { slug: string; tz: string }

type DisputeFilter = 'all' | DisputeEvent['dispute_type']

const disputeLabels: Record<DisputeEvent['dispute_type'], string> = {
  signal_mismatch: 'Signal mismatch',
  missing_checkout: 'Missing checkout',
  overridden: 'Overridden',
}

export default function DisputesClient({ slug, tz }: Props) {
  const defaultRange = getThisMonthRange()
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [search, setSearch] = useState('')
  const [disputeFilter, setDisputeFilter] = useState<DisputeFilter>('all')
  const [data, setData] = useState<DisputesResponse | null>(null)
  const [pagination, setPagination] = useState<{
    nextOffset: number | null;
  } | null>(null);
  const paginationNextRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false);
  const [overriding, setOverriding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [checkoutInputs, setCheckoutInputs] = useState<Record<string, string>>({})

  const fetchDisputes = useCallback(
    async (opts?: { append?: boolean }) => {
      const append = !!opts?.append;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        if (!append) paginationNextRef.current = null;
        const nextOffset = append ? (paginationNextRef.current ?? 0) : 0;
        const res = await fetch(
          `/api/ws/${slug}/disputes?start=${startDate}&end=${endDate}&limit=10&offset=${nextOffset}&search=${encodeURIComponent(search)}&type=${encodeURIComponent(disputeFilter)}`,
        );
        if (res.ok) {
          const next = (await res.json()) as DisputesResponse;
          const nextCursor = next.pagination?.nextOffset ?? null;
          paginationNextRef.current = nextCursor;
          setData((prev) => {
            if (!append || !prev) return next;
            return { ...next, events: [...prev.events, ...next.events] };
          });
          setPagination({ nextOffset: nextCursor });
        }
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [slug, startDate, endDate, search, disputeFilter],
  );

  useEffect(() => {
    setData(null);
    setPagination(null);
    paginationNextRef.current = null;
    fetchDisputes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, startDate, endDate, search, disputeFilter]);

  async function handleOverride(eventId: string) {
    setOverriding(eventId)
    try {
      const effectiveCheckout = checkoutInputs[eventId]
      const res = await fetch(`/api/ws/${slug}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          note: noteInputs[eventId] ?? '',
          effective_checkout_at: effectiveCheckout ? new Date(effectiveCheckout).toISOString() : null,
        }),
      })
      if (res.ok) await fetchDisputes();
    } finally {
      setOverriding(null)
    }
  }

  async function handleRemoveOverride(eventId: string) {
    setRemoving(eventId)
    try {
      const res = await fetch(`/api/ws/${slug}/disputes/${eventId}`, { method: 'DELETE' })
      if (res.ok) await fetchDisputes();
    } finally {
      setRemoving(null)
    }
  }

  const events = data?.events ?? [];
  const canViewMore = !loading && (pagination?.nextOffset ?? null) !== null;

  return (
    <div>
      {/* Date range controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            height: "36px",
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <span
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          to
        </span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            height: "36px",
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => {
            const r = getThisMonthRange();
            setStartDate(r.start);
            setEndDate(r.end);
          }}
          style={{
            height: "36px",
            padding: "0 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            background: "var(--surface-2)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          This month
        </button>
        <input
          type="search"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            height: "36px",
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            outline: "none",
            minWidth: "210px",
          }}
        />
        <select
          value={disputeFilter}
          onChange={(e) => setDisputeFilter(e.target.value as DisputeFilter)}
          style={{
            height: "36px",
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            fontFamily: "DM Sans, sans-serif",
            background: "var(--surface-0)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        >
          <option value="all">All dispute types</option>
          <option value="signal_mismatch">Signal mismatch</option>
          <option value="missing_checkout">Missing checkout</option>
          <option value="overridden">Overridden</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                ...skeletonStyle,
                height: "64px",
                borderRadius: "var(--radius-md)",
              }}
            />
          ))}
        </div>
      ) : !data?.signals_configured && events.length === 0 ? (
        <div
          style={{
            background: "color-mix(in srgb, var(--amber) 8%, transparent)",
            border: "1px solid var(--amber)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "14px",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            No location signals configured, and there are no missing-checkout
            events in this period.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          {events.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "14px",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                No disputes in this period.
              </p>
            </div>
          ) : (
            <>
              {events.map((ev, i) => (
                <EventRow
                  key={ev.event_id}
                  ev={ev}
                  tz={tz}
                  isLast={i === events.length - 1 && !loadingMore}
                  overriding={overriding === ev.event_id}
                  removing={removing === ev.event_id}
                  noteValue={
                    ev.overridden
                      ? (ev.note ?? "")
                      : (noteInputs[ev.event_id] ?? "")
                  }
                  onNoteChange={(v) =>
                    setNoteInputs((prev) => ({ ...prev, [ev.event_id]: v }))
                  }
                  checkoutValue={checkoutInputs[ev.event_id] ?? ""}
                  onCheckoutChange={(v) =>
                    setCheckoutInputs((prev) => ({
                      ...prev,
                      [ev.event_id]: v,
                    }))
                  }
                  onOverride={() => handleOverride(ev.event_id)}
                  onRevert={() => handleRemoveOverride(ev.event_id)}
                />
              ))}
              {loadingMore &&
                [1, 2, 3].map((k) => (
                  <div
                    key={`more-sk-${k}`}
                    style={{
                      padding: "14px 16px",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        ...skeletonStyle,
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          ...skeletonStyle,
                          height: "14px",
                          width: "45%",
                          marginBottom: "8px",
                        }}
                      />
                      <div
                        style={{
                          ...skeletonStyle,
                          height: "11px",
                          width: "70%",
                        }}
                      />
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {/* View more */}
      {!loading && canViewMore && (
        <div style={{ marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => fetchDisputes({ append: true })}
            disabled={loadingMore}
            style={{
              height: "44px",
              width: "100%",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: loadingMore ? "default" : "pointer",
            }}
          >
            {loadingMore ? en.wsDisputes.loadingMore : en.wsDisputes.viewMore}
          </button>
        </div>
      )}
    </div>
  );
}

function EventRow({
  ev,
  tz,
  isLast,
  overriding,
  removing,
  noteValue,
  onNoteChange,
  checkoutValue,
  onCheckoutChange,
  onOverride,
  onRevert,
}: {
  ev: DisputeEvent;
  tz: string;
  isLast: boolean;
  overriding: boolean;
  removing: boolean;
  noteValue: string;
  onNoteChange: (v: string) => void;
  checkoutValue: string;
  onCheckoutChange: (v: string) => void;
  onOverride: () => void;
  onRevert: () => void;
}) {
  const ini = initials(ev.member_name);
  const mismatchMetres = ev.checkout_location_mismatch;
  const badgeColor =
    ev.dispute_type === "missing_checkout"
      ? "var(--amber)"
      : ev.dispute_type === "overridden"
        ? "var(--teal)"
        : "var(--danger)";
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          flexShrink: 0,
          background: "color-mix(in srgb, var(--danger) 12%, transparent)",
          color: "var(--danger)",
          fontFamily: "DM Sans, sans-serif",
          fontSize: "12px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ini}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: "180px" }}>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: "0 0 2px",
          }}
        >
          {ev.member_name}
        </p>
        <p
          style={{
            fontFamily: "DM Sans, sans-serif",
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          {ev.member_email}
        </p>
        <div
          style={{
            marginTop: "6px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "18px",
              padding: "0 6px",
              borderRadius: "4px",
              fontSize: "11px",
              fontFamily: "DM Sans, sans-serif",
              fontWeight: 600,
              color: badgeColor,
              background: `color-mix(in srgb, ${badgeColor} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${badgeColor} 35%, transparent)`,
              whiteSpace: "nowrap",
            }}
          >
            {disputeLabels[ev.dispute_type]}
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            {formatUtc(ev.checkin_at, tz)}
          </span>
          <span
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            {durationHours(ev.checkin_at, ev.checkout_at)}
          </span>
          {ev.location_label && (
            <span
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              📍 {ev.location_label}
            </span>
          )}
          {ev.has_gps && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              GPS
            </span>
          )}
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {ev.matched_by}
          </span>
          {mismatchMetres !== null && mismatchMetres > 0 && (
            <span
              title="Checked out from a different location"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "18px",
                padding: "0 6px",
                borderRadius: "4px",
                fontSize: "11px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 600,
                color: "var(--amber)",
                background: "color-mix(in srgb, var(--amber) 10%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--amber) 35%, transparent)",
                whiteSpace: "nowrap",
              }}
            >
              ⊘ {mismatchMetres}m away
            </span>
          )}
        </div>
        {ev.note && (
          <p
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "12px",
              color: "var(--text-muted)",
              marginTop: "4px",
              fontStyle: "italic",
            }}
          >
            {ev.note}
          </p>
        )}
      </div>

      {/* Override action */}
      <div
        style={{
          flex: "0 0 100%",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Note (optional)"
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            disabled={ev.overridden}
            style={{
              flex: 1,
              minWidth: 0,
              height: "32px",
              padding: "0 10px",
              fontSize: "12px",
              fontFamily: "DM Sans, sans-serif",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              outline: "none",
              opacity: ev.overridden ? 0.7 : 1,
            }}
          />
          <button
            type="button"
            disabled={ev.overridden ? removing : overriding}
            onClick={ev.overridden ? onRevert : onOverride}
            style={{
              flexShrink: 0,
              height: "32px",
              padding: "0 12px",
              fontFamily: "DM Sans, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              background: ev.overridden ? "transparent" : "var(--teal)",
              color: ev.overridden ? "var(--danger)" : "#fff",
              border: ev.overridden
                ? "1px solid color-mix(in srgb, var(--danger) 40%, transparent)"
                : "none",
              borderRadius: "var(--radius-sm)",
              cursor: (ev.overridden ? removing : overriding)
                ? "default"
                : "pointer",
              opacity: (ev.overridden ? removing : overriding) ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {ev.overridden
              ? removing
                ? "Removing…"
                : "Revert"
              : overriding
                ? "Counting…"
                : "Count this event"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label
            style={{
              fontFamily: "DM Sans, sans-serif",
              fontSize: "11px",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Effective checkout:
          </label>
          <input
            type="datetime-local"
            value={checkoutValue}
            onChange={(e) => onCheckoutChange(e.target.value)}
            disabled={ev.overridden}
            style={{
              flex: 1,
              minWidth: 0,
              height: "30px",
              padding: "0 8px",
              fontSize: "12px",
              fontFamily: "DM Sans, sans-serif",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              outline: "none",
              opacity: ev.overridden ? 0.7 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}
