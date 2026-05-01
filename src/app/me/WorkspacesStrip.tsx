"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolvePresenceTag } from "@/lib/client/presence";
import type { MemberTodaySummary } from "@/app/api/me/ws/[slug]/today/route";

type WorkspaceItem = {
  id: string;
  slug: string;
  name: string;
  role: string;
};

type Status =
  | { state: "loading" }
  | { state: "ready"; inOffice: number }
  | { state: "error" };

export default function WorkspacesStrip({ items }: { items: WorkspaceItem[] }) {
  const [statusBySlug, setStatusBySlug] = useState<Record<string, Status>>({});

  const slugs = useMemo(() => items.map((i) => i.slug), [items]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled(
      slugs.map(async (slug) => {
        const res = await fetch(`/api/me/ws/${slug}/today`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { members: MemberTodaySummary[] };
        const inOffice = data.members.filter(
          (m) =>
            m.presence_status === "present" &&
            resolvePresenceTag(
              m.presence_status,
              m.matched_by,
              m.event_type,
            ) === "in_office",
        ).length;
        return { slug, inOffice };
      }),
    ).then((results) => {
      if (cancelled) return;
      setStatusBySlug((prev) => {
        const next = { ...prev };
        results.forEach((r, idx) => {
          if (r.status === "fulfilled") {
            next[r.value.slug] = { state: "ready", inOffice: r.value.inOffice };
            return;
          }
          const slug = slugs[idx];
          if (slug) next[slug] = { state: "error" };
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [slugs]);

  if (items.length === 0) return null;

  return (
    <section>
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
        In workspaces
      </h2>

      {items.map((item) => {
        const status = statusBySlug[item.slug] ?? { state: "loading" as const };
        const inOffice = status.state === "ready" ? status.inOffice : null;

        return (
          <Link
            key={item.id}
            href={`/me/ws/${item.slug}`}
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--surface-0)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: "8px",
              textDecoration: "none",
              cursor: "pointer",
            }}
            className="ws-card-link"
          >
            <div>
              <div
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--text-primary)",
                }}
              >
                {item.name}
              </div>
              <div
                style={{
                  fontFamily: "DM Sans, sans-serif",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  textTransform: "capitalize",
                }}
              >
                {item.role}
              </div>
            </div>

            <div
              style={{
                marginLeft: "auto",
                textAlign: "right",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 700,
                    fontSize: "18px",
                    color: "var(--navy)",
                    minWidth: "32px",
                  }}
                >
                  {status.state === "loading" ? (
                    <span
                      style={{
                        display: "inline-block",
                        width: "24px",
                        height: "18px",
                        borderRadius: "6px",
                        background: "var(--surface-2)",
                        animation: "cm-pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ) : status.state === "error" ? (
                    "—"
                  ) : (
                    inOffice
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "DM Sans, sans-serif",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  People in office today
                </div>
              </div>

              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        );
      })}

      <style>{`@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </section>
  );
}
