# CheckMark — High Level Design

> Last updated: 2026-04-21 (post Phases 1–6 overhaul)

---

## 1. System Context

```mermaid
C4Context
  title CheckMark — System Context

  Person(user, "Individual User", "Records personal presence via mobile PWA")
  Person(admin, "Org Admin", "Queries team presence via desktop PWA")

  System(checkmark, "CheckMark", "Presence intelligence platform — multi-signal verification, attendance analytics")

  System_Ext(resend, "Resend", "Transactional email — OTPs, consent invites")
  System_Ext(ipapi, "ip-api.com", "IP geolocation (free, 45 req/min)")
  System_Ext(nominatim, "Nominatim / OSM", "Reverse geocoding GPS → human label")
  System_Ext(dns, "DNS", "Domain verification TXT record lookup")
  System_Ext(vapid, "Browser Push Service", "Web Push delivery (GCM/FCM/APNS)")

  Rel(user, checkmark, "Check in / check out, view timeline", "HTTPS / PWA")
  Rel(admin, checkmark, "View dashboard, configure signals, manage members", "HTTPS / PWA")
  Rel(checkmark, resend, "Send OTP + consent emails", "HTTPS REST")
  Rel(checkmark, ipapi, "Geolocate IP on check-in", "HTTPS REST")
  Rel(checkmark, nominatim, "Reverse geocode GPS lat/lng", "HTTPS REST")
  Rel(checkmark, dns, "Verify _checkmark-verify TXT records", "DNS TCP")
  Rel(checkmark, vapid, "Deliver push notifications", "HTTPS Web Push")
```

---

## 2. Application Architecture

```mermaid
graph TB
  subgraph Client["Client (Browser / PWA)"]
    SW["Service Worker\npublic/sw.js\n(push, offline)"]
    MePWA["User PWA\n/me/*\n(mobile-first)"]
    WsPWA["Org PWA\n/ws/:slug/*\n(desktop-first)"]
    MarketingSite["Marketing Site\n/ /for-teams /pricing\n(static SSR)"]
  end

  subgraph Edge["Edge Middleware"]
    Proxy["proxy.ts\nJWT signature check\nRoute protection\nSets x-user-id header"]
  end

  subgraph AppServer["Next.js App Server (Node.js)"]
    AuthRoutes["Auth Routes\n/api/auth/*"]
    CheckinRoutes["Checkin Routes\n/api/checkin/*"]
    WSRoutes["Workspace Admin Routes\n/api/ws/:slug/*"]
    MeRoutes["User Routes\n/api/me/*"]
    PushRoutes["Push Routes\n/api/push/*"]
    V1Routes["API v1\n/api/v1/checkin\n(Bearer token)"]
  end

  subgraph LibLayer["Library Layer"]
    Auth["lib/auth.ts\nJWT · bcrypt · OTP\ncookies · getServerUser()"]
    Signals["lib/signals.ts\nqueryWorkspaceEvents()\nAND semantics\nsignal matching"]
    PushLib["lib/push.ts\nsendPushToUser()\nVAPID · web-push"]
    Plans["lib/plans.ts\nplan limits\nhistory gates"]
    Geo["lib/geo.ts\nhaversine · IP geo\nreverse geocode"]
    Trust["lib/trust.ts\nevaluateTrust()\ntimezone · device"]
  end

  subgraph DBLayer["Database Layer"]
    DBIndex["lib/db/index.ts\nSQLite (dev) ↔ Turso (prod)"]
    Queries["lib/db/queries/\nusers · events · workspaces\nsignals · stats · tokens · push"]
    Schema["lib/db/schema.ts\n13 tables"]
  end

  Client -->|HTTPS| Edge
  Edge -->|forwards with headers| AppServer
  AppServer --> LibLayer
  LibLayer --> DBLayer
  SW -.->|push subscription| PushRoutes
  PushLib -.->|Web Push| SW
```

---

## 3. Database Schema — Entity Relationships

```mermaid
erDiagram
  users {
    string id PK
    string email
    string password_hash
    string full_name
    string timezone
    datetime deleted_at
    datetime created_at
  }

  otp_codes {
    string id PK
    string email
    string code_hash
    int attempts
    datetime expires_at
    datetime used_at
  }

  user_api_tokens {
    string id PK
    string user_id FK
    string name
    string token_hash
    string token_prefix
    string scopes
    datetime last_used_at
    datetime revoked_at
  }

  revoked_tokens {
    string jti PK
    datetime expires_at
  }

  rate_limit_log {
    string id PK
    string key
    string action
    datetime created_at
  }

  presence_events {
    string id PK
    string user_id FK
    string event_type
    datetime checkin_at
    datetime checkout_at
    datetime scheduled_checkout_at
    string checkout_reason
    float gps_lat
    float gps_lng
    float gps_accuracy_m
    float checkout_gps_lat
    float checkout_gps_lng
    float checkout_location_mismatch
    string wifi_ssid
    string checkout_wifi_ssid
    string ip_address
    float ip_geo_lat
    float ip_geo_lng
    string location_label
    string device_info
    string device_timezone
    string note
    string source
    string api_token_id FK
  }

  user_stats {
    string user_id PK
    int streak_days
    int total_checkins
    float total_hours
    int this_month_checkins
    int distinct_locations_this_month
    datetime updated_at
  }

  workspaces {
    string id PK
    string slug
    string name
    string plan
    string org_type
    string timezone
    datetime archived_at
    datetime created_at
  }

  workspace_members {
    string id PK
    string workspace_id FK
    string user_id FK
    string role
    string status
    string email
    string consent_token
    datetime consent_token_expires_at
    datetime joined_at
  }

  workspace_domains {
    string id PK
    string workspace_id FK
    string domain
    datetime verified_at
  }

  workspace_signal_config {
    string id PK
    string workspace_id FK
    string signal_type
    float gps_lat
    float gps_lng
    int gps_radius_m
    string wifi_ssid_hash
    float ip_geo_lat
    float ip_geo_lng
    int ip_proximity_m
  }

  admin_overrides {
    string id PK
    string workspace_id FK
    string event_id FK
    string admin_user_id FK
    string reason
    datetime created_at
  }

  push_subscriptions {
    string id PK
    string user_id FK
    string endpoint
    string p256dh
    string auth
    datetime created_at
  }

  users ||--o{ presence_events : "records"
  users ||--o{ user_api_tokens : "owns"
  users ||--o{ user_stats : "has"
  users ||--o{ workspace_members : "joins via"
  users ||--o{ push_subscriptions : "subscribes via"
  workspaces ||--o{ workspace_members : "has"
  workspaces ||--o{ workspace_domains : "has"
  workspaces ||--o{ workspace_signal_config : "configures"
  workspaces ||--o{ admin_overrides : "logs"
  presence_events ||--o{ admin_overrides : "overridden by"
```

---

## 4. Key Design Decisions

### 4.1 Signal AND Semantics — Core USP

Every configured signal type **must** match for a check-in to be `verified`. Partial matches are tracked but don't count as office presence. See [`signal-matching.md`](./signal-matching.md).

```
configured: [GPS, WiFi]

event A: GPS ✓  WiFi ✓  → verified   ✅ counts as office
event B: GPS ✓  WiFi ✗  → partial    ⚠️ doesn't count
event C: GPS ✗  WiFi ✗  → none       ❌ doesn't count
event D: (override)      → override  ✅ counts as office
```

### 4.2 Two-Tier Auth: Edge vs Node

| Layer | What it does | Why |
|-------|-------------|-----|
| Edge (proxy.ts) | JWT signature verify only | Fast, no DB access, blocks unauthenticated requests at CDN |
| Node (route handlers) | Full `getSessionFromCookies()` — includes revocation check | Revocation requires SQLite/Turso query |

### 4.3 Immutable Events

`presence_events` rows are **never updated or deleted** after insert (except `note` field). Admin corrections go in `admin_overrides`, not the original event. This preserves a full audit trail.

### 4.4 Soft Deletes

`users.deleted_at` and `workspaces.archived_at` — data is never hard-deleted. The `deleted_at IS NULL` filter is placed on the **JOIN condition** for LEFT JOINs (not in WHERE) to avoid converting LEFT JOINs into INNER JOINs.

### 4.5 Plan History Gates

`queryWorkspaceEvents()` applies a history gate before querying events:

| Plan | History |
|------|---------|
| free | 3 months |
| starter | 12 months |
| growth | 7 years |

### 4.6 API Token O(1) Lookup

Raw token = `prefix (8 chars) + secret`. `token_prefix` is stored in DB and indexed. On `POST /api/v1/checkin`:

1. Extract prefix from bearer token header (O(1))
2. Query `WHERE token_prefix = ?` → small candidate set
3. bcrypt.compare only over candidates

Avoids O(n) bcrypt comparison over all active tokens.

---

## 5. Request Lifecycle

```mermaid
sequenceDiagram
  participant B as Browser
  participant E as Edge (proxy.ts)
  participant N as Node.js Route
  participant D as Database

  B->>E: Request + cm_session cookie
  E->>E: verifyJwt(signature only)
  alt invalid signature
    E-->>B: 302 /login
  end
  E->>E: Set x-user-id, x-user-email headers
  E->>N: Forward request + headers
  N->>D: getSessionFromCookies() — checks revoked_tokens
  alt jti revoked
    N-->>B: 401 UNAUTHORIZED
  end
  N->>N: getServerUser() reads x-user-id header
  N->>D: Business logic queries
  N-->>B: JSON response
```

---

## 6. Technology Choices

| Decision | Choice | Reason |
|----------|--------|--------|
| Framework | Next.js 16 App Router | SSR + API routes in one project, edge middleware |
| Database (dev) | better-sqlite3 | Zero config, fast, local file |
| Database (prod) | Turso (libSQL) | SQLite-compatible, distributed, edge-friendly |
| Auth | Custom JWT (jose) | No vendor lock-in, full control over cookie settings |
| Email | Resend | Simple API, reliable delivery, free tier |
| Push | VAPID / web-push | Open standard, works on Chrome/Safari/Firefox |
| Geocode | Nominatim | Free, no key, OSM data |
| IP Geo | ip-api.com | Free, no key, 45 req/min |
| Styling | Tailwind v4 utility-only | No component library = no visual debt |
| Cookie SameSite | Lax (not Strict) | Strict caused PWA session loss on iOS/Android cold-opens |
