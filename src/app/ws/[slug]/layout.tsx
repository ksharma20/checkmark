import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { en } from "@/locales/en";
import { getServerUser } from "@/lib/auth";
import {
  getWorkspaceBySlug,
  getWorkspaceMember,
} from "@/lib/db/queries/workspaces";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function WsSlugLayout({ children, params }: Props) {
  const { slug } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) notFound();

  const membership = await getWorkspaceMember(workspace.id, user.userId);
  if (
    !membership ||
    membership.role !== "admin" ||
    membership.status !== "active"
  ) {
    redirect("/me");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--surface-1)",
      }}
    >
      {/* PWA meta tags */}
      <link rel="manifest" href="/manifest-ws.json" />
      <meta name="theme-color" content="#1B4DFF" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta
        name="apple-mobile-web-app-title"
        content={`${en.brand.shortName} WS`}
      />

      {/* Sticky header */}
      <header
        style={{
          background: "var(--surface-0)",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Brand / workspace row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "52px",
            padding: "0 16px",
            gap: "6px",
          }}
        >
          {/* Brand name — shrinks away on very small screens */}
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "15px",
              color: "var(--brand)",
              flexShrink: 0,
            }}
          >
            {en.brand.name}
          </span>

          <span
            style={{ color: "var(--border)", fontSize: "14px", flexShrink: 0 }}
          >
            /
          </span>

          {/* Workspace name — takes remaining space, truncates */}
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--navy)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workspace.name}
          </span>

          {/* Action buttons — always visible, never pushed out */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <Link
              href="/ws"
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                height: "30px",
                padding: "0 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              ⊞ Workspaces
            </Link>
            <Link
              href="/me"
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "13px",
                color: "var(--text-secondary)",
                textDecoration: "none",
                height: "30px",
                padding: "0 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              Me →
            </Link>
          </div>
        </div>

        {/* Nav tabs — horizontally scrollable, hides scrollbar */}
        <nav
          className="scroll-x"
          style={{ display: "flex", padding: "0 16px", gap: "2px" }}
        >
          <NavTab href={`/ws/${slug}`} label="Dashboard" />
          <NavTab href={`/ws/${slug}/people`} label="People" />
          <NavTab href={`/ws/${slug}/insights`} label="Insights" />
          <NavTab href={`/ws/${slug}/monthly`} label="Monthly" />
          <NavTab href={`/ws/${slug}/disputes`} label="Disputes" />
          <NavTab href={`/ws/${slug}/settings`} label="Settings" />
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>
      <PwaInstallPrompt />
    </div>
  );
}

function NavTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: "DM Sans, sans-serif",
        fontSize: "13px",
        fontWeight: 500,
        color: "var(--text-secondary)",
        textDecoration: "none",
        padding: "10px 12px",
        borderBottom: "2px solid transparent",
        display: "block",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </Link>
  );
}
