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
│   │       └── page.tsx        # /ws/:slug — Today dashboard
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

Server-rendered. Shows:
- Today's date + status line ("Checked in at 9:42 AM" or "Not checked in yet")
- **"I'm here"** button (64px, full width) — always visible. Triggers GPS collection → check-in API call.
- **"I'm leaving"** button — appears below when an active (unchecked-out) event exists.
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
| **Phase B** | 🔄 In progress | Org PWA — `/ws` picker + `/ws/:slug` today dashboard complete; People and Settings tabs pending |
| Phase 5 | Pending | Landing page, PWA manifests, domain verification, invite flow |

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
