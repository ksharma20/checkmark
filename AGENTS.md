# Venzio - AGENTS.md

AI agent coordination guide for working on this codebase.

---

## Agent Roles

### Explore Agent
**Use for:** Understanding existing code before changing it.
- Read files in `src/lib/`, `src/app/api/`, `src/app/(public)/`, `src/app/me/`, `src/app/ws/`
- Map signal flow: client → API route → query function → DB
- **Check schema in `scripts/migrate.js`. `lib/db/schema.ts` was deleted — there is no TypeScript schema file, no ORM model, nothing else that knows what columns exist.** The row-shape interfaces inside each query file are documentation, not enforcement: the compiler never checks them against the database, so trusting one instead of the migration is how you write a query against a column that isn't there.
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
- Verify every `/api/ws/[slug]/*` route calls `requireWsAccess(req, slug, Resource, Action)` and returns `forbidden()` on `null`. **`requireWsAdmin()` was removed** — a route still importing it will not build, and a route that gates on membership alone has no permission check at all
- Verify `/api/me/ws/[slug]/*` routes use `requireWsMember()` and scope to the session user
- Verify no raw SQL in route handlers
- Check cookie settings (httpOnly, SameSite, secure)

### Design System Agent
**Use for:** Anything touching `src/app/globals.css` or `src/components/ui/`.
- Read `docs/design/` first — tokens, motion tiers, the reduced-motion contract, the elevation rule, the 44px rule
- **Run alone.** These files are shared by every screen; see Task Boundaries
- A new visual goes in as a class in `globals.css`, or as a primitive that uses one. Never a `<style>` block, never an inline style object
- A new decorative animation must be added to the `prefers-reduced-motion` guard in the same change
- Update `docs/design/` in the same change

> **Destructive actions:** there is one confirmation primitive, `src/components/ui/ConfirmDialog.tsx`. Never add a `window.confirm`, and never hand-roll another `Modal` confirm — the shape is fixed (title, one `.t-secondary` line, optional `.field-hint` caveat, optional `.field-error`, cancel-then-confirm). Anything needing more than that is not a confirmation; use `Modal` directly.

### Reviewer Agent
**Use for:** Validating a completed change before merge.
- Run `npm run build` - must pass
- Verify changed routes use `getServerUser()` not req.body.userId
- Verify workspace routes gate on `requireWsAccess(..., Resource, Action)` with the resource the screen registry uses
- Verify new DB queries are in `lib/db/queries/` not inline
- Check for new signal matching logic - must be AND semantics
- Check for new styles: any new class belongs in `globals.css`; any new animation must appear in the reduced-motion guard
- Check new user-facing strings live in a `src/locales/en/` module

---

## Task Boundaries

The repo has three layers, and they parallelise very differently.

### Layer 1 — the design system: SHARED AND SEQUENTIAL

`src/app/globals.css` and `src/components/ui/` are one file and one small directory that **every screen depends on**. Two agents editing them at once produce duplicate near-identical classes, or one agent's `.btn` change silently reshaping the other's page.

So: **finish the design-system layer before starting surface work, and give it to one agent.** Concretely, a change is design-system work if it touches `globals.css`, adds or alters a `src/components/ui/` primitive, or changes the barrel `src/components/ui/index.ts` (which every surface imports — a merge conflict there blocks everyone).

Read `docs/design/` before touching either. A new class goes in `globals.css`, never in a component.

**Order matters inside `globals.css`, and it is easy to get silently wrong.** The file is one flat sheet with no cascade layers, so two rules with the same selector are resolved by *position*: the later one wins, media query or not. A responsive override written into the `@media (max-width: 860px)` shell block near the top of the file will be beaten by a base rule for the same selector declared further down — with no warning, and it looks correct in the source. **Put a breakpoint override immediately after the rule it modifies**, not in whichever media block seems topical. `.stat-row` is the worked example in [docs/design/shells.md](docs/design/shells.md).

### Layer 2 — surfaces: PARALLELISE FREELY

Once the primitives exist, screens are independent. Safe to run at the same time:
- Marketing pages (`src/app/(public)/`, `src/components/*` landing components) — these are outside the app design system and keep their own Tailwind styling
- SEO metadata and sitemap (`src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`)
- Different API route domains (checkin vs workspace vs me)
- Different query files (`users.ts` vs `events.ts` vs `leaves.ts` vs `assets.ts` vs `documents.ts` vs `maternity.ts`)
- Different `/ws/[slug]/*` screens, and different `/me/*` screens
- Leave type admin routes vs leave request employee routes

### Layer 3 — shared-write files: COORDINATE EXPLICITLY

These are edited by *many* otherwise-independent tasks. Two agents appending to the same one will conflict every time. Either serialise them, or have each agent write a **disjoint top-level key** and hand the merge to one owner.

| File | Why it is shared | How to split it |
|---|---|---|
| `src/locales/en.ts` | Every screen's copy is composed here | Add copy to a **per-area module** in `src/locales/en/` and register one import line. Two agents = two modules = one-line conflicts, not thousand-line ones. This is exactly how `wsAdmin` was split: `ws-overview.ts` and `ws-settings.ts` are spread together in `en.ts` and their sub-keys are deliberately disjoint |
| `src/lib/permissions/screens.ts` | Adding a `/ws` screen means a new `Screen` enum member **and** a `SCREEN_DEFS` entry; the `Record<Screen, ScreenDef>` type makes a missing entry a build error, so a half-merge breaks the build for everyone | One agent adds all the screens for a batch of work, before the surface agents start |
| `src/lib/permissions/catalogue.ts` | Same shape — new `Resource` requires a `RESOURCE_DEFS` entry, and the values are persisted in the `permissions` JSON column, so changing one is a data migration | Prefer reusing an existing resource. Maternity reuses `Resource.Leaves` rather than minting its own |
| `src/lib/permissions/system-roles.json` | Read by the app **and** by `scripts/migrate.js` | Never copy it. See CLAUDE.md invariant 12 |
| `src/components/ui/index.ts` | The barrel every surface imports | Owned by the design-system agent |
| `scripts/migrate.js` | The only schema | One agent per batch of schema changes |

### Must be sequential (shared state)
- Schema changes (`scripts/migrate.js`) + query functions that use the new columns
- Signal matching logic changes + dashboard display changes
- Auth flow changes (`proxy.ts` + `auth.ts` + login page)
- Permission catalogue/screen registry changes + the routes and sidebar that read them
- Design-system changes + the screens that consume them

---

## User-facing copy

English UI copy, emails, and stable technical identifiers are assembled into one `en` object by `src/locales/en.ts`. **New copy goes in a per-area module under `src/locales/en/`, not inline in `en.ts`.**

Current modules: `me.ts`, `me-screens.ts`, `me-settings.ts`, `me-announcements.ts`, `marketing.ts`, `documents.ts` (which also exports `assets` and `maternity`), `ws-overview.ts`, `ws-people.ts`, `ws-assets.ts`, `ws-parental.ts`, `ws-approvals.ts`, `ws-announcements.ts`, `ws-leave-types.ts`, `ws-person.ts`, `ws-settings.ts`, `ws-reminders.ts`.

`ws-people.ts` was itself a bottleneck and has been split: `wsAssets` now lives in `ws-assets.ts`, and the parental-leave copy (`wsParental`, including the tab label and the `stage*` keys) in `ws-parental.ts`. `wsApprovals` moved out of the inline groups in `en.ts` into `ws-approvals.ts`. All still resolve as `en.wsAssets.x` etc. — do not move them back.

To add copy for a new area:
1. Create `src/locales/en/<area>.ts` exporting one named const.
2. Import it in `src/locales/en.ts` and add it to the `en` object — **one line**, which is the whole point: it is the difference between a one-line merge conflict and a thousand-line one.

Both import styles resolve to the same object, so either works at a call site:

```ts
import { en } from '@/locales/en'          // en.wsReminders.x
import { wsReminders } from '@/locales/en/ws-reminders'   // wsReminders.x
```

Prefer the direct module import in new code — it keeps two agents working on two areas out of the same file.

The groups still written inline in `en.ts` are the original single-file copy, kept so existing `en.x` call sites keep working. **Move a group into a module as its screens are touched; do not add to them.** Technical identifiers (cookie names, DNS prefixes, DB filenames) stay under `en.constants`.

When two agents each own half of one area, give them **disjoint sub-keys** and spread both modules onto the same key — this is what `wsAdmin: { ...wsAdminWorkforce, ...wsAdminManage }` does today. Overlapping sub-keys silently lose one agent's copy to the spread order.

### Multi-workspace + the `/me` active workspace

Users can be active in multiple workspaces, and `/me` has **exactly one** selector for which of them is in scope: the top-bar pill in `MeTopbar`, backed by the `vnz_ws` cookie and exposed to every screen through `useWorkspaceScope()` (`src/app/me/workspace-scope.tsx`). Resolution is `?ws=` → cookie → first active membership, validated server-side against real memberships in `src/app/me/layout.tsx`. **Do not add a per-screen workspace picker** — `/me/timeline` had one and it was removed precisely because it could disagree with the pill.

`/me/timeline` is therefore always scoped: it calls **`GET /api/me/ws/[slug]/events`** (member auth + membership check) so `queryWorkspaceEvents()` can attach `matched_by` / `matched_signals` for that workspace only. Its old **All workspaces** option is gone; `GET /api/events` still exists as the unscoped global-history endpoint but has no UI consumer. Do not add `workspace_id` to `presence_events`; keep AND semantics in `lib/signals.ts`.

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
- `employees-list.ts` — the directory read path, split out so a list query can never accidentally decrypt sensitive columns
- `roles.ts` — workspace roles and permission grids; exports `seedSystemRoles`, `getMembershipWithRole`, `listWorkspaceRoles`
- `assets.ts` — `workspace_assets`; soft-deleted so assignment history survives a retired laptop
- `documents.ts` — `employee_documents` metadata **and** `employee_document_blobs`; the one file outside `lib/storage.ts` allowed to see base64. Metadata is soft-deleted, the blob is hard-deleted with it
- `maternity.ts` — `maternity_cases` and the `requested → approved → onleave → returned` stage machine (`canTransition()`); the one backward edge is `approved → requested`. Also owns `case_type` (`'maternity' | 'paternity'`) and its guard `isParentalCaseType()`, which is the ONLY validation on that column — SQLite cannot attach a CHECK to a column added by `ALTER TABLE`, so an unvalidated write is accepted by the database
- `regularizations.ts` — `regularization_requests`; approving one writes an `admin_overrides` row and a *new* `presence_events` row, never an edit to an existing one
- (`src/lib/parental.ts`, not a query file) — parental-leave constants + `isParentalCaseType()`. PURE, because client components import them; a runtime import from `lib/db/queries/*` into a `'use client'` file bundles the SQLite driver for the browser and fails the build
- `parental-extensions.ts` — `parental_leave_extensions`; a member's request to extend an open parental case by UNPAID days. Append-only like `leave_requests`; `computeUnpaidExtensionDays()` lives here and is the ONLY place the day count is derived
- `notifications.ts` — in-app notifications
- `notification-prefs.ts` — per-member category push preferences. **No live caller.** Every category in `lib/notifications/categories.ts` is `memberMutable: false`, so nothing reads or writes this table today; `notify()` still calls in, but only from a branch guarded by that flag. RETAINED, not dead code awaiting deletion — every function resolves through `CATEGORY_DEFS` rather than naming a category, so a future member-mutable category revives it by setting one flag, and deleting it would mean rediscovering two silent traps: SQLite treats NULLs as DISTINCT in a unique index (hence TWO PARTIAL unique indexes, not one plain `UNIQUE (user_id, workspace_id, category)`), and a boolean column is what lets two defaults coexist, because absence can only ever carry one meaning. Storage rule: **a row is an EXPLICIT CHOICE and `muted` is what it chose**; absence means "never touched it" and resolves to `CATEGORY_DEFS[category].defaultOn`. Both directions write a row — un-muting is **not** a DELETE. Never answer "is this muted?" by testing for a row. **The two routes that used to write it — `/api/me/notification-prefs` and `/api/me/ws/[slug]/notification-prefs` — are deleted;** the member's screen now writes `/api/me/presence-prefs` (account ladder) and `/api/me/ws/[slug]/reminder-times` (per-workspace schedule) instead
- `reminders.ts` — the wall-clock reminder pass's reads/writes: the member schedules in `member_reminder_prefs` (one row per `(user_id, workspace_id)`, `'HH:MM'` in the **workspace's** timezone) and the `reminder_log` dedupe. **THE TIME IS THE SWITCH** — there is no enabled/muted column and there must never be one, because a row with `checkin_at = '09:30'` and a hypothetical `enabled = 0` is a question no code could answer. `workspaces.checkin_reminder_at` / `checkout_reminder_at` are VESTIGIAL: still written by `PATCH /api/ws/[slug]`, deliberately not selected here, and surviving only as a pre-filled suggestion on the member's settings screen. Selecting them is the first step back to a delivery fallback, i.e. pushing at everybody
- `presence-prefs.ts` — `member_presence_prefs`, the member-configured session ladder. ACCOUNT-scoped (`user_id` PRIMARY KEY) because `presence_events` carries no `workspace_id` and never will, so one member has ONE open session and there is no workspace to key a ladder on. Three nullable rungs (NULL = that rung off, no row = silent) plus `auto_checkout_after_h`, which is **NOT NULL DEFAULT 12** because auto-checkout is a MECHANIC, not a nudge: an open event corrupts that day's attendance and invariant 4 forbids repairing it by editing. `getPresenceLadderPrefs()` is the bulk read the cron uses; **members with no row are simply absent from it** and every caller must resolve each id it asked about against `DEFAULT_PRESENCE_PREFS`. Shapes and bounds live in the pure `src/lib/presence-ladder.ts` and are only re-exported here

### Document bytes

Never read or write `employee_document_blobs` from a route. Go through `documentStore` in `src/lib/storage.ts` — it is the seam an S3 backend would replace, and it stops working as a seam the moment a caller string-handles base64. Callers hand over and receive `Buffer`. MIME type comes from `sniffMimeType()` (magic bytes), never from the browser-supplied `File.type`, which is attacker-controlled. Bytes leave the server only from a dedicated `.../file` route, never inside a JSON body.

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
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'

interface Props { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const { slug } = await params            // params is a Promise in this Next version
  const ctx = await requireWsAccess(req, slug, Resource.Assets, Action.Read)
  if (!ctx) return forbidden()             // 403 { error: 'Forbidden', code: 'FORBIDDEN' }

  // ctx.workspace.id, ctx.userId, ctx.memberId, ctx.role and
  // ctx.visibleMemberIds are all now verified.
  const data = await getSomethingForWorkspace(ctx.workspace.id)
  return NextResponse.json(data)
}
```

`requireWsAccess` answers "may this role perform this action on this resource?", not "is this person an admin?". It returns `null` for every failure mode — no header, no workspace, inactive membership, permission denied — so the caller cannot accidentally leak which one it was. `Resource` and `Action` are enums, so the compiler rejects a guard naming a resource that does not exist.

Pick the resource that matches the **screen** the route backs, as registered in `src/lib/permissions/screens.ts`. If sidebar visibility and route enforcement disagree, a user gets a tab that 403s.

For pages that need to know *who* is asking in order to decide what to render, rather than to gate one action, use `getWsRole(workspaceId, userId)`.

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
- **`scripts/migrate.js` - the only description of the database. Understand all columns here before adding queries. (`lib/db/schema.ts` no longer exists.)**
- `lib/permissions/catalogue.ts` + `screens.ts` - which resource gates a route and which screen it backs; they must agree
- `lib/ws-access.ts` - the single door to every workspace-admin route
- `proxy.ts` - edge middleware, limited runtime (no Node.js APIs)
- `src/app/globals.css` - the whole design system; a new class goes here, not in a component

---

## What Agents Must Not Do

- Write SQL directly in route files
- Modify `presence_events` rows (immutable after insert, except `note`)
- Delete user/workspace data (soft delete only)
- Store raw WiFi SSIDs (always bcrypt hash)
- Look for `lib/db/schema.ts` — it is deleted; read `scripts/migrate.js`
- Import a RUNTIME value from `lib/db/queries/*` into a `'use client'` component — `import type` only. A value import drags better-sqlite3/libSQL into the browser bundle; put anything both sides need in a pure `src/lib/*.ts` module
- Reintroduce `requireWsAdmin()`, or gate a `/api/ws/[slug]/*` route on membership alone
- Put a shadow on an inline surface (card, input, chip, row, table) — shadows are for overlays only. Add gradients to app UI
- Write a `<style>` block in a component, or an ad-hoc inline style object — add a class to `globals.css`
- Ship a decorative animation without adding its selector to the `prefers-reduced-motion` guard in `globals.css`
- Return document bytes or base64 in a JSON response
- Render a notification category on `/me/settings`. **The two screens do not split one catalogue — they configure different kinds of thing.** `/ws/:slug/settings` holds the whole category catalogue (`approvals`, `announcements`; both workspace-switchable, neither member-mutable); `/me/settings` holds SCHEDULES — reminder times per workspace, the session ladder per account. A locked category rendered disabled only invites someone to throw it and be told no
- Put an on/off toggle beside a member's reminder time or ladder rung. **The value IS the switch and having one set IS the opt-in.** A category is a class of MESSAGE, a schedule is a TIME; a boolean beside a stored time is a second source of truth for one fact — `muted = 0` with no time set is on by one and off by the other, and nothing can arbitrate, because neither is wrong. `member_reminder_prefs` and `member_presence_prefs` have no such column and must never grow one
- Add a second workspace picker beside the `/me` reminder times. They are per workspace — the timezone, working days, holidays and leave that gate them all are — and they read `useWorkspaceScope()` like every other `/me` screen. The ladder is account-level and its copy must keep saying so, or a member of two workspaces looks for it under each
- Read `workspaces.checkin_reminder_at` / `checkout_reminder_at` as the reminder schedule. Vestigial; a delivery fallback to them is exactly the push-at-everybody nag the move to per-member schedules exists to end
- Write a `notifications` row for a reminder or a ladder push. **Both member paths are push-only**; `checkin_reminder` / `checkout_reminder` have left `NotificationType` and the ladder never had one, so the organisation's two categories are the only things that write a feed row
- Fire a ladder rung more than `LADDER_WINDOW_H` (1.5h) past its hour. It is **claimed without being sent** — the dedupe key is written and no push leaves — because after a cron outage every rung of an old event was due at once and landed seconds apart ("I got my 5-hour notification after checkout"). A skipped-but-unclaimed rung is re-evaluated on every tick forever
- Let auto-checkout depend on a notification preference, or make `auto_checkout_after_h` nullable. The mechanic runs first and unconditionally; only the *notice* is conditional, and only on `autoCheckoutEvent()` reporting that it actually closed something
- Decide whether a member's push is muted by testing whether a `notification_prefs` row exists, seed such a row, or un-mute by deleting one — always resolve through `CATEGORY_DEFS`
- Hardcode a user-facing string instead of adding it to a `src/locales/en/` module
- Introduce new npm dependencies without noting it in the PR description
- Change signal matching from AND to OR logic
- Trust userId or workspaceId from request body without JWT verification

---

## Keeping Docs in Sync

**REQUIRED:** Whenever you change code that affects documented behaviour - API routes, auth flow, signal matching logic, plan limits, cookie settings, DB schema, environment variables - you MUST also update the relevant docs:

1. `README.md` - update the affected section
2. `CLAUDE.md` - update invariants, architecture, or key rules if affected
3. `AGENTS.md` - update conventions or patterns if affected
4. `docs/architecture/` - update if the change moves a boundary or a data flow
5. `docs/design/` - **required** for any change to `src/app/globals.css` or `src/components/ui/`: a new token, a new class, a new primitive, a new animation, or a change to touch targets, elevation or status tones

Never let code and docs diverge. Stale docs cause bugs in future AI-assisted sessions because agents rely on them for context.

**What counts as "documented behaviour":**
- Adding/removing/renaming API routes
- Changing HTTP status codes or error codes
- Modifying auth flow (cookies, OTP, JWT)
- Changing signal matching semantics
- Adding DB columns or tables
- Changing plan limits or feature flags
- Adding/removing environment variables
- Adding a design token, class, UI primitive or animation
- Adding a `/ws` screen or a permission resource
