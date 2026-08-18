import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import WsLayoutClient from "@/components/ws/WsLayoutClient";

import { en } from "@/locales/en";
import { getServerUser } from "@/lib/auth";
import {
  getWorkspaceBySlug,
  getWorkspaceMember,
  getActiveMemberIds,
} from "@/lib/db/queries/workspaces";
import { getUserById } from "@/lib/db/queries/users";
import { getPendingLeaveCount } from "@/lib/db/queries/leaves";
import { getPendingRegularizationCount } from "@/lib/db/queries/regularizations";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: "Workspace",
  robots: {
    index: false,
    follow: false,
  },
};

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

  const [dbUser, activeMemberIds, pendingLeaveCount, pendingRegularizationCount] = await Promise.all([
    getUserById(user.userId),
    getActiveMemberIds(workspace.id),
    workspace.leaves_enabled ? getPendingLeaveCount(workspace.id) : Promise.resolve(0),
    getPendingRegularizationCount(workspace.id),
  ]);

  return (
    <>
      <link rel="manifest" href="/manifest-ws.json" />
      <meta name="theme-color" content="#0D1B2A" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={`${en.brand.shortName} WS`} />
      <WsLayoutClient
        slug={slug}
        leavesEnabled={!!workspace.leaves_enabled}
        workspaceName={workspace.name}
        memberCount={activeMemberIds.length}
        pendingLeaveCount={pendingLeaveCount}
        pendingApprovalsCount={pendingLeaveCount + pendingRegularizationCount}
        userName={dbUser?.full_name?.trim() || user.email}
        userRole={membership.role}
      >
        {children}
      </WsLayoutClient>
    </>
  );
}
