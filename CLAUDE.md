# Venzio - CLAUDE.md

## Product Overview

Venzio is a **presence intelligence platform**. Two PWA surfaces:
- `/me/*` - mobile-first, individuals record their own presence
- `/ws/:slug/*` - desktop-first, org admins query presence data

**Core USP:** Multi-signal presence verification (AND, not OR). When a workspace has GPS + WiFi + IP signals configured, ALL must match for a check-in to count as verified. This makes faking presence extremely difficult.

**Multi-workspace users:** One account can hold multiple active workspace memberships. `presence_events` rows do not store `workspace_id`; verification is always computed for a chosen workspace. On **`/me/timeline`**, the default **All workspaces** view uses `GET /api/events` (global history, no per-workspace `matched_by`). Selecting a workspace uses `GET /api/me/ws/[slug]/events`, which calls `queryWorkspaceEvents()` for that workspace and the current user so transparency matches admin-side AND semantics.

---

## Non-Negotiable Principles

### 1. No raw SQL in routes
All DB access goes through `lib/db/queries/`. Route handlers call query functions - never `db.query()` directly.

### 2. Server validates everything
The client sends data. The server decides truth. Never trust:
- `userId` from request body (always from JWT via `getServerUser()`)
- `workspaceId` from URL without verifying admin membership
- `otpVerified: true` from client (always verify `cm_otp_ok` cookie server-side)

### 3. All mutations scoped by workspace_id at DB level
Every query that touches workspace data must include `AND workspace_id = ?`. No exceptions. Use `requireWsAdmin()` to resolve slug → verified workspace ID before any query.

### 4. Event data is immutable
`presence_events` rows are never deleted or modified. Notes are the only editable field on a user's event. Admin corrections live in `admin_overrides`, not in the event itself.

### 5. Soft deletes everywhere
`users.deleted_at`, `workspaces.archived_at`. Never hard-delete user or workspace data. Queries always filter `WHERE deleted_at IS NULL`.

---

## Signal Matching - Core Logic

**AND semantics, not OR.** If a workspace has configured multiple signal types, an event is considered "verified" only if it matches ALL configured signal types.

```
Signal types: GPS, WiFi, IP
If workspace has [GPS, WiFi] configured:
  → event must match GPS AND WiFi to be verified
  → matching only GPS = unverified
  → matching nothing = not counted at all

Config-light mode (no signals configured):
  → all events from active members pass through
```

`MatchedBy` values: `'verified'` (all configured signals matched) | `'partial'` (some matched) | `'none'` (no signals matched) | `'override'` (admin override bypassed matching)

Admin overrides (`admin_overrides` table) bypass signal matching entirely. Never apply signal logic to overridden events.

Attendance stats are day-level, not event-level. Use `src/lib/attendance-summary.ts` anywhere WFO/WFH/Leave or office/remote/absent days are shown:
- WFO/office: at least one event that day has `matched_by: 'verified' | 'override'`
- WFH/remote: events exist that day, but none are verified/overridden
- Leave/absent: no event exists for that workspace-local workday
- Multiple events on one day count once, with WFO taking priority over WFH

### Trust signals (collected on both check-in AND checkout)
1. GPS (lat/lng + accuracy)
2. WiFi SSID (bcrypt-hashed - never store raw SSID)
3. IP geolocation (ip-api.com)
4. Device info + timezone

---

## Holiday Calendar

Workspace admins manage a per-workspace holiday list (`workspace_holidays` table). Holidays are soft-deleted (`deleted_at`), always scoped by `workspace_id`. At the database layer, active rows have a partial unique index on `(workspace_id, name, date)` where `deleted_at IS NULL`, so concurrent inserts cannot duplicate the same holiday.

### Admin API (`/api/ws/[slug]/holidays`)
- `GET ?year=YYYY` — list holidays for the given year; omit `year` for all
- `POST` JSON `{ name, date, description? }` — create a single holiday (`date` is `YYYY-MM-DD`)
- `POST` multipart `file` — bulk import from CSV or XLSX (≤ 2 MB); upserts by date (one holiday per date)
- `PATCH /[id]` — partial update; at least one of `name`, `date`, `description` required
- `DELETE /[id]` — soft delete; sets `deleted_at`

Duplicate guard: `(name, date)` must be unique per workspace. Returns `409 DUPLICATE` on collision.

### Member API (`/api/me/ws/[slug]/holidays`)
- `GET ?year=YYYY` — read-only; authenticated workspace members only; defaults to current year

### Import file format
Columns (case-insensitive): `name` (required), `date` (required, `YYYY-MM-DD`), `description` (optional).
Rows with a missing/invalid name or date are skipped and returned in the `errors` array; valid rows are always upserted.

---

## Leave System

Workspace admins configure per-workspace leave types (`workspace_leave_types` table). Employees submit leave requests (`leave_requests` table) from `/me/ws/[slug]`. Submissions are instantly `approved` — no approval workflow.

### Tables
- `workspace_leave_types`: `id, workspace_id, name, accrual_frequency ('monthly'|'quarterly'), accrual_credits, created_at, deleted_at` — soft-deleted, unique `(workspace_id, name) WHERE deleted_at IS NULL`
- `leave_requests`: `id, workspace_id, user_id, leave_type_id, start_date, end_date, reason, status DEFAULT 'approved', created_at` — immutable after insert

### Balance computation (no stored balance — always computed)
```
periods_elapsed = complete calendar months (or quarter-groups) since member.added_at
total_accrued   = periods_elapsed × accrual_credits
used_days       = SUM(end_date − start_date + 1) for approved requests of this type
available_days  = max(0, total_accrued − used_days)
```
Logic lives in `lib/db/queries/leaves.ts → getLeaveTypesWithBalance()`. Uses calendar month arithmetic (not day approximations).

### Admin API (`/api/ws/[slug]/leave-types`)
- `GET` — list active leave types
- `POST` JSON `{ name, accrual_frequency, accrual_credits }` — create
- `DELETE /[id]` — soft-delete; existing requests unaffected

### Employee API
- `GET /api/me/ws/[slug]/leave-types` — list types with `available_days` for current user
- `POST /api/me/ws/[slug]/leave` JSON `{ leave_type_id, start_date, end_date, reason? }` — submit; returns `400 INSUFFICIENT_BALANCE` if requested days exceed balance

### Leave requests are immutable
Never modify or delete `leave_requests` rows. Same principle as `presence_events`.

---

## Database Patterns

### DB abstraction
Always use `lib/db/index.ts` - never import `better-sqlite3` or `@libsql/client` directly.

```ts
import { db } from '@/lib/db'
// db.query(), db.queryOne(), db.execute(), db.transaction()
```

### Query file location
`lib/db/queries/<domain>.ts` - one file per domain:
- `users.ts` - user accounts
- `events.ts` - presence events
- `workspaces.ts` - workspaces + members + overrides
- `signals.ts` - workspace signal configs
- `stats.ts` - user stats
- `tokens.ts` - API tokens (separate from users.ts)
- `push.ts` - push subscriptions
- `holidays.ts` - workspace holiday calendar
- `leaves.ts` - workspace leave types + leave requests (balance computed from member join date)
- `employees.ts` - employee records; sensitive fields (PAN, Aadhaar, bank account) AES-256-GCM encrypted via `src/lib/encryption.ts`

### Migration
`scripts/migrate.js` - **single migration script** and must always be **fully up-to-date**.
- Fresh DB: creates every table/column.
- Existing DB: additive `ALTER TABLE` statements add missing columns (wrapped to skip duplicates).
Run: `npm run migrate`.

---

## Auth System

| Cookie | Purpose | Expiry |
|--------|---------|--------|
| `cm_session` | JWT session (httpOnly, SameSite=Lax, secure in prod) | 30 days |
| `cm_otp_ok` | OTP verified proof (httpOnly) | 15 min |

> **SameSite=Lax** is intentional - `Strict` causes PWA session loss on iOS/Android cold-open (the PWA→browser navigation is treated as cross-origin). `Lax` preserves sessions while still blocking cross-site POST requests.

- JWT carries `jti` (UUID) for revocation - checked on every server-side request via `getSessionFromCookies()`
- Edge middleware (`proxy.ts`) does signature-only verification - fast, no DB hit
- Node.js route handlers call `getSessionFromCookies()` which checks `revoked_tokens` table
- `getServerUser()` reads `x-user-id` / `x-user-email` headers set by proxy

Password: bcryptjs cost 12, minimum 8 chars. Never store plaintext.
WiFi SSID: bcryptjs hash - same library, raw SSID never persisted.

---

## Architecture

### Route handlers
- Read user ID from `getServerUser()` (never from request body)
- Validate admin role via `requireWsAdmin(req, slug)` for workspace routes
- Call query functions, return JSON
- Errors: `{ error: "Human message", code: "MACHINE_CODE" }`, consistent HTTP status

### Server vs Client components
- Default: Server Components
- Client only when: interactive state, browser APIs (GPS, Notification), usePathname/useParams
- Never put business logic in Client Components - fetch from API routes instead

### Copy (strings)
- English UI and marketing copy lives in `src/locales/en.ts` — import `en` and use nested keys. Prefer adding keys there instead of hardcoding user-visible strings in components or routes.

### Layouts
- `src/app/(public)/layout.tsx` - passthrough, public pages
- `src/app/me/layout.tsx` - user PWA shell (header + bottom nav)
- `src/app/ws/[slug]/layout.tsx` - org PWA shell (header + tab nav)

### SEO and indexing
- Root metadata lives in `src/app/layout.tsx`.
- Public crawl rules live in `src/app/robots.ts`; the sitemap lives in `src/app/sitemap.ts`.
- Keep `/`, `/for-teams`, `/for-you`, `/pricing`, `/open-source`, `/privacy`, and `/terms` indexable.
- Keep `/login`, `/consent/*`, `/me/*`, `/ws/*`, and `/api/*` non-indexable.
- Set `NEXT_PUBLIC_APP_URL` to the production canonical origin (`https://venzio.ai`) before deployment so canonical links, Open Graph URLs, robots, and sitemap point at the live domain.

---

## Design System

CSS variables in `src/app/globals.css`:

| Variable | Value | Use |
|----------|-------|-----|
| `--brand` | `#1B4DFF` | Primary buttons, links |
| `--navy` | `#0D1B2A` | Headings, dark text |
| `--teal` | `#00D4AA` | Present/verified status |
| `--amber` | `#F59E0B` | Warnings, IP signal |
| `--danger` | `#EF4444` | Errors, destructive |
| `--surface-0` | `#FFFFFF` | Card backgrounds |
| `--surface-1` | `#F8FAFC` | Page backgrounds |
| `--surface-2` | `#F1F5F9` | Input backgrounds |
| `--border` | `#E2E8F0` | All borders |

Fonts: Syne (headings), DM Sans (body), JetBrains Mono (code/timestamps).

Rules:
- No drop shadows - borders only
- No gradients - flat fills
- Minimum touch target: 44px height
- Skeleton loaders for async, never spinners
- Tailwind CSS v4, utility-only - no component libraries

---

## Plan Limits (lib/plans.ts)

| Plan | Max Users | History | Locations | CSV |
|------|-----------|---------|-----------|-----|
| `free` | 10 | 3 months | 1 | No |
| `starter` | unlimited | 12 months | 1 | Yes |
| `growth` | unlimited | 7 years | 5 | Yes |

Enforce in `queryWorkspaceEvents()` - plan gate applied before signal matching.

---

## Key Invariants

1. **User ID never from client** - always from `x-user-id` header (proxy-set from JWT)
2. **Workspace scoping** - slug → workspace.id via `requireWsAdmin()`, then all queries use workspace.id
3. **OTP registration** - `cm_otp_ok` cookie must be present + valid before account creation
4. **Consent validation** - 3 checks: status=pending_consent, token not expired, logged-in email matches invited email
5. **Location labels** - set asynchronously post-check-in via Nominatim. May be NULL - that's acceptable, not a bug
6. **Checkout signals** - GPS/WiFi/IP collected at checkout too. Both check-in AND checkout signals stored
7. **Admin overrides** - stored in `admin_overrides` table, never modify original `presence_events` row
8. **Rate limiting** - `rate_limit_log` table: IP-keyed for login (10 attempts per 15 min), user-keyed for checkin (10 per hr). Use `getRateLimitCount` + `recordRateLimitHit` from `lib/db/queries/users.ts`.
9. **API token O(1) lookup** - `token_prefix` column stores first 8 chars of the raw token. Always use prefix lookup in `POST /api/v1/checkin`. Never skip it.
10. **Every workspace has its system roles** - permissions resolve by joining `workspace_members.role` → `workspace_roles`, so a workspace with no rows in `workspace_roles` grants *nobody* anything, its creator included. `createWorkspace()` seeds owner/admin/member via `seedSystemRoles()` in the same transaction as the workspace row. Never insert a workspace by any other path.
11. **The workspace creator is the `owner`** - not an `admin`. Only `owner` holds the `ownership` resource (transfer, archive, billing), so a workspace whose creator is an admin has nobody who can do those things.
12. **One definition of the seeded grids** - `src/lib/permissions/system-roles.json`, read by both the app (`system-roles.ts`) and `scripts/migrate.js`. Never write a second copy: the app and the migration drifting apart is exactly what shipped every new workspace with no roles.
13. **You can only hand out permissions you hold** - `guardEscalation()` runs on role *create*, role *edit* AND role *assignment* (`PATCH /members/[id]/role`). Rank is not a ceiling on its own: every custom role shares `CUSTOM_ROLE_RANK`, so rank alone lets any custom role with `members.role:write` assign any other custom role, however powerful. Never gate an assignment on rank alone.
14. **Data scope is the surface, not the role** - `/me/*` is always self-only, for every role, decided by the session user ID with no role lookup. So `Scope.Self` means "no org surface at all" (only the seeded `member` role carries it) and every `/ws` role is `Scope.All`. The roles builder offers no choice, and routes set scope server-side rather than accepting one from the client.

---

## What NOT to Do

- Never call `db.query()` / `db.execute()` outside of `lib/db/queries/`
- Never accept `userId` or `workspaceId` from request body/params without verification
- Never delete presence_events rows
- Never store raw WiFi SSIDs
- Never skip `requireWsAdmin()` for workspace admin routes
- Never add drop shadows or gradients to UI
- Never trust `otpVerified: true` from client
- Never use spinners - use skeleton loaders

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | No (dev) | Turso URL. Empty → SQLite at ./venzio.db |
| `TURSO_AUTH_TOKEN` | No (dev) | Turso auth token |
| `LOCAL_DATABASE_PATH` | No | Optional SQLite path for `npm run db:sync`; defaults to ./venzio.db |
| `JWT_SECRET` | **Yes** | 32+ char random string |
| `RESEND_API_KEY` | Recommended | OTPs go to console if missing |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical app URL. Use `http://localhost:3000` in dev and `https://venzio.ai` in production |
| `VAPID_PUBLIC_KEY` | Push | VAPID public key for web-push |
| `VAPID_PRIVATE_KEY` | Push | VAPID private key for web-push |
| `VAPID_EMAIL` | Push | Contact email for VAPID (`mailto:...`), defaults to keshav.sharma@globalnodes.ai |
| `CRON_SECRET` | Push | 32+ char secret for `/api/push/cron` auth; must match GitHub Actions secret |
| `FIELD_ENCRYPTION_KEY` | **Yes** | 64-char hex string (32 bytes) for AES-256-GCM employee field encryption. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Running Locally

```bash
npm install
node scripts/migrate.js
npm run dev
# App at http://localhost:3000
```

Dev: OTPs printed to console when Resend not configured.
