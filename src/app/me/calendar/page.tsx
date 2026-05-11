import { getServerUser } from "@/lib/auth";
import { getUserWorkspaces, getWorkspacesByIds } from "@/lib/db/queries/workspaces";
import CalendarView from "./CalendarView";

export const metadata = { title: "Holiday Calendar" };

export default async function CalendarPage() {
  const user = await getServerUser();
  if (!user) return null;

  const memberships = await getUserWorkspaces(user.userId);
  const workspaceIds = memberships.map((m) => m.workspace_id);
  const workspaces = await getWorkspacesByIds(workspaceIds);
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));

  const slugs = memberships.flatMap((m) => {
    const ws = wsMap.get(m.workspace_id);
    return ws ? [ws.slug] : [];
  });

  return <CalendarView slugs={slugs} />;
}
