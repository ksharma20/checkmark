import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import PageTransition from "@/components/PageTransition";
import NavTabs from "@/components/ws/NavTabs";

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
      <meta name="theme-color" content="#ffffff" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta
        name="apple-mobile-web-app-title"
        content={`${en.brand.shortName} WS`}
      />

      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 1px 0 rgba(27,77,255,0.15)",
        }}
      >
        {/* Brand / workspace row — dark navy */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "52px",
            padding: "0 16px",
            gap: "8px",
            background: "var(--header-bg)",
          }}
        >
          <img
            src="/logo.png"
            alt="CheckMark"
            style={{ height: "45px", width: "auto", flexShrink: 0 }}
          />

          <span style={{ color: "rgba(27,77,255,0.4)", fontSize: "16px", flexShrink: 0 }}>|</span>

          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 600,
              fontSize: "14px",
              color: "#F1F5F9",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {workspace.name}
          </span>

          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
            <Link
              href="/ws"
              style={{
                fontFamily: "DM Sans, sans-serif",
                fontSize: "12px",
                color: "rgba(241,245,249,0.65)",
                textDecoration: "none",
                height: "28px",
                padding: "0 10px",
                border: "1px solid rgba(27,77,255,0.35)",
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
                fontSize: "12px",
                color: "rgba(241,245,249,0.65)",
                textDecoration: "none",
                height: "28px",
                padding: "0 10px",
                border: "1px solid rgba(27,77,255,0.35)",
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

        {/* Nav tabs row — white background for contrast */}
        <div style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--border)" }}>
          <NavTabs slug={slug} />
        </div>
      </header>

      <main style={{ flex: 1 }}><PageTransition>{children}</PageTransition></main>
      <PwaInstallPrompt />
    </div>
  );
}
