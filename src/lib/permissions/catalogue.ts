/**
 * The permission catalogue - the single list of what can be permissioned.
 *
 * This file is DATA ONLY. It is imported by client components (the Roles
 * grid), by route handlers and by server-side validation, so it must not pull
 * in server-side logic or database code.
 *
 * A resource declares which actions are meaningful for it. Anything not
 * declared here does not exist: you cannot "delete" a dashboard, so the
 * dashboard resource simply has no delete action. Server validation and the
 * Roles grid both read this list, so they can never disagree about which cells
 * are real.
 *
 * The SCREEN half of the config - which pages exist and which resource each
 * one reads - lives next door in ./screens.
 */

/** Every verb the system can permission. */
export enum Action {
  Read = 'read',
  Write = 'write',
  Delete = 'delete',
}

/**
 * Every resource the system can permission.
 *
 * These string values are persisted inside the `permissions` JSON column on
 * workspace_roles, so changing one is a data migration, not a rename.
 */
export enum Resource {
  Dashboard = 'dashboard',
  Analytics = 'analytics',
  Activity = 'activity',
  Export = 'export',

  Members = 'members',
  Employees = 'employees',
  Holidays = 'holidays',
  Leaves = 'leaves',
  Approvals = 'approvals',
  Signals = 'signals',
  Domains = 'domains',
  Settings = 'settings',

  // Split out from `Members` deliberately: inviting someone and changing
  // someone's role are wildly different risk levels. Keeping them on separate
  // rows means the grid stays three columns wide instead of five.
  AssignRoles = 'members.role',
  Roles = 'roles',

  // Transfer ownership, archive/restore, plan and billing.
  Ownership = 'ownership',
}

export interface ResourceDef {
  key: Resource
  /** Human label - shown as the row heading in the Roles grid. */
  label: string
  actions: readonly Action[]
}

const { Read, Write, Delete } = Action

/**
 * Keyed by Resource rather than a bare array so the compiler enforces
 * exhaustiveness: adding a member to the enum without describing it here is a
 * build error, not a resource that silently supports no actions.
 */
const RESOURCE_DEFS: Record<Resource, ResourceDef> = {
  [Resource.Dashboard]: { key: Resource.Dashboard, label: 'Dashboard',            actions: [Read] },
  [Resource.Analytics]: { key: Resource.Analytics, label: 'Analytics & insights', actions: [Read] },
  [Resource.Activity]:  { key: Resource.Activity,  label: 'Activity',             actions: [Read] },
  [Resource.Export]:    { key: Resource.Export,    label: 'Export',               actions: [Read] },

  [Resource.Members]:   { key: Resource.Members,   label: 'Members',              actions: [Read, Write, Delete] },
  [Resource.Employees]: { key: Resource.Employees, label: 'Employee records',     actions: [Read, Write, Delete] },
  [Resource.Holidays]:  { key: Resource.Holidays,  label: 'Holidays',             actions: [Read, Write, Delete] },
  [Resource.Leaves]:    { key: Resource.Leaves,    label: 'Leave',                actions: [Read, Write, Delete] },
  [Resource.Approvals]: { key: Resource.Approvals, label: 'Approvals',            actions: [Read, Write] },
  [Resource.Signals]:   { key: Resource.Signals,   label: 'Signal config',        actions: [Read, Write, Delete] },
  [Resource.Domains]:   { key: Resource.Domains,   label: 'Domains',              actions: [Read, Write, Delete] },
  [Resource.Settings]:  { key: Resource.Settings,  label: 'Workspace settings',   actions: [Read, Write] },

  [Resource.AssignRoles]: { key: Resource.AssignRoles, label: 'Assign roles',     actions: [Write] },
  [Resource.Roles]:       { key: Resource.Roles,       label: 'Roles',            actions: [Read, Write, Delete] },

  [Resource.Ownership]: { key: Resource.Ownership, label: 'Ownership & billing',  actions: [Write, Delete] },
}

/** Catalogue order - drives the row order of the Roles grid. */
export const RESOURCES: readonly ResourceDef[] = Object.values(RESOURCE_DEFS)

// A Map rather than indexing RESOURCE_DEFS directly: this is fed untrusted
// request keys, and a plain object would resolve `constructor` or `toString`
// to something truthy off the prototype.
const RESOURCES_BY_KEY = new Map<string, ResourceDef>(RESOURCES.map((r) => [r.key, r]))

export function getResource(key: string): ResourceDef | null {
  return RESOURCES_BY_KEY.get(key) ?? null
}

/** True when the action is meaningful for the resource (see file header). */
export function resourceSupports(key: string, action: string): boolean {
  const resource = RESOURCES_BY_KEY.get(key)
  return !!resource && (resource.actions as readonly string[]).includes(action as Action)
}

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Roles Venzio owns. They are seeded into every workspace and can never be
 * edited or deleted - if an owner could untick `settings:write` on the owner
 * role they would permanently lock every human out of their own workspace.
 *
 * There is no `is_system` column: lockedness is derived from the key, and this
 * enum is the one place that decides it.
 */
export enum SystemRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}

const SYSTEM_ROLE_KEYS: readonly string[] = Object.values(SystemRole)

export function isSystemRole(key: string): key is SystemRole {
  return SYSTEM_ROLE_KEYS.includes(key)
}

/**
 * How much of the workspace a role may see.
 *
 * `Self` is NOT "the org surface, showing only your own rows" - that is what
 * /me is, and every user already has it from being logged in, whatever their
 * role. It means "no org surface at all", and only the seeded `member` role
 * carries it. Every /ws role is therefore `All`, which is why the roles builder
 * offers no choice: the only real alternative is the `Subtree` of phase 3.
 */
export enum Scope {
  All = 'all',
  Self = 'self',
}

/**
 * Coerce a STORED scope value to a Scope. Not a request-body parser - routes
 * decide scope themselves rather than accepting one from the client.
 *
 * Unrecognised values fall back to `self` so a corrupt column closes the org
 * surface rather than opening it. When phase 3 adds `subtree`, that becomes the
 * safer fallback: by then `self` blanks a role rather than narrowing it.
 */
export function parseScope(raw: unknown): Scope {
  return raw === Scope.All ? Scope.All : Scope.Self
}

export type PermissionGrid = Partial<Record<Resource, Action[]>>

/**
 * `Object.entries` over a grid, typed.
 *
 * A Partial<Record<Resource, …>> widens its keys to plain strings under
 * Object.entries and admits `undefined` values. Every caller wants neither, so
 * the narrowing happens once here instead of with a cast at each use site.
 */
export function gridEntries(grid: PermissionGrid): Array<[Resource, Action[]]> {
  return (Object.entries(grid) as Array<[Resource, Action[] | undefined]>)
    .filter((entry): entry is [Resource, Action[]] => Array.isArray(entry[1]))
}

/**
 * The seeded grids for the three system roles live in ./system-roles.json, not
 * here - this file stays a pure catalogue, and the JSON is readable by both the
 * app (./system-roles.ts) and the CommonJS migration script, which cannot
 * import TypeScript. That one shared file is the source of truth for seeding,
 * and its grids are written with the Resource/Action string values above.
 */
