# Venzio - Presence Intelligence Platform

> **Know where your team is. Own where you've been.**

Venzio is a full-stack Next.js application with two PWA surfaces:

- **User side** (`/me/*`) - mobile-first, individuals record their own presence, submit leave, manage their documents
- **Org side** (`/ws/:slug/*`) - desktop-first, an HR/admin surface for presence, employee records, assets, leave, documents and approvals

The org surface is **permission-driven**: every page and every API route is gated by a
resource × action grid, not by an `isAdmin` boolean. See
[Permissions](#permissions---the-org-surface-gate) before touching anything under `/ws`.

---

## Tech Stack

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| Framework  | Next.js 16.1 (App Router, React 19, TypeScript)                            |
| Database   | `better-sqlite3` in local dev → Turso / libSQL (`@libsql/client`) in prod  |
| Auth       | Custom - email + password + OTP, `jose` (JWT) + `bcryptjs`                 |
| Styling    | Tailwind CSS v4 + component classes in `globals.css`, no component library |
| UI kit     | `src/components/ui/` - 25 in-house primitives + 3 hand-rolled SVG charts   |
| Email      | Resend (OTP, consent, ownership transfer)                                  |
| Spreadsheets | `exceljs` (XLSX attendance export, XLSX/CSV imports)                     |
| Icons      | `lucide-react`                                                             |
| Deployment | Vercel; cron via GitHub Actions                                            |

There is **no charting library, no component library, no ORM and no payment integration**.
That is deliberate in every case.

### Hosting note

The production Turso database is hosted in **`aws-ap-south-1` (Mumbai)**. That is not
incidental: `employee_sensitive` stores PAN, Aadhaar and bank account numbers - Indian
statutory identifiers - so data residency matters. They are additionally encrypted at the
field level with AES-256-GCM (`src/lib/encryption.ts`).

---

## Local Development Setup

### 1. Prerequisites

- Node.js 20+
- npm 10+

### 2. Install

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill it in. The minimum for a working local dev
server:

```bash
# Leave TURSO_* UNSET → SQLite at ./venzio.db (this is what you want locally)

# Generate: openssl rand -base64 32
JWT_SECRET=your-random-32-char-secret

# 64-char hex. Employee sensitive fields THROW without it.
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIELD_ENCRYPTION_KEY=<64 hex chars>

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional - without it, OTPs are printed to the server console
RESEND_API_KEY=re_xxxxxxxxxxxx
```

> **⚠️ Never put Turso credentials in `.env.local`.**
> `src/lib/db/index.ts` selects the Turso backend the moment `TURSO_DATABASE_URL` is set,
> and Next.js auto-loads `.env.local`. Putting production credentials there silently points
> `npm run dev` at production. They belong in **`.env.sync.local`**, which only
> `scripts/sync-local-db.js` reads. Both files are gitignored (`*.env*`).

### 4. Migrate

```bash
npm run migrate     # or: node scripts/migrate.js
```

`scripts/migrate.js` is the **single** schema source. On a fresh DB it creates every table;
on an existing DB it runs additive `ALTER TABLE` statements (duplicate-column errors are
swallowed). Re-running is always safe.

### 5. (Optional) pull a production snapshot

```bash
npm run db:sync
```

Reads `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` from `.env.sync.local` (then `.env.local`,
then the shell - shell wins), copies **every** table's schema and rows into a fresh SQLite
file, verifies `integrity_check` and `foreign_key_check`, then swaps it in and keeps a
timestamped backup of the old file.

> This includes `employee_document_blobs`, so a sync pulls real document bytes onto your
> laptop. Override the destination with `LOCAL_DATABASE_PATH=./tmp/prod.db npm run db:sync`
> if you would rather not overwrite `./venzio.db`.

### 6. Run

```bash
npm run dev     # http://localhost:3000
```

---

## Environment Variables Reference

| Variable              | Required    | Description                                                                     |
| --------------------- | ----------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`          | **Yes**     | 32+ char random string. Signs session JWTs, OTP cookies and domain-verify tokens |
| `FIELD_ENCRYPTION_KEY`| **Yes**     | 64-char hex (32 bytes). AES-256-GCM key for PAN / Aadhaar / bank account. Any read or write of `employee_sensitive` throws without it |
| `NEXT_PUBLIC_APP_URL` | **Yes**     | Canonical origin. `http://localhost:3000` in dev, `https://venzio.ai` in prod. Drives canonical links, OG URLs, robots and sitemap |
| `TURSO_DATABASE_URL`  | No (dev)    | Turso/libSQL URL. **Unset → SQLite at `./venzio.db`.** Setting it in `.env.local` points dev at prod |
| `TURSO_AUTH_TOKEN`    | No (dev)    | Turso auth token                                                                |
| `LOCAL_DATABASE_PATH` | No          | Destination SQLite path for `npm run db:sync`. Defaults to `./venzio.db`         |
| `RESEND_API_KEY`      | Recommended | Resend API key. Missing → OTPs are logged to the server console                  |
| `RESEND_FROM_EMAIL`   | No          | From-address override for outbound mail                                          |
| `VAPID_PUBLIC_KEY`    | Push        | Web Push public key - `npx web-push generate-vapid-keys`                         |
| `VAPID_PRIVATE_KEY`   | Push        | Web Push private key (never exposed to the client)                               |
| `VAPID_EMAIL`         | Push        | `mailto:` contact for VAPID registration                                         |
| `CRON_SECRET`         | Push        | Bearer secret for `POST /api/push/cron`. Must match the GitHub Actions secret. **If unset, the cron route returns 401 to everyone** - reminders and auto-checkout silently stop |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                # Root metadata, fonts, PWA meta
│   ├── page.tsx                  # / - marketing landing
│   ├── manifest.ts robots.ts sitemap.ts error.tsx
│   ├── (public)/                 # No session required
│   │   ├── login/                # /login - 9-state auth machine
│   │   ├── join/[slug]/          # Invite / domain-match landing
│   │   ├── consent/[token]/      # Accept or decline from the email link
│   │   ├── for-teams/ for-you/ pricing/ open-source/ privacy/ terms/
│   ├── me/                       # User PWA - session required
│   │   ├── layout.tsx            # MeTopbar + BottomNav (Timeline · Home · Leave)
│   │   ├── page.tsx              # /me - check-in / checkout, today, stats
│   │   ├── timeline/             # /me/timeline - event history
│   │   ├── leave/                # /me/leave - balances, apply, my requests
│   │   ├── documents/            # /me/documents - own document folder
│   │   ├── workspace/            # /me/workspace - today's roster for a workspace
│   │   ├── ws/[slug]/            # /me/ws/:slug - workspace-scoped member home
│   │   ├── orgs/ profile/ settings/ notifications/
│   └── ws/                       # Org PWA - session + org-surface permission
│       ├── page.tsx              # /ws - workspace picker
│       ├── new/                  # /ws/new - create a workspace
│       └── [slug]/
│           ├── layout.tsx        # Resolves role → readableResources → sidebar
│           ├── page.tsx          # Overview
│           ├── employees/        # HR directory + wizard + document folders
│           ├── assets/           # Asset register
│           ├── attendance/       # Day-level attendance table
│           ├── leaves/           # Applied · Maternity · Paternity (types+balances in Settings)
│           ├── holidays/         # Holiday calendar + CSV/XLSX import
│           ├── approvals/        # Leave / regularization / document queue
│           ├── people/           # Membership: invite, roles, consent
│           │   └── [userId]/details/
│           ├── members/[memberId]/
│           ├── insights/ monthly/ reports/
│           ├── roles/            # Permission grid editor
│           └── settings/         # Org · Leave · Balances · Signals · Domains · Billing
├── app/api/                      # ~92 route handlers - see API Reference
├── components/
│   ├── ui/                       # The design system (barrel: index.ts)
│   │   ├── Avatar BottomSheet Button Card Chip DataTable Divider DropdownMenu
│   │   ├── Dropzone EmptyState Field IconButton Input Modal Progress Select
│   │   ├── Skeleton SlideOver SplitBar StageDots StatCard TabBar Textarea
│   │   ├── Toggle WizardSteps
│   │   └── charts/               # AreaChart BarChart DeptBars (hand-rolled SVG)
│   ├── ws/                       # WsSidebar, WsLayoutClient, WsAccountMenu, …
│   ├── user/                     # BottomNav, CheckinButtons, EventCard, MeTopbar, …
│   ├── notifications/ marketing/ shared/
│   └── Hero.tsx Features.tsx FAQ.tsx …   # marketing sections
├── lib/
│   ├── db/
│   │   ├── index.ts              # THE db abstraction (SQLite ↔ libSQL)
│   │   └── queries/              # One file per domain - no raw SQL outside here
│   │       ├── users.ts events.ts workspaces.ts signals.ts stats.ts tokens.ts
│   │       ├── push.ts holidays.ts leaves.ts roles.ts notifications.ts
│   │       ├── employees.ts employees-list.ts documents.ts assets.ts
│   │       ├── maternity.ts regularizations.ts reminders.ts
│   ├── permissions/
│   │   ├── catalogue.ts          # Resource / Action / Scope / SystemRole enums
│   │   ├── screens.ts            # Screen registry - the org sidebar
│   │   ├── can.ts                # can(), readableResources(), normalisePermissions()
│   │   ├── guards.ts             # System-role, catalogue and escalation guards
│   │   ├── ranks.ts              # canManage / canGrant / getRedirectAfterLogin
│   │   ├── system-roles.json     # Seeded grids - read by the app AND migrate.js
│   │   └── system-roles.ts
│   ├── ws-access.ts              # requireWsAccess() · getWsRole() · forbidden()
│   ├── ws-admin.ts               # requireWsMember() only (requireWsAdmin is GONE)
│   ├── storage.ts                # DocumentStore seam + magic-byte MIME sniffing
│   ├── reminders.ts              # Wall-clock check-in/checkout reminder pass
│   ├── approvals.ts              # Unified pending-approvals feed
│   ├── attendance-summary.ts     # Day-level WFO / WFH / leave classification
│   ├── signals.ts                # queryWorkspaceEvents() - signal matching
│   ├── encryption.ts             # AES-256-GCM field encryption
│   ├── api/                      # documents-upload.ts, notifications.ts
│   ├── client/                   # device-info, format-time, presence helpers
│   ├── auth.ts email.ts geo.ts geo-label.ts plans.ts slug.ts password.ts
│   ├── stats.ts timezone.ts timezone-server.ts domain-verify.ts trust.ts
│   ├── midnight.ts parse.ts push.ts push-client.ts session.ts constants.ts
├── locales/
│   ├── en.ts                     # Barrel: composes the modules below + legacy inline copy
│   └── en/                       # me · me-screens · me-settings · marketing
│                                 # documents · ws-overview · ws-people
│                                 # ws-settings · ws-reminders
└── proxy.ts                      # Edge route protection (Next 16 name for middleware)

public/sw.js                      # Service worker - push + notification actions
scripts/
├── migrate.js                    # The ONLY schema definition
└── sync-local-db.js              # Turso → local SQLite snapshot
.github/workflows/push-reminders.yml   # cron '0,30 * * * *' → POST /api/push/cron
docs/architecture/                # HLD + per-flow docs
```

There is **no `src/lib/db/schema.ts`**. It was deleted: it exported a `SCHEMA_SQL` constant
nothing imported, and having a second copy of the schema next to `migrate.js` is exactly the
kind of drift that ships broken databases.

---

## Database

### Tables (28)

Verify with `sqlite3 venzio.db ".tables"`.

**Identity & auth**

| Table             | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `users`           | Accounts - email, password hash, name, timezone, `deleted_at`, `deactivated_at` |
| `otp_codes`       | 6-digit OTPs - purpose, expiry, `attempts`                               |
| `revoked_tokens`  | Invalidated JWT `jti`s, checked on every server-side request             |
| `user_api_tokens` | Personal API tokens; `token_prefix` gives O(1) lookup                    |
| `rate_limit_log`  | Sliding-window limiter (IP-keyed for login, user-keyed for checkin etc.) |
| `push_subscriptions` | Web Push endpoint + keys, per user per device                         |
| `notifications`   | In-app notification feed, per user, optionally workspace-scoped          |

**Presence**

| Table                     | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `presence_events`         | The core table. Check-in **and** checkout GPS / IP / device / trust flags, `location_label`, `scheduled_checkout_at`, `checkout_reason`, `push_reminders_sent`. Never hard-deleted |
| `admin_overrides`         | Additive audit log; may carry `effective_checkout_at`. Never mutates the event |
| `regularization_requests` | Member-raised "I was actually in the office / remote" corrections       |
| `user_stats`              | Pre-computed streak, totals, monthly counts - upserted after check-in   |
| `reminder_log`            | One row per (workspace, user, kind, local date) - the reminder dedupe   |

**Workspace**

| Table                     | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `workspaces`              | slug, name, plan, `display_timezone`, `working_days`, `allow_remote`, `leaves_enabled`, `leave_cutover_date`, `checkin_reminder_at`, `checkout_reminder_at`, `archived_at` |
| `workspace_members`       | User ↔ workspace membership, `role` (FK by key to `workspace_roles`), consent status + token |
| `workspace_roles`         | Per-workspace roles. `permissions` is the JSON grid; `scope`; soft-deleted |
| `workspace_domains`       | Email domains for auto-enrolment                                       |
| `workspace_signal_config` | GPS / IP location configs used for presence matching                   |
| `workspace_holidays`      | Holiday calendar. Soft-deleted; partial unique index on `(workspace_id, name, date)` for active rows |
| `workspace_assets`        | Asset register - laptops, phones, access cards. Status `assigned` / `available` / `repair` / `retired` |

**HR**

| Table                     | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `employees`               | Employee record - personal, contact, emergency contact, employment status |
| `employee_sensitive`      | PAN, Aadhaar, bank account **encrypted** (AES-256-GCM); UAN, passport, IFSC in clear |
| `employment_details`      | Designation, department, work mode, reporting manager, joining / exit dates |
| `employee_documents`      | Document **metadata** only. One row per `(employee, doc_key)` slot. Soft-deleted |
| `employee_document_blobs` | Document **bytes** as base64 TEXT, one row per document. Hard-deleted   |
| `announcement_attachments` | Policy-document **metadata** hung off an announcement. Soft-deleted     |
| `announcement_attachment_blobs` | Those **bytes** as base64 TEXT. Hard-deleted with the metadata     |
| `maternity_cases`         | Parental leave cases, maternity **and** paternity (`case_type`) - `requested` → `approved` → `onleave` → `returned` |

**Leave**

| Table                     | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `workspace_leave_types`   | Per-workspace leave types with accrual frequency + credits. Soft-deleted |
| `leave_requests`          | Immutable once inserted                                                |
| `leave_opening_balances`  | Migrated-in starting balance per (workspace, user, leave type)          |
| `parental_leave_extensions` | Member requests for **unpaid** extra days on an open parental case. Append-only apart from approve/reject |

### Migration

`scripts/migrate.js` is the single migration file and must always produce the latest schema
on both a fresh and an existing database.

- **Fresh DB** - `CREATE TABLE IF NOT EXISTS` creates everything.
- **Existing DB** - additive `ALTER TABLE … ADD COLUMN` statements fill in what's missing;
  duplicate-column errors are caught and skipped.

Adding a column or table means editing `migrate.js` in the same change. It also reads
`src/lib/permissions/system-roles.json` so seeded role grids can never drift from the app's.

```bash
npm run migrate
sqlite3 venzio.db ".tables"
sqlite3 venzio.db ".schema employees"
```

### No raw SQL outside `lib/db/queries/`

Route handlers call query functions. They never call `db.query()` / `db.execute()` directly,
and they never import `better-sqlite3` or `@libsql/client` - only `@/lib/db`.

---

## Permissions - the org surface gate

> `requireWsAdmin()` **no longer exists.** `src/lib/ws-admin.ts` exports only
> `requireWsMember()`, which authenticates an ordinary member for the `/me` surface and
> carries no permission meaning. Re-adding a binary admin gate bypasses the whole model.

### The guard

```ts
import { requireWsAccess, forbidden } from '@/lib/ws-access'
import { Action, Resource } from '@/lib/permissions/catalogue'

const ctx = await requireWsAccess(req, slug, Resource.Employees, Action.Write)
if (!ctx) return forbidden()          // 403 { error: 'Forbidden', code: 'FORBIDDEN' }

// ctx: { workspace, userId, memberId, role, visibleMemberIds }
await updateEmployee(id, ctx.workspace.id, patch)
```

`requireWsAccess(request, slug, resource, action)` returns `AccessContext | null`. It reads
`x-user-id` from the proxy-set header, resolves the slug to a workspace, loads the caller's
membership **and its role row**, and asks `can(role.permissions, resource, action)`. Any
failure - no header, no workspace, inactive membership, missing permission - returns `null`.

`getWsRole(workspaceId, userId)` resolves the caller's role *without* asserting a permission,
for pages that need to know who is asking in order to decide what to render (the `/ws/:slug`
layout does this).

### The catalogue (`src/lib/permissions/catalogue.ts`)

Permissions are a **resource × action grid**. Actions: `read`, `write`, `delete`. Each
resource declares which actions are meaningful for it - anything undeclared does not exist.

| Resource                | Label                | Actions              |
| ----------------------- | -------------------- | -------------------- |
| `dashboard`             | Dashboard            | read                 |
| `analytics`             | Analytics & insights | read                 |
| `activity`              | Activity             | read                 |
| `export`                | Export               | read                 |
| `members`               | Members              | read, write, delete  |
| `employees`             | Employee records     | read, write, delete  |
| `assets`                | Assets               | read, write, delete  |
| `documents`             | Employee documents   | read, write, delete  |
| `holidays`              | Holidays             | read, write, delete  |
| `leaves`                | Leave                | read, write, delete  |
| `approvals`             | Approvals            | read, write          |
| `signals`               | Signal config        | read, write, delete  |
| `domains`               | Domains              | read, write, delete  |
| `settings`              | Workspace settings   | read, write          |
| `members.role`          | Assign roles         | write                |
| `roles`                 | Roles                | read, write, delete  |
| `ownership`             | Ownership & billing  | write, delete        |

`members.role` is split out from `members` on purpose: inviting someone and changing
someone's role are different risk levels.

### The screen registry (`src/lib/permissions/screens.ts`)

The org sidebar is generated, not hard-coded. Each screen names its path, its group, the
resource whose `read` gates it, and an optional workspace feature switch.

| Group         | Screen     | Path          | Gated on             | Feature switch   |
| ------------- | ---------- | ------------- | -------------------- | ---------------- |
| **Workforce** | Overview   | `` (root)     | `dashboard`          | —                |
|               | Employees  | `/employees`  | `employees`          | —                |
|               | Assets     | `/assets`     | `assets`             | —                |
|               | Attendance | `/attendance` | `dashboard`          | —                |
|               | Leave      | `/leaves`     | `leaves`             | `leaves_enabled` |
|               | Holidays   | `/holidays`   | `holidays`           | `leaves_enabled` |
|               | Approvals  | `/approvals`  | `approvals`          | —                |
| **Manage**    | People     | `/people`     | `members`            | —                |
|               | Analytics  | `/insights`   | `analytics`          | —                |
|               | Activity   | `/monthly`    | `activity`           | —                |
|               | Reports    | `/reports`    | `export`             | —                |
|               | Roles      | `/roles`      | `roles`              | —                |
|               | Settings   | `/settings`   | `settings`           | —                |

**`Employees` and `People` are different screens.** `/employees` is the HR directory of
employee *records* (`Resource.Employees`); `/people` is workspace *membership* - invites,
roles, consent (`Resource.Members`). Someone can hold one without the other.

Hiding a tab is a courtesy only. The matching API route enforces the same permission
independently.

Labels live in `en.wsNav.screens`, icons live in `WsSidebar.tsx`. A screen added to the
registry without a label is a build error.

### System roles

Seeded into **every** workspace from `src/lib/permissions/system-roles.json`, the one file
read by both the app (`system-roles.ts`) and `scripts/migrate.js`.

| Key      | Scope  | Grid                                                                         |
| -------- | ------ | ---------------------------------------------------------------------------- |
| `owner`  | `all`  | Everything, including `ownership: [write, delete]`                            |
| `admin`  | `all`  | Everything except `ownership` - cannot transfer, archive or change billing     |
| `member` | `self` | Empty grid - no org surface at all                                            |

System roles are immutable: `guardSystemRole()` rejects any edit or delete. If an owner could
untick `settings:write` on the owner role they would lock every human out permanently.

**The workspace creator is the `owner`, not an `admin`.** `createWorkspace()` calls
`seedSystemRoles()` inside the same transaction as the workspace row. A workspace with no
rows in `workspace_roles` grants *nobody* anything, creator included - so never insert a
workspace by any other path.

### Rank - the subject axis (`ranks.ts`)

`can()` answers "may this role touch this kind of thing?". Rank answers "may this person act
on *that* person?". Both are required.

```
owner 100   ·   admin 50   ·   any custom role 20   ·   member 10
```

- `canManage(actor, target)` - equal rank is allowed (admins can manage each other), but the
  **owner is never manageable by anyone**. Ownership moves only through the OTP-gated
  transfer flow.
- `canGrant(actor, granted)` - `owner` can never be granted here, so no permission tick on
  any grid can make someone the owner.
- `getRedirectAfterLogin()` keys on which workspaces grant *org-surface access*
  (`hasAnyOrgAccess`), not on holding the admin role - a custom role with an empty grid is
  legal and must land on `/me`.

### Escalation guards (`guards.ts`)

`validateGridForSave()` runs, in order:

1. `guardCatalogue()` - reject resources/actions the catalogue doesn't declare, so a
   hand-crafted body fails loudly rather than being silently dropped.
2. `normalisePermissions()` - write/delete implies read; unknown keys dropped; catalogue
   order preserved so stored grids stay diffable.
3. `guardEscalation()` - **you cannot grant a permission you do not hold yourself.**

`guardEscalation()` runs on role *create*, role *edit* **and** role *assignment*
(`PATCH /members/[memberId]/role`). Rank alone is not a ceiling: every custom role shares
rank 20, so rank-only gating would let any custom role with `members.role:write` assign any
other custom role, however powerful.

### Scope

`Scope.Self` means "no org surface at all", not "the org surface filtered to your own rows" -
only the seeded `member` role carries it. Every `/ws` role is `Scope.All`. `/me/*` is
self-only for every role, decided from the session user ID with no role lookup at all. The
roles builder therefore offers no scope choice, and routes set scope server-side rather than
accepting one from the client.

---

## Auth System

| Cookie       | Purpose                     | Expiry  |
| ------------ | --------------------------- | ------- |
| `cm_session` | JWT session (httpOnly)      | 30 days |
| `cm_otp_ok`  | Proof an OTP was verified   | 15 min  |

- **Tokens** - JWT via `jose`, `SameSite=Lax`, `secure` in production. Each carries a unique
  `jti` (UUID).
- **Revocation** - logout inserts the `jti` into `revoked_tokens`.
  `getSessionFromCookies()` checks it on every server-component / route-handler request.
  Edge middleware does signature-only verification (no DB hit).
- **Passwords** - `bcryptjs` cost 12, 8-char minimum enforced server-side on registration
  and on change.
- **OTP** - 6 digits, 10-minute expiry, single-use, 5 attempts per code, **max 3 sends per
  email per 15 minutes**.
- **OTP proof** - after verify, a 15-minute signed `cm_otp_ok` httpOnly cookie is set
  server-side. `POST /api/auth/register` validates that cookie; the client never gets to
  assert `otpVerified: true`.

> **Why `SameSite=Lax` and not `Strict`:** `Strict` caused session loss on PWA cold-opens on
> iOS and Android, because the PWA→browser navigation is treated as cross-origin. `Lax` still
> blocks cross-site POST mutations; only same-site GET navigations carry the cookie.

### Login page - `/login`

A single client state machine with **nine** states (`type Step` in
`src/app/(public)/login/page.tsx`):

| State            | Description                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| `email`          | Enter email - existence checked via `/api/auth/check-email`                     |
| `password`       | Existing user - enter password                                                  |
| `otp`            | New user (or reset flow) - enter the 6-digit code                               |
| `accountType`    | OTP verified - choose Personal or Organisation                                  |
| `personal`       | Name + password + confirm                                                       |
| `org`            | Org name, URL handle (live slug check), optional domain, name + password        |
| `deactivated`    | Soft-deleted account detected - enter password to reactivate                    |
| `forgotPassword` | Enter email to receive a reset code                                             |
| `resetPassword`  | Enter a new password (gated by `cm_otp_ok`)                                     |

Without `RESEND_API_KEY`, OTPs print to the server console:

```
[DEV] OTP for user@example.com: 481923
```

### Post-login routing

Decided by `getRedirectAfterLogin()` over workspaces that grant org-surface access:

| Condition                      | Redirects to |
| ------------------------------ | ------------ |
| Org access in 1 workspace      | `/ws/:slug`  |
| Org access in 2+ workspaces    | `/ws`        |
| No org access anywhere         | `/me`        |

### Route protection - `src/proxy.ts`

Next.js 16 uses `proxy.ts` natively in place of `middleware.ts`. Matcher:
`/me/:path*`, `/ws/:path*`, `/api/:path*`.

| Path                  | Requirement                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `/me/*`               | Valid JWT → else redirect to `/login`                                |
| `/ws/*`               | Valid JWT → else redirect to `/login` (permission checked per-route)  |
| `/api/*`              | Valid JWT → else `401`; sets `x-user-id` / `x-user-email`             |
| `/api/v1/*`           | Skipped - Bearer token handled inside the route handler               |
| Public API routes     | Skipped entirely (list below)                                         |

Public API routes: `/api/auth/login`, `/api/auth/register`, `/api/auth/otp/send`,
`/api/auth/otp/verify`, `/api/auth/logout`, `/api/auth/check-email`,
`/api/auth/reset-password`, `/api/workspace/check-slug`, `/api/me/reactivate`.

---

## Signal Matching

`src/lib/signals.ts → queryWorkspaceEvents(workspaceId, plan, options)` is the core query
behind every admin presence view.

**There are two signal types: `gps` and `ip`.** WiFi SSID matching was removed. The
`wifi_ssid*` columns still exist on `workspace_signal_config` and `presence_events` as dead
weight, and `POST /api/ws/:slug/signals` rejects anything that is not `gps` or `ip`.

1. Apply the plan's history gate to the requested start date.
2. Fetch active member IDs (capped by the plan's `maxUsers`; a single-member query skips the
   cap so a member always sees their own rows).
3. Fetch events in range for those members.
4. Load signal configs + the workspace's override event IDs.
5. **Config-light mode** - no signals configured: every event comes back as `verified`
   (or `override`), with an empty `matched_signals`.
6. **Matching mode** - AND semantics across *configured types*: GPS matches when the event's
   coordinates fall within a configured location's radius (Haversine, default 300 m); IP
   matches on IP-geolocation proximity. Matching all configured types → `verified`; some →
   `partial`; none → `none`.
7. Admin overrides **bypass matching entirely** → `override`.

```
MatchedBy = 'verified' | 'partial' | 'none' | 'override'
```

### Signal badges

| Badge         | Colour     | Meaning                                       |
| ------------- | ---------- | --------------------------------------------- |
| ✓ Verified    | Teal       | `verified` - every configured signal matched  |
| ~ Partial     | Amber      | `partial` - some configured signals matched   |
| Unverified    | Muted grey | `none` - no configured signal matched         |
| Override      | Purple     | `override` - an admin override applies        |

### Day-level attendance

Presence stats are **day-level, not event-level**. Everything that shows WFO / WFH / Leave -
`/me`, attendance, monthly, reports, exports - goes through
`src/lib/attendance-summary.ts`, whose `AttendanceDayStatus` is
`'office' | 'remote' | 'absent' | 'holiday' | 'future'`:

- **office** - at least one event that workspace-local day is `verified` or `override`
- **remote** - events exist that day, but none are verified/overridden
- **absent** - no event exists on a workday
- **holiday** - a `workspace_holidays` row, or a non-working weekday per `working_days`

Multiple events on one day count once, with office taking priority.

---

## Modules

### Employees

`/ws/:slug/employees` - the HR directory, gated on `Resource.Employees`. A multi-step wizard
creates a record spread across three tables: `employees` (personal + contact),
`employment_details` (designation, department, manager, dates), `employee_sensitive`
(PAN / Aadhaar / bank account, encrypted).

Records are soft-deleted (archived) and restorable via
`POST /api/ws/:slug/employees/:id/restore`. Members can self-edit a whitelist of their own
personal fields at `PATCH /api/me/ws/:slug/employee`; employment fields are admin-only.

### Documents

Per-employee document folders, gated on `Resource.Documents`. Storage goes through the
`DocumentStore` seam in `src/lib/storage.ts`.

- **Bytes live in the database as base64 TEXT** (`employee_document_blobs`). That keeps the
  whole product on a single Turso connection with no bucket, no signed URLs and no second
  failure domain. It is a deliberate trade for the current scale - swapping in an S3
  implementation is one new class in `storage.ts` plus a config change, touching no route
  and no query file.
- **Metadata and bytes are separate tables.** `employee_documents` is read on every folder
  view; the blob is read only on an actual download. A join would drag megabytes through
  every list query.
- **2 MB cap**, checked twice: against `File.size` before reading (so a huge upload is
  rejected without buffering) and against the real buffer length after.
- **Magic-byte sniffing, never the client MIME string.** `sniffMimeType()` accepts only
  `%PDF`, the PNG 8-byte signature, and the JPEG `FF D8 FF` prefix → `application/pdf`,
  `image/png`, `image/jpeg`. Trusting `File.type` would let an HTML or SVG payload be stored
  and served back under a benign Content-Type. Anything else is a `415`.
- Both upload surfaces (`/api/ws/.../documents` and `/api/me/ws/:slug/documents`) share one
  parser, `src/lib/api/documents-upload.ts`, so the two can't drift.
- One row per `(workspace, employee, doc_key)` slot, enforced by a partial unique index.
  Re-uploading **replaces** the file on the existing row.
- **Metadata is soft-deleted; the blob is hard-deleted** in the same transaction. A
  soft-deleted blob would be unreachable dead weight.
- Bytes are only ever emitted by the `/file` routes, as a response body, never inside JSON.
- Statuses: `missing` · `pending` · `verified` · `rejected` · `issued`. Admin-uploaded files
  default to `issued` (nothing to verify); employee-uploaded files are `pending` and land in
  the approvals queue.

### Assets

`/ws/:slug/assets` - a register of company property (`workspace_assets`), gated on
`Resource.Assets`. Categories, serial numbers, condition, purchase value; status is
`assigned` / `available` / `repair` / `retired`. Assignment is a separate endpoint
(`POST|DELETE /api/ws/:slug/assets/:id/assign`) targeting an `employee_id`. Soft-deleted.
`GET /api/ws/:slug/assets/export` emits CSV, with every field quoted and leading
`= + - @` neutralised against CSV injection.

### Leave

Admins configure per-workspace leave types with an accrual frequency (`monthly` /
`quarterly`) and credits. Balances are **never stored** - always computed:

```
periods_elapsed = complete calendar months (or quarter-groups) since the member joined
total_accrued   = periods_elapsed × accrual_credits  (+ any leave_opening_balances row)
used_days       = Σ (end_date − start_date + 1) over approved requests of that type
available_days  = max(0, total_accrued − used_days)
```

`leave_requests` rows are immutable once inserted - same principle as `presence_events`.
Opening balances (for workspaces migrating in mid-year) can be bulk-imported from CSV/XLSX
with columns `email`, `leave_type`, `opening_balance`.

The whole Leave and Holidays area is hidden when `workspaces.leaves_enabled` is off,
regardless of permission.

### Parental leave (maternity + paternity)

`maternity_cases`, surfaced as **two tabs** under `/ws/:slug/leaves` and discriminated by
`case_type`. One table, one stage machine, one reminder gate — only the entitlement differs
(`weeks` defaults to 26 for maternity, 2 for paternity). Filed under `Resource.Leaves`
rather than getting its own catalogue resource. A case carries a due date, start/end dates
and a `weeks` count, and moves through `requested → approved → onleave → returned`.
Soft-deleted, and editable and deletable from the tab. An active case of either type
suppresses check-in reminders for that person.

`parental_leave_extensions` lets a member request **unpaid** extra days on an open case.
The day count is computed server-side with `countWorkdays()` against the workspace's working
days and holiday calendar — never sent by the client — and recomputed at approval. Approving
moves the case's `end_date`; it writes no `leave_requests` row and consumes no balance.

### Approvals

`/ws/:slug/approvals`, gated on `Resource.Approvals`. `src/lib/approvals.ts` is the single
source for the pending feed, reused by the Overview widget and the Approvals page so both
always agree. Four kinds:

- `leave` - pending leave requests
- `regularization` - member-raised attendance corrections
- `doc` - employee-uploaded documents awaiting verification
- `extension` - a request for unpaid extra days on an open parental-leave case

**This is the only place a pending item is actioned.** The same rows used to be approvable
from the Attendance screen, a Requests tab on the Leaves screen and an ungated section on the
People page; those are gone. Read-only listings elsewhere (the Applied-leaves tab) stay.

`PATCH /api/ws/:slug/approvals/:kind/:id` actions `leave`, `regularization` and `extension`
(anything else is a 404). Rejection requires a `rejection_reason`. Document verification is a
`PATCH` on the document itself.

### Billing

`/ws/:slug/settings` → **Billing** tab, visible only to roles holding `ownership:write`
(the resource has no `read` action, so `write` is what gates the tab).

**There is no payment integration in this codebase.** The tab reads `workspaces.plan` and
renders the plan's limits from `lib/plans.ts`. "Manage billing" is a deliberate no-op that
opens a modal saying so. Archiving and restoring the workspace live in this tab because they
are gated on the same resource.

### Scheduled reminders

Two independent passes run from `POST /api/push/cron`.

**Pass 1 - event-anchored** (in the route). Iterates open `presence_events`:
milestone pushes at 4, 8, 12, 16, 18, 20 and 22 hours; a warning when
`scheduled_checkout_at` is within 60 minutes, carrying "Extend 4h" and "Checkout Now"
actions; and auto-checkout once that time passes. Check-in schedules auto-checkout at
**T+12h**; `POST /api/checkin/extend` pushes it out **+4h** at a time, up to a hard limit of
24h from check-in. Progress is recorded in `presence_events.push_reminders_sent`.

**Pass 2 - wall-clock** (`src/lib/reminders.ts`). The first pass starts from open events, so
it is structurally incapable of noticing someone who *never checked in*. This pass anchors on
workspaces instead. `workspaces.checkin_reminder_at` / `checkout_reminder_at` hold an `HH:MM`
wall-clock time in the workspace's own timezone; `NULL` means off. Gates, in order:

1. archived workspace → excluded by the query
2. not a working day per `workspaces.working_days` → skip the workspace
3. a `workspace_holidays` date → skip the workspace
4. now is not within `REMINDER_GRACE_MIN` (90 min) after the configured time → skip the kind
5. member on approved leave **or** in an active maternity case → skip the member
6. already reminded today → skip the member

Gate 6 is a `reminder_log` insert protected by a partial unique index, so the insert *is* the
check - two overlapping cron runs cannot both get past it. Each member gets at most one
reminder per kind per local day.

**The workflow runs `0,30 * * * *`, not hourly.** India (UTC+5:30), Iran (+3:30) and parts of
Australia (+9:30 / +10:30) sit on half-hour offsets, so an hourly UTC schedule lands at :30
past their local hour and a 10:00 IST reminder could never fire on time. GitHub Actions cron
is best-effort, which is what the 90-minute grace window absorbs.

---

## Plans

| Plan      | Max users | History   | Locations | Export |
| --------- | --------- | --------- | --------- | ------ |
| `free`    | 10        | 3 months  | 1         | No     |
| `starter` | Unlimited | 12 months | 1         | Yes    |
| `growth`  | Unlimited | 7 years   | 5         | Yes    |

Defined in `src/lib/plans.ts`. The user cap and history window are enforced inside
`queryWorkspaceEvents()` **before** signal matching; the export flag is checked in
`GET /api/ws/:slug/export`.

---

## User PWA - `/me/*`

Session required. One account can hold **multiple** active workspace memberships, each
independent.

`presence_events` rows do **not** carry a `workspace_id` - verification is always computed
*for a chosen workspace*. That chosen workspace comes from one place on this whole surface:
the pill in `MeTopbar`.

**One workspace selector.** The top-bar pill is the single source of truth for the active
workspace. It is backed by the `vnz_ws` cookie (`en.constants.cookieWorkspace`), written from
the browser by `src/app/me/workspace-scope.tsx` and read back on the server by
`resolveActiveWorkspaceSlug()` in `src/app/me/active-workspace.ts`. Resolution order is
`?ws=` → cookie → first active membership, and the server checks the value against the
memberships it just loaded before seeding the provider, so a stale or hand-edited cookie
falls back to a real one. The cookie is deliberately **not** httpOnly - it is a UI
preference, not a credential, and `src/app/me/layout.tsx` is a Server Component that must
read it to paint the pill on first render. No `/me` screen may add a second picker.

Bottom nav is three tabs: **Timeline · Home · Leave**. `/me/orgs`, `/me/profile`,
`/me/settings` and `/me/notifications` are reachable by URL and from the profile sheet in
`MeTopbar`, not as tabs.

| Route              | What it is                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `/me`              | Check-in / checkout, today's events, monthly stat chips, live roster link    |
| `/me/timeline`     | Event history with date filters and inline note editing                     |
| `/me/leave`        | Balances, apply for leave, own request history                              |
| `/me/documents`    | Own document folder - upload, view status, download                         |
| `/me/workspace`    | Today's roster for a selected workspace                                     |
| `/me/ws/[slug]`    | Workspace-scoped member home                                                |
| `/me/orgs`         | Pending consent invites (Accept / Decline) + active memberships (Leave)     |
| `/me/profile`      | Employee record self-service                                                |
| `/me/settings`     | Name, email change, password, API tokens, sign out, deactivate              |
| `/me/notifications`| Notification feed. `?ws=<slug>` = one workspace (the bell); bare = unified  |

**Check-in flow.** `navigator.geolocation.getCurrentPosition()` fires on tap. If denied,
check-in still proceeds with null GPS and a toast explains why. The server writes the
`presence_events` row, kicks off a Nominatim reverse-geocode in the background (stored as
`location_label` - it may stay NULL, which is acceptable, not a bug), schedules auto-checkout
at T+12h, and updates `user_stats`. Rate limit: 10 check-ins per hour per user.

**Checkout collects signals too** - GPS, IP and device info are stored for both ends of an
event, in the `checkout_*` columns.

**Timeline data source.** `/me/timeline` is always scoped to the active workspace and always
calls `GET /api/me/ws/[slug]/events`, which runs `queryWorkspaceEvents()` for that workspace
and the current user only, so the transparency a member sees uses the same AND semantics as
the admin dashboards. It used to carry its own workspace dropdown with an **All workspaces**
option reading the unscoped `GET /api/events`; that selector is gone. The endpoint survives -
it is still the only global-history route - but nothing in the UI calls it.

**Notes are the only editable field on an event.** `DELETE /api/events/:id` returns
`405 NOT_SUPPORTED` - presence data is never deleted.

---

## Org PWA - `/ws/:slug/*`

The layout resolves the caller's role, redirects to `/me` if `hasAnyOrgAccess()` is false
(an empty custom grid is legal), and serialises `readableResources(role.permissions)` to the
client so the sidebar can render without shipping the permission logic to the browser.
A non-existent slug is a 404.

`/ws` itself is always reachable by any authenticated user: active workspaces as cards,
archived ones greyed out but still openable, plus a create button. **One active workspace per
creator** - `POST /api/workspace` returns `403 WORKSPACE_LIMIT_REACHED` beyond that, and
restoring an archived workspace is blocked while another is active.

### Settings tabs

| Tab      | Gated on                | Contents                                                       |
| -------- | ----------------------- | -------------------------------------------------------------- |
| Org      | always (write to edit)  | Name, timezone, working days, remote policy, reminder times     |
| Leave    | `leaves:read`           | Leave types and policies                                        |
| Balances | `leaves:read`           | Opening balances + CSV/XLSX import                              |
| Signals  | `signals:read`          | GPS locations (radius, timezone auto-detected) and IP configs   |
| Domains  | `domains:read`          | Add a domain, view its TXT record, run DNS verification         |
| Billing  | `ownership:write`       | Read-only plan panel; archive / restore                         |

### Domain verification

Admins add e.g. `acme.com`. Venzio generates:

```
Name:  _venzio-verify.acme.com
Value: venzio-verify=<token>
```

The token is deterministic - `HMAC-SHA256("domain-verify:{workspaceId}:{domain}", JWT_SECRET)`,
first 32 hex chars - so no extra column is needed; it is recomputed on each verify request.
`POST /api/ws/:slug/domain/:domainId/verify` resolves the TXT record and marks the domain
verified. Domains already verified by another workspace are rejected with
`409 DOMAIN_CLAIMED`.

**Auto-enrolment:** a user whose email matches a verified domain is added as an active
member on `/join/:slug` without an explicit invite.

### Consent flow

**Email link:**

1. Admin invites `colleague@company.com` from the People page.
2. Consent email goes out with Accept / Decline links to `/consent/:token`.
3. Decline resolves the token and marks the member declined - no login needed.
4. Accept while logged in calls `acceptConsent` and redirects to `/me`.
5. Accept while logged out resolves the workspace slug and redirects to `/login?invite={slug}`.

**In-app** - visiting `/join/:slug`: active → `/me`; `pending_consent` → Accept/Decline
buttons (`POST /api/me/consent`); verified domain match → auto-enrolled; otherwise "Invite
required".

Consent tokens are validated on **three** axes: status must be `pending_consent`, the token
must not be expired, and the logged-in email must match the invited email.

### Ownership transfer

`POST /api/ws/:slug/transfer-ownership`, gated on `ownership:write`. The most destructive
action in a workspace - it hands over full control **and** demotes the caller to a plain
member, with no way back except through the new owner. Two factors, in order:

1. `{ action: 'request', targetMemberId, password }` - re-authenticate with the account
   password (rate-limited, keyed on the actor), then an OTP is emailed. The password gates
   *issuance* of the code, so a hijacked session with inbox access is not enough on its own.
2. `{ action: 'confirm', targetMemberId, code }` - validate the OTP, then swap roles
   (owner → member, target → owner).

`targetMemberId` is the `workspace_members.id` record ID, not a `user_id`. Admins are valid
targets; the current owner and yourself are not.

---

## API Reference

All routes return JSON. Errors are always:

```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

Workspace-admin routes return `403 { "error": "Forbidden", "code": "FORBIDDEN" }` from
`forbidden()` when `requireWsAccess()` returns null.

### Auth - public

| Method | Route                      | Description                                     |
| ------ | -------------------------- | ----------------------------------------------- |
| POST   | `/api/auth/check-email`    | `{ email }` → `{ exists }`                      |
| POST   | `/api/auth/login`          | Email check, or password verify. IP rate-limited: 10 attempts / 15 min |
| POST   | `/api/auth/otp/send`       | Send a 6-digit OTP. Max 3 per email / 15 min    |
| POST   | `/api/auth/otp/verify`     | Verify OTP → sets `cm_otp_ok`                   |
| POST   | `/api/auth/register`       | Create account (personal or org). Requires `cm_otp_ok` |
| POST   | `/api/auth/reset-password` | Reset password. Requires `cm_otp_ok`            |
| POST   | `/api/auth/logout`         | Revoke `jti`, clear cookie                      |

```jsonc
// POST /api/auth/login  (step 2)
{ "email": "user@example.com", "password": "…" }
// 200 - also sets cm_session
{ "user": { "id": "…", "email": "…", "fullName": "…" }, "redirect": "/ws/acme" }
// 401
{ "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }
```

```jsonc
// POST /api/auth/register  (org)
{
  "email": "jane@acme.com", "fullName": "Jane Doe", "password": "…",
  "accountType": "org", "orgName": "Acme Corp", "orgSlug": "acme-corp",
  "orgDomain": "acme.com"
}
```

### Presence - session

| Method | Route                   | Description                                                    |
| ------ | ----------------------- | -------------------------------------------------------------- |
| POST   | `/api/checkin`          | Create a presence event. 10 / hour / user. Schedules auto-checkout at T+12h |
| POST   | `/api/checkin/checkout` | Close the open event; stores checkout GPS / IP / label          |
| POST   | `/api/checkin/extend`   | Push `scheduled_checkout_at` out 4h, capped at 24h from check-in |
| GET    | `/api/checkin/status`   | `{ state: 'checked_in' \| 'checked_out', activeEvent }`         |
| GET    | `/api/events`           | Own events, paginated + date-filtered. Never accepts a `userId` |
| PATCH  | `/api/events/[id]`      | Edit the note - the only mutable field                          |
| DELETE | `/api/events/[id]`      | Always `405 NOT_SUPPORTED`                                      |

### Account - `/api/me`

| Method      | Route                             | Description                                        |
| ----------- | --------------------------------- | -------------------------------------------------- |
| GET/PATCH/DELETE | `/api/me`                    | Profile + active workspaces · rename · deactivate  |
| POST        | `/api/me/password`                | Change password (verifies the current one)         |
| POST        | `/api/me/email`                   | 2-step change: `{newEmail}` → OTP → `{newEmail, code}` |
| PATCH       | `/api/me/timezone`                | Report/confirm the browser IANA timezone           |
| POST        | `/api/me/reactivate`              | Reactivate a deactivated account (public route)    |
| POST        | `/api/me/consent`                 | Accept / decline a workspace invite                |
| DELETE      | `/api/me/workspaces/[workspaceId]`| Leave a workspace                                  |
| GET         | `/api/me/notifications`           | Notification feed                                  |
| PATCH       | `/api/me/notifications/read`      | Mark read                                          |
| GET         | `/api/me/notifications/unread-count` | Badge count                                     |

### Member ↔ workspace - `/api/me/ws/[slug]/*`

All guarded by `requireWsMember()` and scoped to the session user. No permission check -
`/me` is self-only for every role.

| Method | Route                                    | Description                                          |
| ------ | ---------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/me/ws/[slug]/today`                | Today's roster + `{ id, name, slug }` + `viewerRole`  |
| GET    | `/api/me/ws/[slug]/counts`               | `{ present, visited, notIn, total }`                  |
| GET    | `/api/me/ws/[slug]/events`               | Own events in range **with** workspace `matched_by`   |
| GET    | `/api/me/ws/[slug]/holidays`             | Holiday list (`?year=`, defaults to current year)     |
| GET    | `/api/me/ws/[slug]/leave-types`          | Leave types with the caller's `available_days`        |
| POST   | `/api/me/ws/[slug]/leave`                | Submit leave. `400 INSUFFICIENT_BALANCE` if over      |
| GET    | `/api/me/ws/[slug]/leave-requests`       | Own leave history                                     |
| GET    | `/api/me/ws/[slug]/leave-requests/today` | Who is on leave today                                 |
| GET/POST | `/api/me/ws/[slug]/regularizations`     | Own corrections. POST rate-limited 10 / hour          |
| GET/PATCH | `/api/me/ws/[slug]/employee`           | Own employee record; self-editable fields only        |
| GET/POST | `/api/me/ws/[slug]/documents`           | Own folder · multipart upload (2 MB, sniffed MIME)    |
| GET    | `/api/me/ws/[slug]/documents/[docId]/file` | Download own document bytes                         |
| GET    | `/api/me/ws/[slug]/notifications`        | Feed + `unread_count` for this workspace only        |
| PATCH  | `/api/me/ws/[slug]/notifications/read`   | Mark read in this workspace. Body `{ ids? }`, all if omitted |
| GET    | `/api/me/ws/[slug]/notifications/unread-count` | `{ count }` - the `/me` bell's 30s poll target |

### Workspace creation

| Method | Route                       | Auth | Description                                     |
| ------ | --------------------------- | ---- | ----------------------------------------------- |
| GET    | `/api/workspace`            | Session | Workspaces where the caller has org access   |
| POST   | `/api/workspace`            | Session | Create one. `403 WORKSPACE_LIMIT_REACHED` past 1 |
| POST   | `/api/workspace/check-slug` | None | `{ slug }` → `{ available }`                    |

### Workspace admin - `/api/ws/[slug]/*`

Every row is gated by `requireWsAccess(req, slug, Resource, Action)`.

| Method | Route                              | Resource : Action        |
| ------ | ---------------------------------- | ------------------------ |
| GET    | `/api/ws/[slug]`                   | `settings:read`          |
| PATCH  | `/api/ws/[slug]`                   | `settings:write` — `name`, `displayTimezone`, `allowRemote`, `leavesEnabled`, `workingDays` (0–6), `leaveCutoverDate`, `checkinReminderAt` / `checkoutReminderAt` (`HH:MM`; `null` or `""` turns it off; anything else is a 400) |
| GET    | `/api/ws/[slug]/dashboard`         | `dashboard:read` — today's roster, grouped and filterable |
| GET    | `/api/ws/[slug]/realtime`          | `dashboard:read` — live presence strip |
| GET    | `/api/ws/[slug]/overview`          | `dashboard:read` — Overview page payload |
| GET    | `/api/ws/[slug]/analytics`         | `analytics:read` — per-member date-range analytics |
| GET    | `/api/ws/[slug]/insights`          | `analytics:read` — time-bucketed check-in data |
| GET    | `/api/ws/[slug]/monthly`           | `activity:read` — `?year=&month=`, per-day status per member |
| GET    | `/api/ws/[slug]/export`            | `export:read` — XLSX attendance workbook; `403` when the plan has no export |
| GET    | `/api/ws/[slug]/approvals`         | `approvals:read` — unified pending feed |
| PATCH  | `/api/ws/[slug]/approvals/[kind]/[id]` | `approvals:write` — `kind` ∈ `leave` \| `regularization`; body `{ action: 'approve'\|'reject', rejection_reason? }` |
| GET    | `/api/ws/[slug]/members`           | `members:read` — all statuses; `limit`/`offset`, `nextOffset` |
| POST   | `/api/ws/[slug]/members`           | `members:write` — invite; `409 ALREADY_MEMBER` |
| DELETE | `/api/ws/[slug]/members/[memberId]`| `members:delete` — plus `canManage()` rank check |
| GET    | `/api/ws/[slug]/members/[memberId]/timeline` | `members:read` — page size 20, `pagination.nextOffset` |
| PATCH  | `/api/ws/[slug]/members/[memberId]/role` | `members.role:write` — plus `canManage`, `canGrant` and `guardEscalation` |
| GET/POST/PATCH | `/api/ws/[slug]/members/[memberId]/employee` | `employees:read` / `employees:write` |
| GET/PUT | `/api/ws/[slug]/members/[memberId]/leave-balances` | `leaves:read` / `leaves:write` |
| GET    | `/api/ws/[slug]/employees`         | `employees:read` |
| POST   | `/api/ws/[slug]/employees`         | `employees:write` |
| GET    | `/api/ws/[slug]/employees/[id]`    | `employees:read`, or `requireWsMember` for one's own record |
| PATCH  | `/api/ws/[slug]/employees/[id]`    | `employees:write` |
| DELETE | `/api/ws/[slug]/employees/[id]`    | `employees:delete` — archive |
| POST   | `/api/ws/[slug]/employees/[id]/restore` | `employees:write` |
| GET    | `/api/ws/[slug]/employees/[id]/documents` | `documents:read` — metadata only |
| POST   | `/api/ws/[slug]/employees/[id]/documents` | `documents:write` — multipart `file`, `doc_key`, `name?`, `owner?` |
| PATCH  | `/api/ws/[slug]/employees/[id]/documents/[docId]` | `documents:write` — `{ status: 'verified'\|'rejected', reject_reason? }` and/or `{ name }` |
| DELETE | `/api/ws/[slug]/employees/[id]/documents/[docId]` | `documents:delete` — soft-delete row, hard-delete blob |
| GET    | `/api/ws/[slug]/employees/[id]/documents/[docId]/file` | `documents:read` — the only route that emits bytes |
| GET    | `/api/ws/[slug]/assets`            | `assets:read` — `?category=`, `?status=` |
| POST   | `/api/ws/[slug]/assets`            | `assets:write` |
| PATCH  | `/api/ws/[slug]/assets/[id]`       | `assets:write` |
| DELETE | `/api/ws/[slug]/assets/[id]`       | `assets:delete` |
| POST   | `/api/ws/[slug]/assets/[id]/assign`| `assets:write` — `{ employee_id }` |
| DELETE | `/api/ws/[slug]/assets/[id]/assign`| `assets:write` — return to the pool |
| GET    | `/api/ws/[slug]/assets/export`     | `assets:read` — CSV |
| GET    | `/api/ws/[slug]/holidays`          | `holidays:read` — `?year=` |
| POST   | `/api/ws/[slug]/holidays`          | `holidays:write` — JSON creates one; multipart `file` bulk-imports CSV/XLSX (≤ 2 MB) |
| PATCH  | `/api/ws/[slug]/holidays/[id]`     | `holidays:write` |
| DELETE | `/api/ws/[slug]/holidays/[id]`     | `holidays:delete` — soft |
| GET    | `/api/ws/[slug]/leaves`            | `leaves:read` |
| PATCH  | `/api/ws/[slug]/leaves/[id]`       | `leaves:write` |
| GET    | `/api/ws/[slug]/leave-types`       | `leaves:read` |
| POST   | `/api/ws/[slug]/leave-types`       | `leaves:write` — `{ name, accrual_frequency, accrual_credits }` |
| DELETE | `/api/ws/[slug]/leave-types/[id]`  | `leaves:delete` — soft; existing requests unaffected |
| GET    | `/api/ws/[slug]/leave-balances`    | `leaves:read` |
| POST   | `/api/ws/[slug]/leave-balances/import` | `leaves:write` — multipart CSV/XLSX: `email`, `leave_type`, `opening_balance` |
| GET    | `/api/ws/[slug]/maternity`         | `leaves:read` |
| POST   | `/api/ws/[slug]/maternity`         | `leaves:write` |
| PATCH  | `/api/ws/[slug]/maternity/[id]`    | `leaves:write` — edit dates/notes and/or advance one stage |
| DELETE | `/api/ws/[slug]/maternity/[id]`    | `leaves:delete` |
| GET    | `/api/ws/[slug]/roles`             | `roles:read` — every role with its grid, plus the catalogue |
| POST   | `/api/ws/[slug]/roles`             | `roles:write` |
| PUT    | `/api/ws/[slug]/roles/[id]`        | `roles:write` — replaces the whole grid atomically |
| DELETE | `/api/ws/[slug]/roles/[id]`        | `roles:delete` |
| GET    | `/api/ws/[slug]/signals`           | `signals:read` |
| POST   | `/api/ws/[slug]/signals`           | `signals:write` — `signal_type` must be `gps` or `ip` |
| DELETE | `/api/ws/[slug]/signals/[signalId]`| `signals:delete` |
| GET    | `/api/ws/[slug]/domain`            | `domains:read` — includes the TXT token while unverified |
| POST   | `/api/ws/[slug]/domain`            | `domains:write` |
| DELETE | `/api/ws/[slug]/domain/[domainId]` | `domains:delete` |
| POST   | `/api/ws/[slug]/domain/[domainId]/verify` | `domains:write` — resolve DNS TXT |
| POST   | `/api/ws/[slug]/archive`           | `ownership:write` — soft-archive |
| POST   | `/api/ws/[slug]/restore`           | `ownership:write` — blocked if another workspace is active |
| POST   | `/api/ws/[slug]/transfer-ownership`| `ownership:write` — password + OTP, two steps |
| GET    | `/api/ws/[slug]/notifications`     | `requireWsMember` |
| PATCH  | `/api/ws/[slug]/notifications/read`| `requireWsMember` |
| GET    | `/api/ws/[slug]/notifications/unread-count` | `requireWsMember` |

### Tokens, push and the public API

| Method | Route                          | Auth   | Description                                       |
| ------ | ------------------------------ | ------ | ------------------------------------------------- |
| GET    | `/api/tokens`                  | Session| List tokens (never the secret)                    |
| POST   | `/api/tokens`                  | Session| Create; the plain token is returned exactly once   |
| DELETE | `/api/tokens/[id]`             | Session| Revoke                                            |
| POST   | `/api/v1/checkin`              | Bearer | Programmatic check-in. Looks the token up by its 8-char `token_prefix` (O(1)), then bcrypt-compares; the user must still be active |
| POST   | `/api/push/subscribe`          | Session| Register a Web Push subscription                  |
| DELETE | `/api/push/subscribe`          | Session| Remove one                                        |
| GET    | `/api/push/vapid-public-key`   | Session| VAPID public key for the client                   |
| POST   | `/api/push/cron`               | `Authorization: Bearer $CRON_SECRET` | Both reminder passes + auto-checkout. `401` if `CRON_SECRET` is unset |

---

## Design System

CSS variables in `src/app/globals.css`:

| Variable           | Value                        | Use                                  |
| ------------------ | ---------------------------- | ------------------------------------ |
| `--brand`          | `#1d9e75`                    | Primary buttons, links, focus         |
| `--brand-hover`    | `#157a56`                    | Hover / pressed                       |
| `--navy`           | `#0a2318`                    | Headings, dark text                   |
| `--teal`           | `#00D4AA`                    | Verified / present                    |
| `--amber`          | `#F59E0B`                    | Partial match, warnings               |
| `--danger`         | `#EF4444`                    | Errors, destructive                   |
| `--info`           | `#2563EB`                    | Informational                         |
| `--surface-0`      | `#FFFFFF`                    | Card backgrounds                      |
| `--surface-1`      | `#f0faf5`                    | Page backgrounds                      |
| `--surface-2`      | `#e4f5ec`                    | Input backgrounds                     |
| `--border`         | `rgba(29,158,117,0.18)`      | All borders                           |
| `--header-bg`      | `#0d2118`                    | App header / PWA theme colour         |
| `--radius-sm/md/lg/xl` | `6 / 10 / 16 / 22 px`    | Corner radii                          |
| `--shadow-sm/md`   | subtle                       | **Overlays only** - never inline cards |
| `--ease-out/inout/spring/drawer` | cubic-beziers  | Motion                                |

Fonts (Google Fonts, imported at the top of `globals.css`):

- **Headings** - Playfair Display (700, 900, + italics)
- **Body** - Plus Jakarta Sans (300–800)
- **Code / timestamps** - JetBrains Mono (400–700)

Rules:

- Borders, not drop shadows, on inline surfaces. Elevation is reserved for overlays.
- No gradients - flat fills.
- Minimum touch target 44px.
- Skeleton loaders for async states, never spinners.
- Reach for `@/components/ui` before writing an inline `style` object or re-implementing a
  modal, chip or table. `globals.css` owns how those primitives look; the components own
  behaviour and accessibility.
- Marketing pages under `src/app/(public)` keep their own Tailwind-utility styling for
  layout, but still use the UI layer for controls - `/login` is built on
  `Field` / `Input` / `Button` / `Card`.

### Copy

All user-visible English lives in `src/locales/en.ts`, which composes per-area modules from
`src/locales/en/`: `me`, `me-screens`, `me-settings`, `marketing`, `documents` (also exports
`assets` and `maternity`), `ws-overview`, `ws-people`, `ws-settings`, `ws-reminders`.
New copy belongs in a module. Both `en.me.x` and a direct
`import { me } from '@/locales/en/me'` resolve to the same object. `en.constants` holds
technical identifiers (cookie names, DNS prefixes, the DB filename).

---

## PWA & Push

Installable on mobile and desktop, with **two** manifests so the user app and the admin app
can be installed side by side:

- `src/app/manifest.ts` → `/manifest.webmanifest`
- `public/manifest-me.json` (user), `public/manifest-ws.json` (org, linked from the
  `/ws/[slug]` layout with `theme-color: #0d2118`)

`public/sw.js` handles push display and notification click actions
(Extend 4h · Checkout Now). `<meta name="apple-mobile-web-app-capable">` is set through
`appleWebApp` metadata so iOS runs it full-screen from the home screen.

One-time VAPID setup:

```bash
npx web-push generate-vapid-keys
```

---

## Marketing Site & SEO

Static Server Components sharing `MarketingNav` and `MarketingFooter`.

| Page        | Route          | Contents                                                                    |
| ----------- | -------------- | --------------------------------------------------------------------------- |
| Landing     | `/`            | Hero, industries, for-orgs / for-individuals, how it works, pricing preview  |
| For Teams   | `/for-teams`   | Team types, multi-signal verification, setup walkthrough, CTA                |
| For You     | `/for-you`     | Feature cards, "works with any employer", plain-language privacy             |
| Pricing     | `/pricing`     | Three plan cards, comparison table, FAQ                                     |
| Open Source | `/open-source` | What's open, what's hosted, self-host guide                                 |
| Privacy     | `/privacy`     | Data table, visibility, retention, consent model, rights, security          |
| Terms       | `/terms`       | Acceptable use, admin responsibilities, signal-accuracy disclaimer, liability |

- Metadata: `src/app/layout.tsx`; crawler rules: `src/app/robots.ts`; sitemap:
  `src/app/sitemap.ts`.
- **Indexable:** `/`, `/for-teams`, `/for-you`, `/pricing`, `/open-source`, `/privacy`,
  `/terms`.
- **Not indexable:** `/login`, `/join/*`, `/consent/*`, `/me/*`, `/ws/*`, `/api/*`.
- Set `NEXT_PUBLIC_APP_URL=https://venzio.ai` in production or every canonical link, OG URL,
  robots rule and sitemap entry points at localhost.

---

## Security Properties

| Concern                      | Mechanism                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session auth**             | JWT HS256, 30-day expiry, unique `jti`, `httpOnly; SameSite=Lax`, `secure` in production                                                        |
| **Logout invalidation**      | `jti` → `revoked_tokens`; checked by `getSessionFromCookies()` on every server-component and route-handler request                              |
| **CSRF**                     | `SameSite=Lax` blocks cross-site POSTs. `Strict` is not used - it broke PWA cold-open sessions on iOS/Android                                    |
| **User ID never from client**| Always `x-user-id`, set by `proxy.ts` from the verified JWT. Never read from a body or query param                                              |
| **Workspace scoping**        | `requireWsAccess()` resolves slug → verified `workspace.id`; every query carries `AND workspace_id = ?`. `markDomainVerified`, `deleteSignalConfig`, document and asset queries all scope in the WHERE clause |
| **Privilege escalation**     | `guardEscalation()` on role create, role edit **and** role assignment - you cannot grant what you do not hold. `guardSystemRole()` makes the three seeded roles immutable |
| **Rank abuse**               | `canManage()` / `canGrant()` on top of permissions. The owner is unmanageable; `owner` can never be granted through the roles UI                 |
| **Ownership transfer**       | Password re-auth (rate-limited) gates OTP issuance; the OTP gates the swap. Two factors, not one                                                 |
| **Password storage**         | bcrypt cost 12, 8-char minimum enforced server-side on both registration and change                                                              |
| **Sensitive HR fields**      | PAN, Aadhaar, bank account AES-256-GCM encrypted at the field level (`iv:authTag:ciphertext`). Audit logs never carry decrypted values           |
| **Document uploads**         | 2 MB cap checked before and after buffering; MIME decided by magic bytes, never `File.type`; `doc_key` matched against `^[a-z0-9_]{1,64}$`; bytes served only as a response body |
| **CSV injection**            | Every asset-export field is quoted and a leading `= + - @` is neutralised                                                                       |
| **OTP brute force**          | 5 attempts per code; max 3 sends per email per 15 minutes                                                                                       |
| **Rate limiting**            | `rate_limit_log`: login 10 / 15 min per IP; check-in 10 / hour per user; regularization 10 / hour per user; ownership password attempts per actor |
| **API token lookup**         | `token_prefix` (first 8 chars) gives an O(1) indexed lookup before the bcrypt compare - never skipped                                            |
| **Consent token hijacking**  | Three checks: status `pending_consent`, token not expired, logged-in email matches the invited email                                             |
| **Domain uniqueness**        | A domain verified by another workspace is rejected with `409 DOMAIN_CLAIMED`                                                                    |
| **Event ownership**          | `getEventByIdForUser(eventId, userId)` enforces `user_id = ?` in SQL, so no caller can skip it                                                   |
| **Reserved slugs**           | Blocked at `validateSlug()`, shared by check-slug, register and workspace creation                                                               |
| **Immutability**             | `presence_events` and `leave_requests` are never deleted or rewritten. Admin corrections live in `admin_overrides`; notes are the only editable event field |
| **Soft delete**              | `users.deleted_at`, `workspaces.archived_at`, `employees.deleted_at`, roles, holidays, leave types, assets, document metadata. Active queries filter `deleted_at IS NULL` |
| **Cron endpoint**            | `POST /api/push/cron` requires `Authorization: Bearer $CRON_SECRET`; an unset secret returns 401 to everyone                                     |

---

## What NOT to Do

- Never call `db.query()` / `db.execute()` outside `lib/db/queries/`
- Never import `better-sqlite3` or `@libsql/client` outside `lib/db/index.ts`
- Never re-introduce `requireWsAdmin()` or any binary admin gate on `/ws` routes
- Never accept `userId`, `workspaceId` or a permission scope from a request body
- Never trust `otpVerified: true` or a client-supplied `File.type`
- Never delete `presence_events` or `leave_requests` rows
- Never store a raw WiFi SSID (the feature is gone; the columns are dead)
- Never let base64 document bytes escape `storage.ts` and `db/queries/documents.ts`
- Never write a second copy of the seeded role grids - `system-roles.json` is the only one
- Never add a drop shadow to an inline card, or a gradient anywhere
- Never use a spinner where a skeleton will do
- Never put Turso credentials in `.env.local`

---

## Further Reading

- `CLAUDE.md` / `AGENTS.md` - working agreements and invariants for agents
- `docs/architecture/` - HLD plus per-flow docs (auth, check-in, signal matching, workspace,
  notifications)
- `docs/design/` - tokens, typography, primitives, motion, shells, status chips, accessibility
- `CONTRIBUTING.md` - contribution guide
