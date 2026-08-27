# Venzio - AGENTS.md

AI agent coordination guide for working on this codebase.

---

## Agent Roles

### Explore Agent
**Use for:** Understanding existing code before changing it.
- Read files in `src/lib/`, `src/app/api/`, `src/app/(public)/`, `src/app/me/`, `src/app/ws/`
- Map signal flow: client → API route → query function → DB
- Check schema in `lib/db/schema.ts` + `scripts/migrate.js`
- Never write code - report findings only

### Implementation Agent
**Use for:** Writing or editing code based on a spec.
- Always read the file before editing
- Follow patterns in CLAUDE.md exactly
- One file per task - no sweeping refactors unless scoped
- After changes: check TypeScript compiles (`npm run build`)

### Audit Agent
**Use for:** Finding bugs, gaps, or inconsistencies.
- Compare README claims vs actual code
- Check signal matching logic against AND semantics
- Verify all workspace routes call `requireWsAdmin()`
- Verify no raw SQL in route handlers
- Check cookie settings (httpOnly, SameSite, secure)

### Reviewer Agent
**Use for:** Validating a completed change before merge.
- Run `npm run build` - must pass
- Verify changed routes use `getServerUser()` not req.body.userId
- Verify new DB queries are in `lib/db/queries/` not inline
- Check for new signal matching logic - must be AND semantics

---

## Task Boundaries

### Safe to parallelize (no shared state)
- Marketing page changes (`src/app/(public)/`)
- SEO metadata and sitemap changes (`src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`)
- Different API route domains (checkin vs workspace vs me)
- Different query files (`users.ts` vs `events.ts` vs `leaves.ts`)
- Leave type admin routes vs leave request employee routes
- UI components that don't share state

### Must be sequential (shared state)
- Schema changes + migration script + query functions that use new columns
- Signal matching logic changes + dashboard display changes
- Auth flow changes (proxy.ts + auth.ts + login page)

---

## User-facing copy

English UI copy, emails, and stable technical identifiers live in `src/locales/en.ts`. Import `en` and use nested keys (for example `en.meWsToday.tabPeopleNotCheckedIn`). Avoid hardcoding product strings in components or routes; when editing a file that still has literals, prefer moving those strings into `en` in the same change. Technical identifiers (cookie names, DNS prefixes, DB filenames) already belong under `en.constants`.

### Multi-workspace + `/me/timeline`

Users can be active in multiple workspaces. The default **All workspaces** timeline (`GET /api/events`) shows the user’s presence history without workspace-scoped signal evaluation. When a workspace is selected in the UI, use **`GET /api/me/ws/[slug]/events`** (member auth + membership check) so `queryWorkspaceEvents()` can attach `matched_by` / `matched_signals` for that workspace only. Do not add `workspace_id` to `presence_events`; keep AND semantics in `lib/signals.ts`.

---

## Signal Matching - The Core

Before touching `lib/signals.ts` or any dashboard code, understand this:

```
Workspace signal config → defines WHAT signals are expected
Presence event → records WHAT signals were actually captured
queryWorkspaceEvents() → compares event signals against workspace config
```

**AND semantics:** If workspace has GPS + WiFi configured, event must match BOTH.
**Admin override:** Bypasses signal matching. Never apply signal logic to overridden events.
**Config-light mode:** No signals configured → all events pass (for small teams / trial orgs).

`MatchedBy` type: `'verified' | 'partial' | 'none' | 'override'`
- `verified` - all configured signals matched
- `partial` - some signals matched, not all
- `none` - no signals matched (check-in exists but not verified)
- `override` - admin manually overrode this event

**Attendance stats:** Use `src/lib/attendance-summary.ts` for all WFO/WFH/Leave or office/remote/absent counts. Count by workspace-local day, not by event. If any event on a day is `verified` or `override`, the day is WFO/office. If events exist but none are verified/overridden, the day is WFH/remote. If no event exists, the day is Leave/absent. Never count one day in both WFO and WFH.

---

## DB Query Conventions

Local DB sync from Turso:
- Use `npm run db:sync` to replace local SQLite data from Turso.
- The script reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `.env.local` or the shell.
- It writes `venzio.db` by default, or `LOCAL_DATABASE_PATH` when set, and keeps a timestamped backup of the previous local DB.

```ts
// lib/db/queries/example.ts
import { db } from '../index'

// Always scope by workspace_id for workspace data
export async function getThingForWorkspace(workspaceId: string, thingId: string) {
  return db.queryOne<Thing>(
    'SELECT * FROM things WHERE id = ? AND workspace_id = ?',
    [thingId, workspaceId]
  )
}

// Always filter deleted_at IS NULL for user queries
export async function getActiveUser(userId: string) {
  return db.queryOne<User>(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId]
  )
}
```

Never inline SQL in route handlers. Never skip `AND workspace_id = ?`.

Query files and their domains:
- `users.ts` — user accounts, rate limits, revoked tokens
- `events.ts` — presence events
- `workspaces.ts` — workspaces, members, admin overrides
- `signals.ts` — workspace signal configs
- `stats.ts` — user stats
- `tokens.ts` — API tokens
- `push.ts` — push subscriptions
- `holidays.ts` — workspace holiday calendar
- `leaves.ts` — workspace leave types (`workspace_leave_types`) and leave requests (`leave_requests`); exports `getLeaveTypesWithBalance()` which computes balance from join date using calendar month/quarter arithmetic
- `employees.ts` — employee records (personal, contact, employment, lifecycle, identity, bank, emergency contact); sensitive fields AES-256-GCM encrypted; exports `listEmployees`, `getEmployee`, `createEmployee`, `updateEmployee`, `softDeleteEmployee`
- `roles.ts` — workspace roles and permission grids; exports `seedSystemRoles`, `getMembershipWithRole`, `listWorkspaceRoles`

### Creating a workspace

Permissions resolve by joining `workspace_members.role` → `workspace_roles`. A workspace with no rows in `workspace_roles` therefore grants **nobody** anything — its own creator cannot open it, manage it, or see it in the picker, and there is no way back through the UI.

So `createWorkspace()` must, in a single transaction:
1. insert the `workspaces` row,
2. call `seedSystemRoles(id, tx)` to create owner/admin/member,
3. insert the creator as **`owner`** (not `admin` — only `owner` holds the `ownership` resource, i.e. transfer, archive and billing).

The seeded grids live in **`src/lib/permissions/system-roles.json`**, read by both `src/lib/permissions/system-roles.ts` and `scripts/migrate.js`. Do not create a second copy of them anywhere — the app and the migration holding separate definitions is what shipped every new workspace with no roles at all.

`seedSystemRoles` is idempotent (`INSERT OR IGNORE` against the partial unique index), so `npm run migrate` also repairs any workspace already missing its roles.

### Assigning a role

`PATCH /api/ws/[slug]/members/[memberId]/role` checks **three** things, all required:

1. `can(ctx.role.permissions, 'members.role', 'write')` — may the caller assign roles at all?
2. `canManage` / `canGrant` — rank of the target, and rank of the role being granted.
3. `guardEscalation(ctx.role.permissions, newRole.permissions)` — is the granted grid a subset of the caller's?

Step 3 is not optional. Rank cannot substitute for it: all custom roles share `CUSTOM_ROLE_RANK`, so `canGrant` is satisfied for every custom-to-custom assignment, and an admin outranks a custom role holding `ownership` (which no admin has). Without step 3, the roles builder's escalation check is bypassed by assigning a role instead of writing one.

### Data scope

`workspace_roles.scope` is **not** a user-editable field. Both roles routes set `Scope.All` server-side and ignore any `scope` in the body.

`Scope.Self` does not mean "org surface, own rows only" — that is `/me`, which every user already has from being logged in, whatever their role (no `/me` route consults a role). It means "no org surface at all", and only the seeded `member` role carries it. When the reporting hierarchy lands, the real choice is all-vs-subtree and the control comes back to the roles builder then.

---

## SEO Conventions

- Root SEO metadata and structured data live in `src/app/layout.tsx`.
- Search crawler rules live in `src/app/robots.ts`.
- The public sitemap lives in `src/app/sitemap.ts`.
- Keep marketing pages indexable: `/`, `/for-teams`, `/for-you`, `/pricing`, `/open-source`, `/privacy`, `/terms`.
- Keep private/app pages non-indexable: `/login`, `/consent/*`, `/me/*`, `/ws/*`, `/api/*`.
- When adding a public marketing page, add route metadata with `alternates.canonical` and include it in the sitemap.
- Production `NEXT_PUBLIC_APP_URL` must be the canonical domain (`https://venzio.ai`) so sitemap, robots, Open Graph URLs, and canonical tags do not point to localhost.

---

## Route Handler Pattern

```ts
// src/app/api/ws/[slug]/example/route.ts
import { requireWsAdmin } from '@/lib/ws-admin'
import { getServerUser } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await requireWsAdmin(req, params.slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ctx.workspace.id and ctx.userId are now verified
  const data = await getSomethingForWorkspace(ctx.workspace.id)
  return NextResponse.json(data)
}
```

For user routes (not workspace):
```ts
const user = await getServerUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// user.id and user.email are verified from JWT
```

---

## Error Response Format

Always return structured errors:
```ts
return NextResponse.json(
  { error: 'Human-readable message', code: 'MACHINE_CODE' },
  { status: 400 }
)
```

Common codes: `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `ALREADY_EXISTS`, `RATE_LIMITED`, `PLAN_LIMIT`, `INSUFFICIENT_BALANCE`.

---

## When to Read First

Before editing any of these files, always read them first:
- `lib/signals.ts` - core logic, easy to break AND semantics
- `lib/auth.ts` - security-critical, JWT + cookie handling
- `lib/db/schema.ts` - understand all columns before adding queries
- `proxy.ts` - edge middleware, limited runtime (no Node.js APIs)

---

## What Agents Must Not Do

- Write SQL directly in route files
- Modify `presence_events` rows (immutable after insert, except `note`)
- Delete user/workspace data (soft delete only)
- Store raw WiFi SSIDs (always bcrypt hash)
- Add drop shadows or gradients to UI components
- Introduce new npm dependencies without noting it in the PR description
- Change signal matching from AND to OR logic
- Trust userId or workspaceId from request body without JWT verification

---

## Keeping Docs in Sync

**REQUIRED:** Whenever you change code that affects documented behaviour - API routes, auth flow, signal matching logic, plan limits, cookie settings, DB schema, environment variables - you MUST also update the relevant docs:

1. `README.md` - update the affected section
2. `CLAUDE.md` - update invariants, architecture, or key rules if affected
3. `AGENTS.md` - update conventions or patterns if affected

Never let code and docs diverge. Stale docs cause bugs in future AI-assisted sessions because agents rely on them for context.

**What counts as "documented behaviour":**
- Adding/removing/renaming API routes
- Changing HTTP status codes or error codes
- Modifying auth flow (cookies, OTP, JWT)
- Changing signal matching semantics
- Adding DB columns or tables
- Changing plan limits or feature flags
- Adding/removing environment variables
