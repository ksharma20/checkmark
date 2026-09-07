/**
 * The screen registry - the single list of pages on the org surface at
 * /ws/:slug, and which permission each one needs.
 *
 * DATA ONLY, for the same reason as ./catalogue: this is imported by the
 * sidebar (a client component) as well as by server code.
 *
 * Every entry answers three questions in one place: where does the screen
 * live, which resource gates it, and does it depend on a workspace feature
 * being switched on. Icons and labels are deliberately absent - icons are JSX
 * and labels are copy, so they live in the sidebar and in src/locales/en.ts
 * respectively, both keyed by the Screen enum below.
 *
 * The /me surface has no screen registry: it is not permissioned.
 */

import { Resource } from './catalogue'

/** Every page on the org surface. */
export enum Screen {
  Overview = 'overview',
  /**
   * The reporting tree at /org, gated on `employees`.
   *
   * This slot used to be the HR directory. That directory merged into /people
   * when it started listing every member - two screens over the same people,
   * from opposite tables, disagreeing on the headcount. The employee RECORD is
   * still what `employees:read` protects; this is the shape of the org.
   */
  Organisation = 'organisation',
  Assets = 'assets',
  Attendance = 'attendance',
  Leave = 'leave',
  Holidays = 'holidays',
  Approvals = 'approvals',
  /**
   * The workforce directory at /people - every member, HR record overlaid,
   * invited people included. Gated on `members`; the HR columns inside it are
   * gated separately on `employees` by the route that feeds them.
   */
  People = 'people',
  Analytics = 'analytics',
  Activity = 'activity',
  Reports = 'reports',
  Roles = 'roles',
  Settings = 'settings',
}

/** Sidebar section a screen is filed under. */
export enum ScreenGroup {
  Workforce = 'workforce',
  Manage = 'manage',
}

/** Order the groups render in. */
export const SCREEN_GROUP_ORDER: readonly ScreenGroup[] = [
  ScreenGroup.Workforce,
  ScreenGroup.Manage,
]

/**
 * Workspace-level switches that hide a screen regardless of permission.
 *
 * Distinct from a permission: `leaves_enabled` is off for workspaces that do
 * not run leave at all, so the tab is meaningless there even for an owner.
 */
export enum WorkspaceFeature {
  Leaves = 'leaves',
}

/** Second-level links under a screen. Navigational only - not permissioned. */
export enum SubScreen {
  LeaveRequests = 'leaveRequests',
  LeaveApplied = 'leaveApplied',
}

export interface SubScreenDef {
  key: SubScreen
  /** Appended to /ws/:slug, same as ScreenDef.path. */
  path: string
}

export interface ScreenDef {
  key: Screen
  /** Appended to /ws/:slug. The empty string is the workspace root. */
  path: string
  group: ScreenGroup
  /** Read on this resource is required to see and open the screen. */
  resource: Resource
  /** Workspace switch that must be on, or null when the screen is always available. */
  feature: WorkspaceFeature | null
  subScreens?: readonly SubScreenDef[]
}

/**
 * Keyed by Screen so the compiler enforces exhaustiveness - a new enum member
 * without a definition here is a build error rather than a tab that silently
 * never renders.
 *
 * Declaration order IS render order (see SCREENS below), so this object is
 * written in the order the sidebar should show, group by group.
 */
const SCREEN_DEFS: Record<Screen, ScreenDef> = {
  // ── Workforce: the day-to-day people surface ──────────────────────────────
  [Screen.Overview]: {
    key: Screen.Overview, path: '', group: ScreenGroup.Workforce,
    resource: Resource.Dashboard, feature: null,
  },
  [Screen.Organisation]: {
    key: Screen.Organisation, path: '/org', group: ScreenGroup.Workforce,
    resource: Resource.Employees, feature: null,
  },
  [Screen.Assets]: {
    key: Screen.Assets, path: '/assets', group: ScreenGroup.Workforce,
    resource: Resource.Assets, feature: null,
  },
  [Screen.Attendance]: {
    key: Screen.Attendance, path: '/attendance', group: ScreenGroup.Workforce,
    resource: Resource.Dashboard, feature: null,
  },
  [Screen.Leave]: {
    key: Screen.Leave, path: '/leaves', group: ScreenGroup.Workforce,
    resource: Resource.Leaves, feature: WorkspaceFeature.Leaves,
    subScreens: [
      { key: SubScreen.LeaveRequests, path: '/leaves' },
      { key: SubScreen.LeaveApplied, path: '/leaves' },
    ],
  },
  [Screen.Holidays]: {
    key: Screen.Holidays, path: '/holidays', group: ScreenGroup.Workforce,
    resource: Resource.Holidays, feature: WorkspaceFeature.Leaves,
  },
  [Screen.Approvals]: {
    key: Screen.Approvals, path: '/approvals', group: ScreenGroup.Workforce,
    resource: Resource.Approvals, feature: null,
  },

  // ── Manage: workspace administration ──────────────────────────────────────
  [Screen.People]: {
    key: Screen.People, path: '/people', group: ScreenGroup.Manage,
    resource: Resource.Members, feature: null,
  },
  [Screen.Analytics]: {
    key: Screen.Analytics, path: '/insights', group: ScreenGroup.Manage,
    resource: Resource.Analytics, feature: null,
  },
  [Screen.Activity]: {
    key: Screen.Activity, path: '/monthly', group: ScreenGroup.Manage,
    resource: Resource.Activity, feature: null,
  },
  [Screen.Reports]: {
    key: Screen.Reports, path: '/reports', group: ScreenGroup.Manage,
    resource: Resource.Export, feature: null,
  },
  [Screen.Roles]: {
    key: Screen.Roles, path: '/roles', group: ScreenGroup.Manage,
    resource: Resource.Roles, feature: null,
  },
  [Screen.Settings]: {
    key: Screen.Settings, path: '/settings', group: ScreenGroup.Manage,
    resource: Resource.Settings, feature: null,
  },
}

/** Registry order - drives the order tabs render within their group. */
export const SCREENS: readonly ScreenDef[] = Object.values(SCREEN_DEFS)

export function getScreen(key: Screen): ScreenDef {
  return SCREEN_DEFS[key]
}

/** Absolute href for a screen inside a given workspace. */
export function screenHref(slug: string, screen: ScreenDef | SubScreenDef): string {
  return `/ws/${slug}${screen.path}`
}

interface VisibilityParams {
  /** Resources the viewer's role can read - from readableResources(). */
  readableResources: readonly Resource[]
  leavesEnabled: boolean
}

function isEnabled(feature: WorkspaceFeature | null, params: VisibilityParams): boolean {
  if (feature === null) return true
  return feature === WorkspaceFeature.Leaves ? params.leavesEnabled : false
}

/**
 * Screens this viewer may see, in registry order.
 *
 * Two independent filters: the workspace must have the feature switched on,
 * AND the role must be able to read the resource. Hiding is a courtesy only -
 * the matching API route enforces the same permission independently.
 */
export function visibleScreens(params: VisibilityParams): ScreenDef[] {
  return SCREENS.filter(
    (screen) =>
      isEnabled(screen.feature, params) &&
      params.readableResources.includes(screen.resource),
  )
}

/**
 * The same list arranged into sidebar groups. A group with no surviving
 * screens is dropped entirely rather than rendering an empty heading.
 */
export function visibleScreenGroups(
  params: VisibilityParams,
): Array<{ group: ScreenGroup; screens: ScreenDef[] }> {
  const visible = visibleScreens(params)
  return SCREEN_GROUP_ORDER.map((group) => ({
    group,
    screens: visible.filter((screen) => screen.group === group),
  })).filter((entry) => entry.screens.length > 0)
}
