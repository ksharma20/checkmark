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
| Maps | Leaflet.js + OpenStreetMap (Phase 4) |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── app/
│   ├── (public)/               # Landing, login — no auth required
│   │   ├── layout.tsx          # Passthrough layout for public routes
│   │   ├── login/page.tsx      # /login — single auth entry point (all flows)
│   │   └── join/[slug]/        # /join/:slug — org invite landing (Phase 5)
│   ├── me/                     # User PWA — requires session (Phase 3)
│   ├── ws/                     # Org PWA — requires admin session (Phase 4)
│   └── api/
│       └── auth/
│           ├── login/route.ts      # POST — email check + password verify
│           ├── otp/send/route.ts   # POST — send OTP
│           ├── otp/verify/route.ts # POST — verify OTP code
│           ├── register/route.ts   # POST — create account
│           └── logout/route.ts     # POST — clear session
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
│   ├── auth.ts            # JWT, cookies, bcrypt, OTP
│   ├── email.ts           # Resend email helpers (OTP + consent)
│   ├── geo.ts             # Haversine, IP geolocation
│   ├── timezone.ts        # UTC ↔ IANA timezone helpers
│   ├── plans.ts           # Plan limits (free / starter / growth)
│   ├── signals.ts         # Core dashboard query (signal matching)
│   └── stats.ts           # User stats computation
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

Copy the template and fill in values:

```bash
cp .env.local .env.local   # file already exists with template values
```

Edit `.env.local`:

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

Creates `checkmark.db` with all 10 tables:

```bash
node scripts/migrate.js
```

Expected output:
```
✓ Migration complete — ran 12 statement(s) against /path/to/checkmark.db
```

### 5. Start the dev server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

---

## Database

### Schema (10 tables)

| Table | Purpose |
|---|---|
| `users` | User accounts — email, password hash, name |
| `otp_codes` | 6-digit OTPs for signup and verification |
| `user_api_tokens` | Personal API tokens for programmatic check-ins |
| `presence_events` | Core table — every check-in/check-out, GPS, WiFi, IP |
| `workspaces` | Organisations — slug, name, plan, timezone |
| `workspace_domains` | Email domains for auto-enrolment |
| `workspace_members` | User ↔ workspace membership, role, consent status |
| `workspace_signal_config` | GPS / WiFi / IP signal configs for presence matching |
| `admin_overrides` | Additive admin overrides — audit log, never modifies events |
| `user_stats` | Pre-computed streaks, totals — upserted after every check-in |

### Re-running migrations

The migration is idempotent (`CREATE TABLE IF NOT EXISTS`). Safe to run anytime:

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

### Login flow

```
Email input
    │
    ├─ Email exists in DB ──→ Password input ──→ Sign in ──→ redirect
    │
    └─ Email not in DB ────→ OTP sent to email ──→ 6-digit verify
                                                        │
                                                    Name + password setup
                                                        │
                                                    Account created ──→ redirect
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

## Login Page — `/login`

Single entry point for all authentication. A client-side state machine handles four steps:

```
Step 1 — Email
  └─ Email exists in DB ──────────▶ Step 2a — Password ──▶ Sign in ──▶ redirect
  └─ Email not in DB ─────────────▶ OTP sent
                                         │
                                    Step 2b — OTP input ──▶ Verified
                                                                │
                                                         Step 3 — Name + Password setup
                                                                │
                                                         Account created ──▶ redirect
```

**Resend not configured?** OTPs are printed to the server console in dev so the flow still works:
```
[DEV] OTP for user@example.com: 481923
```

**Invite flow:** `/login?invite=workspace-slug` — after login or signup, the user is auto-enrolled in that workspace if their email matches.

---

## Key Library Modules

### `lib/db/index.ts`
Single `db` object with `query`, `queryOne`, `execute`, `transaction`. Switches backend via `DATABASE_URL` env var. All app code uses this — never imports SQLite or Postgres directly.

### `lib/signals.ts` — `queryWorkspaceEvents()`
The core dashboard function. Given a workspace and date range:
1. Gets active members
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

> **Next.js 16 note:** `middleware.ts` was renamed to `proxy.ts` and the exported function from `middleware` to `proxy` in Next.js 16. If you see deprecation warnings, this is why.

---

## Build Phases

| Phase | Status | Contents |
|---|---|---|
| **Phase 1** | ✅ Complete | DB schema, abstraction layer, all lib modules, route protection, migration |
| **Phase 2** | ✅ Complete | Auth API routes, `/login` page with full OTP + password flows |
| Phase 3 | Pending | User PWA — `/me` check-in, timeline, orgs, settings |
| Phase 4 | Pending | Org PWA — `/ws` dashboard, monthly grid, people, signals, settings |
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
| POST | `/api/auth/login` | None | Email check or password verify |
| POST | `/api/auth/otp/send` | None | Send 6-digit OTP to email |
| POST | `/api/auth/otp/verify` | None | Verify OTP code |
| POST | `/api/auth/register` | None | Create account after OTP verify |
| POST | `/api/auth/logout` | Cookie | Clear session cookie |

#### `POST /api/auth/login`

**Step 1 — check if email exists:**
```json
// Request
{ "email": "user@example.com" }

// Response (email exists)
{ "exists": true }

// Response (email not found)
{ "exists": false }
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

// Response
{ "verified": true }

// Error — 400
{ "error": "Invalid or expired code", "code": "INVALID_OTP" }
```

#### `POST /api/auth/register`
```json
// Request
{ "email": "newuser@example.com", "fullName": "Jane Doe", "password": "securepass", "otpVerified": true }

// Response (success) — also sets cm_session cookie
{ "user": { "id": "...", "email": "...", "fullName": "Jane Doe" }, "redirect": "/me" }
```

#### `POST /api/auth/logout`
```json
// Response — also clears cm_session cookie
{ "success": true }
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
