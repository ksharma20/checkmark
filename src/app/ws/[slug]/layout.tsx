import { notFound, redirect } from "next/navigation";
import WsLayoutClient from "@/components/ws/WsLayoutClient";

import { en } from "@/locales/en";
import { getServerUser } from "@/lib/auth";
import {
  getWorkspaceBySlug,
  getWorkspaceMember,
} from "@/lib/db/queries/workspaces";

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
    <>
      <link rel="manifest" href="/manifest-ws.json" />
      <meta name="theme-color" content="#0D1B2A" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={`${en.brand.shortName} WS`} />
      <WsLayoutClient slug={slug}>{children}</WsLayoutClient>
    </>
  );
}
