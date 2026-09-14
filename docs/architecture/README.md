# Venzio - Architecture Documentation

> Last updated: 2026-08-31
>
> Technical reference for the Venzio presence intelligence platform.
> All diagrams use [Mermaid](https://mermaid.js.org/) - rendered automatically on GitHub.

---

## Documents

| Document | What it covers |
|----------|---------------|
| [HLD.md](./HLD.md) | System context, application architecture, the full 28-table ERD, key design decisions, request lifecycle, technology choices |
| [permissions.md](./permissions.md) | The resource × action catalogue, `Scope`, the seeded owner/admin/member grids, `requireWsAccess`, the screen registry, the three escalation guards, and why rank alone is not a ceiling |
| [auth-flow.md](./auth-flow.md) | Login/register state machine, OTP flow (and its plaintext storage), forgot password, session lifecycle, API token auth |
| [signal-matching.md](./signal-matching.md) | AND semantics for **gps + ip** (WiFi removed), `MatchedBy`, `queryWorkspaceEvents()` internals, config-light mode, admin overrides, day-level attendance |
| [checkin-flow.md](./checkin-flow.md) | Check-in/checkout sequences, what is actually stored, the member-configured session ladder and auto-checkout, extend, V1 API |
| [leave-flow.md](./leave-flow.md) | Leave types, pro-rata accrual and opening balances, the cutover date, request → approval, holidays, the maternity lifecycle |
| [employee-records.md](./employee-records.md) | The `employees` / `employment_details` / `employee_sensitive` split, AES-256-GCM field encryption, and the `employees:read` design gap |
| [assets-and-documents.md](./assets-and-documents.md) | Asset lifecycle and the document store, plus the base64-in-DB storage decision and its exit criteria |
| [reminders.md](./reminders.md) | Why approvals notify reliably, why scheduled reminders previously could not exist, the workspace pass over its members' own times, its five skip gates, and the known remaining gaps |
| [notification-flow.md](./notification-flow.md) | The two-category model, the `notify()` seam and the two push-only paths that bypass it, where member schedules live, the in-app feed, bell/panel, Web Push subscription, SW push handler, tags, cleanup |
| [workspace-flow.md](./workspace-flow.md) | Workspace creation (roles seeded in the same transaction), invites + consent, domain verification, signal config, dashboard/analytics queries, archive, ownership transfer |

---

## Quick Reference - Current State

### Permissions
- `requireWsAdmin()` is **gone**. Every `/api/ws/:slug/*` route calls
  `requireWsAccess(request, slug, Resource, Action)`.
- 17 resources × up to 3 actions, stored as a JSON grid on `workspace_roles`.
- Three guards on every write: `guardSystemRole`, `guardCatalogue`,
  `guardEscalation` — the last one also runs on **role assignment**, because
  every custom role shares `CUSTOM_ROLE_RANK` and rank alone is not a ceiling.
- The workspace creator is the `owner`; only `owner` holds `ownership`.

### Signal Matching
- **AND semantics** across configured types. Only **`gps`** and **`ip`** exist —
  WiFi was removed in `d0a0dca`.
- `MatchedBy`: `verified` | `partial` | `none` | `override`.
- **Config-light (no signals) now yields `verified`, not `none`.**
- Day-level stats must go through `src/lib/attendance-summary.ts`.

### Auth
- JWT (HS256, 30d) in `cm_session`, httpOnly, SameSite=Lax.
- OTP: 6 digits, 10-min expiry, 5 attempts, 3 sends per 15 min, purpose-scoped,
  **stored in plaintext** in `otp_codes.code`.
- API tokens: O(1) prefix lookup (`token_prefix` + `idx_api_tokens_prefix`).

### Notifications
- **Control is partitioned by who the message is for.** The organisation
  broadcasts **two categories**, `approvals` and `announcements` — both
  workspace-switchable on `/ws/:slug/settings`, neither member-mutable. The
  member sets **schedules**: reminder times per workspace
  (`member_reminder_prefs`) and the session ladder per account
  (`member_presence_prefs`). A category is a class of message and a schedule is a
  time; **having a value set is the opt-in**, so there is no boolean beside it.
- In-app feed in the `notifications` table; `NotificationBell` polls an
  unread-count endpoint every 30 s, `NotificationPanel` renders the last 20.
  Only the two categories write to it.
- Approvals, submissions and announcements notify **inline in the handler**
  through `notify()` — reliable, two channels.
- The reminder pass and the session ladder are **push-only** and bypass
  `notify()` — invariant 24's two sanctioned exceptions, because there is no feed
  row to write and no category to resolve.
- Both cron passes run from `POST /api/push/cron`, triggered by GitHub Actions at
  `0,30 * * * *`; reminders dedupe on `reminder_log`, ladder rungs on
  `presence_events.push_reminders_sent`.
- The client no longer schedules ladder or auto-checkout timers; the cron does.
  `scheduled_checkout_at` is the member's own `auto_checkout_after_h`, clamped to
  `[1, 24]` — never a fixed 12h, though 12 is still the default.

### Workforce modules
- Employees: three-table split; PAN / Aadhaar / bank account AES-256-GCM
  encrypted, four other "sensitive" fields in plaintext.
- Leave: pro-rata calendar-aligned accrual + opening balances + cutover date;
  requests are created `pending` and go through approval.
- Maternity: its own mutable case table with a forward-only lifecycle.
- Documents: base64 in `employee_document_blobs` behind the `DocumentStore` seam.

### Rate Limits
- Login: 10 per IP per 15 minutes.
- Check-in: 10 per user per hour.
- Ownership transfer password: 5 per user per 15 minutes.
- Stored in `rate_limit_log` (sliding window).

---

## Known Gaps and Deferred Work

Each is documented in full where it belongs; this is the index.

| Area | Gap | Where |
|------|-----|-------|
| Employee data | Any holder of `employees:read` gets decrypted PAN / Aadhaar / bank account — there is no separate sensitive-data permission | [employee-records.md](./employee-records.md#3-known-design-gap--employeesread-decrypts) |
| Reminders | ~~No per-member opt-out~~ — closed by per-member schedules, not by a mute | [reminders.md](./reminders.md#41-no-per-member-opt-out--closed-and-then-closed-differently) |
| Reminders | Push-only: a failed or denied push leaves no feed row and still burns the day's `reminder_log` slot | [reminders.md](./reminders.md#44-push-failures-are-swallowed-after-the-log-row-is-claimed) |
| Reminders | Timezone and working days are workspace-wide | [reminders.md](./reminders.md#42-workspace-wide-timezone-and-working-days) |
| Reminders | Overnight shifts are invisible to the check-out pass | [reminders.md](./reminders.md#43-overnight-shifts-are-uncovered-by-the-checkout-pass) |
| Reminders | Push failures are swallowed after the `reminder_log` row is claimed | [reminders.md](./reminders.md#44-push-failures-are-swallowed-after-the-log-row-is-claimed) |
| Auth | OTP codes are stored in plaintext | [auth-flow.md](./auth-flow.md#7-otp-security-properties) |
| Storage | Base64-in-DB is a deliberate trade; revisit at ~2 GB or on serverless memory pressure, target S3 `ap-south-1` | [assets-and-documents.md](./assets-and-documents.md#exit-criteria--when-to-move-to-s3) |
| Plans | `plan.maxLocations` is advertised but not enforced by the signals route | [signal-matching.md](./signal-matching.md#11-performance-notes) |
| Permissions | `AccessContext.visibleMemberIds` is every active member for every role; scope narrowing (`Subtree`) is not built | [permissions.md](./permissions.md#5-requirewsaccess--the-single-door) |
| Notifications | Only `owner`/`admin` are notified of new submissions — a custom role with `approvals:write` is not | [leave-flow.md](./leave-flow.md#3-request--approval) |
