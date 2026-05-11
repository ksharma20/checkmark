"use client";

import Link from "next/link";

type WorkspaceItem = {
  id: string;
  slug: string;
  name: string;
  role: string;
};

export default function WorkspacesStrip({ items }: { items: WorkspaceItem[] }) {
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

      {items.map((item) => (
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

          <svg
            style={{ marginLeft: "auto" }}
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
        </Link>
      ))}
    </section>
  );
}
