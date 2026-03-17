# CheckMark — Presence Intelligence Platform

> **Know where your team is. Own where you've been.**

CheckMark is a full-stack Next.js application with two PWA surfaces:
- **User side** (`/me/*`) — mobile-first, individuals record their own presence
- **Org side** (`/ws/:slug/*`) — desktop-first, companies query presence data

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | `better-sqlite3` in dev → `@vercel/postgres` / Neon in production |
| Auth | Custom — email + password, OTP via `jose` + `bcryptjs` |
| Styling | Tailwind CSS v4 — utility only, no component libraries |
| Email | Resend (OTP, consent emails) |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── (public)/               # Landing, login — no auth required
│   │   ├── layout.tsx          # Passthrough layout for public routes
│   │   └── login/page.tsx      # /login — 6-state auth flow
│   ├── me/                     # User PWA — requires session
│   │   ├── layout.tsx          # Header + bottom nav
│   │   ├── page.tsx            # /me — home (check-in, stats, orgs strip)
│   │   ├── timeline/page.tsx   # /me/timeline — event history with date filters
│   │   ├── orgs/               # /me/orgs — workspace memberships
│   │   │   ├── page.tsx
│   │   │   └── OrgsClient.tsx
│   │   └── settings/page.tsx   # /me/settings — profile, password, tokens, danger
│   ├── ws/                     # Org PWA — requires admin session
│   │   ├── layout.tsx          # Passthrough
│   │   ├── page.tsx            # /ws — workspace picker (multi-workspace admins)
│   │   └── [slug]/
│   │       ├── layout.tsx      # Header + nav tabs (Today | People | Settings)
│   │       ├── page.tsx        # /ws/:slug — Today dashboard
│   │       ├── people/
│   │       │   ├── page.tsx    # /ws/:slug/people — server wrapper (auth check)
│   │       │   └── PeopleClient.tsx  # Member list + invite form (client)
│   │       └── settings/
│   │           └── page.tsx    # /ws/:slug/settings — workspace details + domain verification
│   └── api/
│       ├── auth/
│       │   ├── check-email/route.ts    # POST — email existence check
│       │   ├── login/route.ts          # POST — email check + password verify
│       │   ├── otp/send/route.ts       # POST — send OTP
│       │   ├── otp/verify/route.ts     # POST — verify OTP + set cm_otp_ok cookie
│       │   ├── register/route.ts       # POST — create account (personal or org)
│       │   └── logout/route.ts         # POST — clear session
│       ├── workspace/
│       │   └── check-slug/route.ts     # POST — slug availability check
│       ├── ws/
│       │   └── [slug]/
│       │       ├── route.ts                          # PATCH — update workspace name/timezone
│       │       ├── domain/route.ts                   # GET domains · POST add domain
│       │       ├── domain/[domainId]/route.ts         # DELETE domain
│       │       ├── domain/[domainId]/verify/route.ts  # POST — DNS TXT verification
│       │       ├── members/route.ts                   # GET all members · POST invite
│       │       └── members/[memberId]/route.ts        # DELETE member
│       ├── checkin/
│       │   ├── route.ts                # POST — create presence event
│       │   └── checkout/route.ts       # POST — check out of most recent open event
│       ├── events/
│       │   ├── route.ts                # GET — user's events (paginated, date-filtered)
│       │   └── [id]/route.ts           # PATCH note · DELETE (within 5 min)
│       ├── me/
│       │   ├── route.ts                # GET profile · PATCH name · DELETE account
│       │   ├── password/route.ts       # POST — change password
│       │   ├── consent/route.ts        # POST — accept/decline workspace invite
│       │   └── workspaces/[workspaceId]/route.ts  # DELETE — leave workspace
│       └── tokens/
│           ├── route.ts                # GET list · POST create (returns plain token once)
│           └── [id]/route.ts           # DELETE — revoke
├── app/manifest.ts             # PWA manifest
├── lib/
│   ├── db/
│   │   ├── index.ts       # DB abstraction (SQLite ↔ Postgres)
│   │   ├── schema.ts      # All CREATE TABLE statements
│   │   └── queries/       # One file per domain — no raw SQL in routes
│   │       ├── users.ts
│   │       ├── events.ts
│   │       ├── workspaces.ts
│   │       ├── signals.ts
│   │       └── stats.ts
│   ├── auth.ts            # JWT, cookies, bcrypt, OTP, getServerUser(), OTP cookie
│   ├── email.ts           # Resend email helpers (OTP + consent)
│   ├── geo.ts             # Haversine, IP geolocation, extractIp()
│   ├── timezone.ts        # UTC ↔ IANA timezone helpers
│   ├── plans.ts           # Plan limits (free / starter / growth)
│   ├── signals.ts         # Core dashboard query (signal matching)
│   └── stats.ts           # User stats computation
├── components/
│   └── user/
│       ├── BottomNav.tsx       # Fixed bottom nav (client — uses usePathname)
│       ├── CheckinButtons.tsx  # "I'm here" + "I'm leaving" (client — GPS + API)
│       └── EventCard.tsx       # Presence event card with inline note edit (client)
├── proxy.ts               # Route protection (Next.js 16 — previously middleware.ts)
scripts/
└── migrate.js             # DB migration runner (plain Node.js)
```

---

## Local Development Setup

### 1. Prerequisites

- Node.js 20+
- npm 10+

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Edit `.env.local` (already exists with template values):

```bash
# Leave empty → uses SQLite at ./checkmark.db (recommended for local dev)
DATABASE_URL=

# Generate a secret: openssl rand -base64 32
JWT_SECRET=your-random-32-char-secret

# Get a free key at resend.com — needed for OTP emails
# In dev, OTPs are also printed to console if key is missing
RESEND_API_KEY=re_xxxxxxxxxxxx

# Base URL of the app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the database migration

Creates (or updates) `checkmark.db` with all tables:

```bash
node scripts/migrate.js
```

Expected output:
```
✓ Migration complete — ran 13 statement(s) against /path/to/checkmark.db
```

### 5. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## Database

### Schema (10 tables + 1 column addition)

| Table | Purpose |
|---|---|
| `users` | User accounts — email, password hash, name |
| `otp_codes` | 6-digit OTPs for signup and verification |
| `user_api_tokens` | Personal API tokens for programmatic check-ins |
| `presence_events` | Core table — every check-in/check-out, GPS, WiFi, IP |
| `workspaces` | Organisations — slug, name, plan, org_type, timezone |
| `workspace_domains` | Email domains for auto-enrolment |
| `workspace_members` | User ↔ workspace membership, role, consent status |
| `workspace_signal_config` | GPS / WiFi / IP signal configs for presence matching |
| `admin_overrides` | Additive admin overrides — audit log, never modifies events |
| `user_stats` | Pre-computed streaks, totals — upserted after every check-in |

The migration runner is idempotent. `ALTER TABLE` column additions are wrapped in try/catch so re-running is always safe:

```bash
node scripts/migrate.js
```

### Inspect the database (dev)

```bash
# Open interactive shell
npx better-sqlite3-cli checkmark.db

# Or with sqlite3 if installed
sqlite3 checkmark.db ".tables"
sqlite3 checkmark.db ".schema users"
```

---

## Auth System

- **Tokens:** JWT via `jose`, 30-day expiry, stored in `httpOnly` cookie `cm_session`
- **Passwords:** `bcryptjs` at cost factor 12, minimum 8 characters
- **OTP:** 6-digit code, 10-minute expiry, single-use, max 3 sends per hour
- **OTP verification cookie:** short-lived 15-min signed JWT (`cm_otp_ok`) set after OTP verify — prevents client-side trust of `otpVerified: true`

### Login / Registration flow

```
Email input
    │
    ├─ Email exists ──────────────▶ Password ──▶ Sign in ──▶ redirect
    │
    └─ Email not found ───────────▶ OTP sent to email
                                         │
                                    OTP verified (sets cm_otp_ok cookie)
                                         │
                                    Account type selection
                                         │
                              ┌──────────┴──────────┐
                         Personal              Organisation
                              │                     │
                         Name + password      Org name, URL handle,
                              │               domain + name + password
                              └──────────┬──────────┘
                                    Account created ──▶ redirect
```

### Post-login routing

| Condition | Redirects to |
|---|---|
| Admin of 1 workspace | `/ws/:slug` |
| Admin of 2+ workspaces | `/ws` |
| No admin role | `/me` |

---

## Plans

| Plan | Max users | History | Locations | CSV export |
|---|---|---|---|---|
| `free` | 10 | 3 months | 1 | No |
| `starter` | Unlimited | 12 months | 1 | Yes |
| `growth` | Unlimited | 7 years | 5 | Yes |

Plan limits are enforced server-side in `lib/plans.ts`.

---

## User PWA — `/me/*`

All routes require a valid session cookie. The proxy redirects to `/login` if missing.

### `/me` — Home

Server-rendered shell + client-rendered state. Shows:
- Today's date (client local timezone) + status line — `"Checked in at 10:15 AM on 17 Mar 2026"` or `"Not checked in yet"` — client-rendered only, always in browser timezone.
- **"I'm here"** button (64px, full width) — visible only when CHECKED_OUT. Triggers GPS collection → check-in API call.
- **"I'm leaving"** button — visible only when CHECKED_IN. Triggers GPS collection → checkout API call.
- Three stat chips: **days / hrs / places** this calendar month
- Today's check-in list (server-rendered, refreshed via `router.refresh()` after mutations)
- Workspace strip: each workspace the user is active in, with days count

**GPS flow in CheckinButtons:** `navigator.geolocation.getCurrentPosition()` is called on button tap. If denied, check-in still proceeds with null GPS — a toast explains why. WiFi SSID is read from `navigator.connection?.ssid` (Chrome desktop/Android only).

### `/me/timeline`

Client component. Fetches from `GET /api/events`. Features:
- Date range pickers (default: current month, resets on page load)
- Events grouped by date, newest first
- Inline note editing on any event
- Delete button — only appears within 5 minutes of check-in creation

### `/me/orgs`

Server + client split. Shows:
- **Pending consent invites** — Accept / Decline buttons
- **Active workspace memberships** — with Leave button (blocked if sole admin)

### `/me/settings`

Client component with four sections:
- **Profile** — update display name
- **Password** — change with current password verification
- **API Tokens** — create named tokens (plain token shown once), revoke existing
- **Danger zone** — delete account (cascade-deletes all data via FK constraints)

---

## Org PWA — `/ws/:slug/*`

All routes require a valid session cookie AND admin membership of the workspace. Non-admins are redirected to `/me`. Non-existent slugs return 404.

### `/ws` — Workspace picker

Shown to admins of 2+ workspaces. Admins of a single workspace are redirected directly to `/ws/:slug` at login. If the user has no admin roles, redirects to `/me`.

### `/ws/:slug/people` — People tab

Server + client split. Features:
- **Member list** — all statuses (active, invite sent, declined), avatar initials, role badge
- **Status badges:** Active (teal), Invite sent (amber), Declined (red)
- **Invite form** — send consent email to any address; shows error if already an active member
- **Remove member** — disabled for admin roles

### `/ws/:slug/settings` — Settings tab

Full client component (uses `useParams` + `useCallback`). Two sections:
- **Workspace details** — edit name + timezone (PATCH `/api/ws/:slug`)
- **Email domain verification** — add domains, view DNS TXT records with copy buttons, check DNS verification status

---

## Domain Verification

Admins add a domain (e.g. `acme.com`) in the Settings tab. CheckMark generates a DNS TXT record:

```
Name:  _checkmark-verify.acme.com
Value: checkmark-verify=<token>
```

The token is deterministic: `HMAC-SHA256("domain-verify:{workspaceId}:{domain}", JWT_SECRET)` (first 32 hex chars). No extra DB column needed — recomputed on each verify request.

Once DNS propagates, clicking "Check verification" calls `POST /api/ws/:slug/domain/:id/verify`, which resolves the TXT record and marks the domain verified.

**Auto-enrolment:** When a verified domain matches a user's email on `/join/:slug`, they are automatically added as an active member without needing an explicit invite.

---

## Consent Flow

Two paths to membership consent:

### Email link (non-users / non-logged-in)

1. Admin invites `colleague@company.com` from People tab
2. Consent email sent with links: `Accept` / `Decline`
3. **Decline** — resolves token, marks member declined, no login required
4. **Accept (logged in)** — resolves token, calls `acceptConsent`, redirects to `/me`
5. **Accept (not logged in)** — resolves workspace slug, redirects to `/login?invite={slug}`

After login, `/join/:slug` detects `pending_consent` status and shows Accept/Decline buttons.

### In-app (logged-in users)

If a user visits `/join/:slug` directly:
- **Active** → redirected to `/me`
- **Pending consent** → shows Accept/Decline buttons (calls `POST /api/me/consent`)
- **Domain match** → auto-enrolled without explicit consent needed
- **No path** → "Invite required" message

### `/ws/:slug` — Today dashboard

Server-rendered. Shows who is present right now, who visited today, and who hasn't checked in yet — all in the workspace's configured timezone.

**Data flow:**
1. Resolves workspace from slug, verifies admin membership
2. Computes today's UTC bounds using `todayInTz(tz)` + `localMidnightToUtc()`
3. Calls `queryWorkspaceEvents()` — applies plan history gate + signal matching
4. Fetches all active members via `getActiveMembersWithDetails()` (JOIN with users table)
5. Groups by: **In office now** (open event) | **Visited today** (all checked out) | **Not in** (no events)

**Layout:**
- Sticky header: `CheckMark / Workspace Name` + `Personal →` link
- Nav tabs: `Today` | `People` | `Settings`
- Stat chips: in office · visited · not in · total members
- Per-person row: name, email, check-in→checkout times (workspace TZ), signal badge, duration

**Signal badges:**

| Badge | Colour | Meaning |
|---|---|---|
| WiFi | Teal | Matched by WiFi SSID |
| GPS | Brand blue | Matched by GPS proximity |
| IP | Amber | Matched by IP geolocation |
| Override | Purple | Admin override applied |
| — | Muted | Config-light mode (no signals configured) |

---

## PWA

CheckMark is installable as a Progressive Web App on both mobile and desktop.

- **Manifest:** `src/app/manifest.ts` (served at `/manifest.webmanifest`)
- **Start URL:** `/me` (user PWA)
- **Display mode:** `standalone` (no browser chrome)
- **Theme colour:** `#1a1a2e` (navy)
- **Icons:** `/icon-192.png` and `/icon-512.png` — add to `public/` before deploying

The `<meta name="apple-mobile-web-app-capable">` tag is set via `appleWebApp` in the root layout metadata, enabling full-screen mode on iOS when added to the home screen.

---

## Landing Page

`/` — static, publicly accessible. Features:
- Sticky nav: CheckMark wordmark + Sign in / Get started links
- Hero: headline, subheadline, two CTAs (both route to `/login`)
- Feature grid (4 cards): who's in today, privacy by design, verified domains, multiple signals
- Footer

No JavaScript required — fully server-rendered React.

---

## Login Page — `/login`

Single entry point for all authentication. A 6-state client state machine:

| State | Description |
|---|---|
| `email` | Enter email — checks existence via `/api/auth/check-email` |
| `password` | Existing user — enter password |
| `otp` | New user — enter 6-digit code sent to email |
| `accountType` | OTP verified — choose Personal or Organisation |
| `personal` | Enter name + password |
| `org` | Enter org name, URL handle (live `/ws/check-slug` check), optional domain, name + password |

**OTP security:** After verify, a 15-minute signed `cm_otp_ok` httpOnly cookie is set server-side. The register route validates this cookie — the client never sends `otpVerified: true`.

**Resend not configured?** OTPs are printed to the server console in dev:
```
[DEV] OTP for user@example.com: 481923
```

---

## Key Library Modules

### `lib/db/index.ts`
Single `db` object with `query`, `queryOne`, `execute`, `transaction`. Switches backend via `DATABASE_URL` env var. All app code uses this — never imports SQLite or Postgres directly.

### `lib/signals.ts` — `queryWorkspaceEvents()`
The core dashboard function. Given a workspace and date range:
1. Gets active member user IDs (honours plan user limit)
2. Gets signal configs (GPS / WiFi / IP)
3. If **no signal configs**: returns all events (config-light mode)
4. If **signal configs exist**: filters events by proximity/WiFi match
5. Returns each event with a `matched_by` field: `wifi | gps | ip | none | override`

### `lib/domain-verify.ts`
- `domainVerifyToken(workspaceId, domain)` — deterministic HMAC-SHA256 token (first 32 hex chars)
- `checkDnsVerification(domain, token)` — resolves `_checkmark-verify.{domain}` TXT records, returns `boolean`

### `lib/ws-admin.ts`
- `requireWsAdmin(request, slug)` — reads `x-user-id` header, validates workspace + admin+active membership. Returns `{ workspace, userId }` or `null`.

### `lib/stats.ts` — `updateUserStats()`
Called after every check-in. Computes:
- Streak (consecutive days with ≥1 check-in)
- Total check-ins and hours
- This month's check-ins
- Distinct GPS clusters this month (500m radius)

### `lib/geo.ts`
- `getIpGeo(ip)` — calls ip-api.com (free, no key, 45 req/min limit). Returns `null` for localhost/private IPs in dev.
- `haversineMetres(lat1, lng1, lat2, lng2)` — great-circle distance in metres
- `extractIp(request)` — reads `x-forwarded-for` or `x-real-ip`

### `lib/timezone.ts`
All times stored as UTC in the DB. These helpers convert for display:
- `formatInTz(utcStr, tz, 'time'|'date'|'datetime')`
- `monthBoundsUtc(year, month, tz)` — returns UTC start/end for a calendar month in a timezone
- `todayInTz(tz)` — today's date string `YYYY-MM-DD` in a given timezone
- `localMidnightToUtc(dateStr, tz)` — converts a local date to UTC ISO

### `lib/auth.ts`
- `createJwt` / `verifyJwt` — session tokens
- `setSessionCookie` / `clearSessionCookie` / `getSessionFromCookies`
- `setOtpVerifiedCookie(email)` — 15-min signed JWT in `cm_otp_ok` cookie
- `verifyOtpCookie(email)` — validates the OTP cookie server-side
- `getServerUser()` — reads `x-user-id` / `x-user-email` headers set by `proxy.ts`

---

## Proxy (Route Protection)

`src/proxy.ts` runs on every matched request (Next.js 16 equivalent of `middleware.ts`):

| Path | Requirement |
|---|---|
| `/me/*` | Valid JWT cookie → redirect to `/login` if missing |
| `/ws/*` | Valid JWT cookie → redirect to `/login` if missing (admin role checked per-route) |
| `/api/*` (non-public) | Valid JWT cookie → 401 if missing |
| `/api/v1/*` | Bearer token (handled inside route handlers) |
| `/api/auth/*` | Public — no auth required |
| `/api/auth/check-email` | Public — no auth required |
| `/api/workspace/check-slug` | Public — no auth required |

> **Next.js 16 note:** `middleware.ts` was renamed to `proxy.ts` and the exported function from `middleware` to `proxy`. If you see deprecation warnings, this is why.

---

## Build Phases

| Phase | Status | Contents |
|---|---|---|
| **Phase 1** | ✅ Complete | DB schema, abstraction layer, all lib modules, route protection, migration |
| **Phase 2** | ✅ Complete | Auth API routes, `/login` page |
| **Phase 3** | ✅ Complete | User PWA — check-in, timeline, orgs, settings pages + all APIs |
| **Phase A** | ✅ Complete | Rewritten login: 6-state flow, account type selection, OTP cookie security, org registration with live slug check |
| **Phase B** | ✅ Complete | Org PWA — `/ws` picker, `/ws/:slug` today dashboard, people tab, settings tab |
| **Phase C** | ✅ Complete | Domain verification, consent flow (email + in-app), invite pages, PWA manifest, landing page |
| **Phase D** | ✅ Complete | `/ws` workspace picker with creation form, `POST /api/workspace`, GPS signal config + timezone auto-detect, `POST /api/v1/checkin` Bearer auth, dual PWA manifests, signal config UI in settings |
| **E2E Test** | ✅ All 10 steps pass | Registration (personal + org), existing login, workspace creation from personal account, GPS timezone auto-detect, domain verification, consent accept, PWA manifests, API token checkin |
| **QA §1.2** | ✅ Complete | User timezone detection and confirmation. `PATCH /api/me/timezone` — validates IANA timezone string, updates `users.timezone + timezone_updated_at + timezone_confirmed`. `TimezoneReporter` — invisible client component, fires `Intl.DateTimeFormat().resolvedOptions().timeZone` to API on every `/me` mount (keeps DB in sync silently). `TimezoneBanner` — shown once when `timezone_confirmed = 0`; displays detected timezone, Confirm button (sets `confirm: true`) and Change button (inline text input for manual override); dismisses permanently on confirm. Both wired into `me/page.tsx` alongside the existing `CheckinButtons`. |
| **QA §1.1** | ✅ Complete | Check-in/check-out state machine enforced server + client. `POST /api/checkin` → 409 if open event exists. `POST /api/checkin/checkout` → 409 if not checked in; now captures GPS/WiFi/IP signals at checkout. `GET /api/checkin/status` added. `CheckinButtons` client: shows "I'm here" only when CHECKED_OUT, "I'm leaving" only when CHECKED_IN; switches state instantly on success + syncs with server via `router.refresh()`. DB: 7 checkout_* columns added to `presence_events`. **Sub-bug fixes:** (1) SQLite datetime UTC parsing — `"2026-03-17 07:54:11"` (space, no Z) was misread as local time by browsers; created `src/lib/client/format-time.ts` with `parseUtc()` normaliser → all times now display in browser's local timezone. (2) Duplicate status display — removed server-rendered "Checked in at" from `me/page.tsx`; `CheckinButtons` is sole owner of the status line. (3) Days-count bug — `split('T')[0]` on SQLite format returned full string (no T → every event unique); changed to `slice(0, 10)`. (4) Consistent time format — `"10:15 AM on 17 Mar 2026"` enforced via `fmtTimeOnDate()` across `CheckinButtons` and `EventCard`. |

---

## API Reference

All routes return JSON. Errors always return:
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }
```

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/check-email` | None | Check if email has an account |
| POST | `/api/auth/login` | None | Email check or password verify |
| POST | `/api/auth/otp/send` | None | Send 6-digit OTP to email |
| POST | `/api/auth/otp/verify` | None | Verify OTP — sets `cm_otp_ok` cookie |
| POST | `/api/auth/register` | OTP cookie | Create account (personal or org) |
| POST | `/api/auth/logout` | Cookie | Clear session cookie |

#### `POST /api/auth/check-email`
```json
// Request
{ "email": "user@example.com" }

// Response
{ "exists": true }
```

#### `POST /api/auth/login`

**Step 1 — check if email exists:**
```json
// Request
{ "email": "user@example.com" }

// Response (email exists)
{ "exists": true }
```

**Step 2 — verify password:**
```json
// Request
{ "email": "user@example.com", "password": "mypassword" }

// Response (success) — also sets cm_session cookie
{ "user": { "id": "...", "email": "...", "fullName": "..." }, "redirect": "/me" }

// Response (wrong password) — 401
{ "error": "Invalid credentials", "code": "INVALID_CREDENTIALS" }
```

#### `POST /api/auth/otp/send`
```json
// Request
{ "email": "newuser@example.com" }

// Response
{ "sent": true, "expiresIn": 600 }

// Error (rate limited) — 429
{ "error": "Too many OTP requests. Try again later.", "code": "RATE_LIMITED" }
```

#### `POST /api/auth/otp/verify`
```json
// Request
{ "email": "newuser@example.com", "code": "481923" }

// Response — also sets cm_otp_ok cookie (15 min, httpOnly)
{ "verified": true }

// Error — 400
{ "error": "Invalid or expired code", "code": "INVALID_OTP" }
```

#### `POST /api/auth/register`
```json
// Personal account
{
  "email": "newuser@example.com",
  "fullName": "Jane Doe",
  "password": "securepass",
  "accountType": "personal"
}

// Org account
{
  "email": "jane@acme.com",
  "fullName": "Jane Doe",
  "password": "securepass",
  "accountType": "org",
  "orgName": "Acme Corp",
  "orgSlug": "acme-corp",
  "orgDomain": "acme.com"
}

// Response (success) — sets cm_session cookie, clears cm_otp_ok cookie
{ "user": { "id": "...", "email": "...", "fullName": "Jane Doe" }, "redirect": "/me" }
```

### Workspace

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/workspace/check-slug` | None | Check slug availability |

#### `POST /api/workspace/check-slug`
```json
// Request
{ "slug": "acme-corp" }

// Response
{ "available": true }
```

### Workspace Admin

All routes require session cookie + admin membership of the workspace.

| Method | Route | Description |
|---|---|---|
| PATCH | `/api/ws/:slug` | Update workspace name and/or timezone |
| GET | `/api/ws/:slug/domain` | List domains (with verify token if unverified) |
| POST | `/api/ws/:slug/domain` | Add a domain |
| DELETE | `/api/ws/:slug/domain/:id` | Remove a domain |
| POST | `/api/ws/:slug/domain/:id/verify` | Trigger DNS TXT verification |
| GET | `/api/ws/:slug/members` | List all members (all statuses) |
| POST | `/api/ws/:slug/members` | Invite member (sends consent email) |
| DELETE | `/api/ws/:slug/members/:id` | Remove member (blocked for admins) |

#### `POST /api/ws/:slug/members`
```json
// Request
{ "email": "colleague@company.com" }

// Response
{ "success": true }

// Error (already active) — 409
{ "error": "This person is already an active member", "code": "ALREADY_MEMBER" }
```

#### `POST /api/ws/:slug/domain/:id/verify`
```json
// Response (verified)
{ "verified": true, "message": "Domain verified" }

// Response (not yet)
{ "verified": false, "message": "TXT record not found yet. DNS propagation can take up to 48 hours." }
```

---

## Design System

CSS variables (defined in `src/app/globals.css`):

| Variable | Value | Use |
|---|---|---|
| `--brand` | `#1B4DFF` | Primary buttons, links |
| `--navy` | `#0D1B2A` | Headings, dark text |
| `--teal` | `#00D4AA` | "Present" status badge |
| `--amber` | `#F59E0B` | Warnings |
| `--danger` | `#EF4444` | Errors, destructive actions |
| `--surface-0` | `#FFFFFF` | Card backgrounds |
| `--surface-1` | `#F8FAFC` | Page backgrounds |
| `--surface-2` | `#F1F5F9` | Input backgrounds |
| `--border` | `#E2E8F0` | All borders |

Fonts loaded via Google Fonts:
- **Headings:** Syne (400, 600, 700)
- **Body:** DM Sans (400, 500)
- **Code / timestamps:** JetBrains Mono (400)

Design rules:
- No drop shadows — use borders only
- No gradients — flat solid fills
- Minimum touch target: 44px height
- Skeleton loaders for async states — never spinners

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No (dev) | Postgres URL for production. Empty → uses SQLite. |
| `JWT_SECRET` | **Yes** | Random 32+ char string for JWT signing |
| `RESEND_API_KEY` | Recommended | From resend.com. OTPs log to console if missing. |
| `NEXT_PUBLIC_APP_URL` | Yes | Full app URL (`http://localhost:3000` in dev) |
