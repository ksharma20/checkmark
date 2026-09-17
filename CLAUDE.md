# CheckMark - CLAUDE.md

## Product Overview

CheckMark is a **presence intelligence platform**. Two PWA surfaces:
- `/me/*` - mobile-first, individuals record their own presence
- `/ws/:slug/*` - desktop-first, org admins query presence data

**Core USP:** Multi-signal presence verification (AND, not OR). When a workspace has GPS + WiFi + IP signals configured, ALL must match for a check-in to count as verified. This makes faking presence extremely difficult.

**Multi-workspace users:** One account can hold multiple active workspace memberships, and **an account may create as many workspaces as it likes** — `POST /api/workspace` no longer answers `403 WORKSPACE_LIMIT_REACHED`, which refused anyone who merely held org access in somebody else's workspace. `presence_events` rows do not store `workspace_id`; verification is always computed for a chosen workspace. On `/me` that workspace is the **active workspace** (see below), and **`/me/timeline`** is scoped to it whenever there is one: it calls `GET /api/me/ws/[slug]/events`, which runs `queryWorkspaceEvents()` for that workspace and the current user so transparency matches admin-side AND semantics.

**And a user with NO workspace is not blocked.** `/me` is a product on its own: a person records their own presence and reads their own history with no organisation at all. With no active membership, `/me/timeline` falls back to `GET /api/events` — the unscoped personal history, which carries no `matched_by` because there is nothing to verify against — and says so in one line (`meSettings.timeline.personalOnlyNote`) rather than showing a column of chips that silently vanished. **This is not the retired "All workspaces" view coming back.** That was a *third* reading offered beside two real ones, chosen from a second picker this surface no longer has; the fallback is reachable only when there is nothing to scope to, is never a choice, and adds no picker.

---

## The `/me` Surface Conventions

### One workspace selector

The top-bar pill in `src/components/user/MeTopbar.tsx` is the **single source of truth** for the active workspace on `/me`. Every screen below it — home, Timeline, Leave, Profile, Documents, Announcements, the roster — reads `useWorkspaceScope()` from `src/app/me/workspace-scope.tsx` and scopes its fetches to that slug.

It is backed by the `cm_ws` cookie (`en.constants.cookieWorkspace`), written from the browser by `workspace-scope.tsx` and read on the server by `resolveActiveWorkspaceSlug()` in `src/app/me/active-workspace.ts`. **Deliberately not httpOnly** — it is a UI preference, not a credential, and `src/app/me/layout.tsx` is a Server Component that must read it to paint the pill correctly on first render. `localStorage` cannot do that.

Resolution order, everywhere: **`?ws=` → cookie → first active membership.** The server validates the value against the memberships it just loaded before seeding the provider, and the provider only ever resolves to a slug in that server-supplied list — a stale or forged value falls back to a real membership rather than naming someone else's workspace. This is UI hygiene, not access control: every `/api/me/ws/[slug]/*` route re-resolves the slug through `requireWsMember()` regardless.

**No screen may add its own workspace picker.** `/me/timeline` used to have one — a second dropdown under the pill, which could disagree with it — and no longer does.

### With no workspace, `/me` still works

The pill reads **No workspace** and links to `/me#join`, and the home screen puts
a **create-or-join card** (`src/app/me/JoinWorkspaceCard.tsx`) where the
attendance stat grid would be. It is a normal card on a normal page — check-in
still works, the timeline still reads back, and nothing is gated behind it. The
card it replaced said "No workspace yet / once you join one your summary shows up
here" and offered no way to join one: it named the missing thing and stopped.

Three routes in, all of them already in the codebase; **no join-request table and
no new endpoint were added**:

| Offer | How |
|---|---|
| Create a workspace | a link to `/ws/new` |
| A pending invitation for this email | `POST /api/me/consent`, the same call `/me/orgs` and `/join/[slug]` make — including the `410 INVITE_EXPIRED` handling, where the row stays and re-marks itself Expired so Decline still works |
| A workspace whose **verified domain** matches the email | a link to `/join/[slug]`, which runs `autoEnrolIntoWorkspace()` server-side |

Everything the card renders is resolved in `src/app/me/page.tsx` — a Server
Component — and only when there is no workspace, so a member of one never pays
for those queries and a new account's first screen is one render rather than
three client waterfalls.

The **workspace name is printed on every row**, which is the exception the rule
below names: this is the one place on `/me` where the reader is *choosing
between* workspaces, so the name is the information. The pill above says "No
workspace", so it is not repeating anything either.

**Pending invitations do NOT appear in the notification bell.** An invitation is
a `workspace_members` row, not a `notifications` row, and nothing fans one out.
`MeTopbar.tsx` claimed otherwise in a comment, which made the empty bell read as
a bug. Answering an invitation happens on this card or on `/me/orgs`.

### Workspace naming

Inside content already scoped to the active workspace, **do not print the workspace name**. The pill above already answers "which one", and repeating it is noise (the profile sheet shows the role name, not the workspace).

Where the user is *choosing between* or *comparing* workspaces, the name **stays** — there it is the information, not decoration:
- the switcher sheet in `MeTopbar`
- `/me/orgs` (invites + memberships)
- the `/ws` workspace picker
- the workspace name editor in Settings
- consent invitation emails
- the sole-admin deactivation blocker in `/me/settings` — it lists *which* workspaces are blocking
- the leave-workspace confirm dialog on `/me/orgs` (`en.meOrgs.leaveConfirm(wsName)`)

Scoped to `/me`. The `/ws` admin surface keeps its workspace name in the topbar — it is a different surface with a different question.

### Notification split

Both entry points land on `/me/notifications`; the `?ws=` query param is what distinguishes them.

| Entry point | URL | Shows |
|---|---|---|
| Top-bar bell | `/me/notifications?ws=<active slug>` | The active workspace only, no per-row badges — the heading already names it. Polls `GET /api/me/ws/[slug]/notifications/unread-count` |
| Avatar sheet → Notifications | `/me/notifications` | Every workspace, each row badged with its workspace colour. Polls `GET /api/me/notifications/unread-count` |

**`/me/announcements`** is the member's policy archive — every notice posted to the active workspace, with any attached policy document. It is reached from the avatar sheet, not the bottom nav, which carries four tabs — Timeline, Home, Space, Leave — and grows one only for a surface used daily (`/me/space` earned the fourth; an archive read a few times a year did not); and it is where an `announcement` notification now lands, because a notification row has nowhere to put a file.

`?ws=` is validated server-side in `src/app/me/notifications/page.tsx` against real memberships; a bogus slug falls back to the unified view. The client never reads `?ws=` itself. With no workspace at all the bell falls back to the global feed — that is where a pending invitation shows up.

### What a member configures, and where it is scoped

`/me/settings` shows **no notification categories at all** — the two that exist are the organisation's and are configured on `/ws/:slug/settings`. What a member sets there are two schedules, and they are scoped differently on purpose:

| Setting | Scope | Stored in |
|---|---|---|
| Check-in / check-out **reminder times** | **per workspace** — the active one, under the top-bar pill | `member_reminder_prefs` |
| The **session ladder** (half-day, full-day, repeat, close-my-session-after) | **account** | `member_presence_prefs` |

The reminder times obey the single-selector rule like every other `/me` screen: they read `useWorkspaceScope()` and belong to the workspace the pill is pointing at. **No second picker may appear beside them** — the times are per workspace precisely because the timezone, the working days, the holiday calendar and the leave that gate them are, and a member of two workspaces sets each one under its own pill.

The ladder is account-level and says so in its own copy, because `presence_events` carries no `workspace_id`: one open session, one ladder. Without that sentence a member of two workspaces looks for it under each and concludes it is missing from one.

**Having a value set is the opt-in.** There is no on/off toggle beside either — see Notification preferences for why a boolean next to a stored time is a second source of truth for one fact.

**Which is why the time field commits on BLUR, never on change.** Clearing the
box to retype a time and clearing it to switch the reminder off are the same
keystrokes — they differ only in what happens next, and a debounce cannot see
"next"; blur is exactly it. Committing per keystroke sent `null` the instant the
field went empty, so an interrupted edit silently turned the reminder off, and
overlapping PATCHes let a failed one revert a value the member had already
replaced. Deliberate clearing still turns it off — leave the field empty, or use
the **Turn off** button — and the badge keeps showing the SERVER's value while a
draft is uncommitted, so what is on screen is always what will actually be
delivered. A per-kind ticket counter drops out-of-order responses, and an
uncommitted draft is flushed on `pagehide` (not `beforeunload`, which does not
fire on iOS PWA backgrounding) with `keepalive: true`.

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
Every query that touches workspace data must include `AND workspace_id = ?`. No exceptions. Use `requireWsAccess(request, slug, Resource, Action)` from `@/lib/ws-access` to resolve slug → verified workspace ID before any query.

> `requireWsAdmin()` **no longer exists.** It was a binary "is this person an admin?" check and was removed when the permission model landed; `src/lib/ws-admin.ts` keeps only `requireWsMember()`, which authenticates an ordinary member for the `/me` surface and carries no permission meaning. Re-adding an admin-shaped gate bypasses the role system entirely.

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
  → matching only GPS = 'partial'
  → matching nothing = 'none' (still returned, just not verified)

Config-light mode (no signals configured):
  → every event from an active member is 'verified' — NOT 'none'
```

Config-light is a deliberate choice, not a fallback: a workspace that has configured nothing has nothing to fail against, so showing its whole team as unverified would be noise. See `src/lib/signals.ts` (`signals.length === 0` branch).

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

Workspace admins configure per-workspace leave types (`workspace_leave_types` table). Employees submit leave requests (`leave_requests` table) from `/me/ws/[slug]`. **Submissions land as `pending`, not `approved`** — an admin approves or rejects them from the Approvals queue. Only `approved` requests consume balance.

### Tables
- `workspace_leave_types`: `id, workspace_id, name, accrual_frequency ('monthly'|'quarterly'|'half-yearly'|'yearly'), accrual_credits, credit_timing ('start'|'end'), created_at, deleted_at` — soft-deleted, unique `(workspace_id, name) WHERE deleted_at IS NULL`
- `leave_requests`: `id, workspace_id, user_id, leave_type_id, start_date, end_date, reason, status DEFAULT 'pending', rejection_reason, actioned_by_user_id, created_at` — dates and type are fixed at insert; only the approve/reject columns ever change
- `leave_opening_balances`: `id, workspace_id, user_id, leave_type_id, balance_days, note, created_at, updated_at` — unique `(workspace_id, user_id, leave_type_id)`; migrated-in balances from whatever system the workspace used before

### Balance computation (no stored balance — always computed)
```
available_days = max(0, opening_balance + total_accrued − used_days)
```
Logic lives in `lib/db/queries/leaves.ts` — `getLeaveTypesWithBalance()` and `computeTotalAccrued()`.

- **Four frequencies**, 1 / 3 / 6 / 12 months per period: `monthly | quarterly | half-yearly | yearly`.
- **Periods are calendar-aligned, not join-date-anchored.** Quarterly boundaries fall on Jan/Apr/Jul/Oct, half-yearly on Jan/Jul, yearly on Jan.
- **The first period is pro-rata**: `accrual_credits × (time from the accrual start to the next period boundary ÷ length of that period)`.
- **`credit_timing` decides when a period's credits land.** `'start'` front-loads — the pro-rata first-period credits are available immediately, and each later period's credits at its start (the in-progress period counts). `'end'` back-loads — nothing until a period completes, so a brand-new member has `0`.
- **Accrual start** is `workspace_members.added_at`, unless the workspace's `leave_cutover_date` is later, in which case that date is used for *every* leave type (CheckMark takes over accrual from the cutover).
- **`opening_balance`** is added on top and is independent of the cutover.
- **`used_days` counts *working* days**, not calendar days: `countWorkdays()` from `src/lib/attendance-summary.ts` against the workspace's `working_days`. Only `status = 'approved'` requests count.
- Accrued totals are rounded to one decimal place.

### Admin API (`/api/ws/[slug]/leave-types`)
- `GET` — list active leave types
- `POST` JSON `{ name, accrual_frequency, accrual_credits, credit_timing? }` — create (`credit_timing` defaults to `'start'`)
- `PATCH /[id]` — partial update of `name`, `accrual_frequency`, `accrual_credits`, `credit_timing`. Validation deliberately does **not** share a helper with `POST`: POST coerces a missing field to a default, which is right when creating and wrong when patching, where an omitted field means "leave it alone". The duplicate-name check excludes the row being edited, or saving without renaming would `409` against itself.
- `DELETE /[id]` — soft-delete; existing requests unaffected. Requires `Leaves:Delete`, which the Settings page must resolve separately from `Leaves:Write` — it did not, so the button was shown to write-only roles and answered 403

> **Editing a leave type rewrites history.** No balance is materialised: `getLeaveTypesWithBalance()` recomputes `opening_balance + total_accrued − used_days` on every read. So changing `accrual_frequency`, `accrual_credits` or `credit_timing` retroactively changes the available balance of **every member** in the workspace, including for leave already taken. Renaming is inert. The edit form says exactly this, and must keep saying it.

### Admin approve / reject (`/api/ws/[slug]/leaves`)
- `GET` — all requests for the workspace
- `PATCH /[id]` JSON `{ action: 'approve' | 'reject', rejection_reason? }` — `rejection_reason` is required on reject. `actionLeaveRequest()` updates atomically with `WHERE status = 'pending'`, so a concurrent second action returns `409 ALREADY_ACTIONED` rather than double-processing. Also surfaced through the Approvals queue (`kind: 'leave'`).

### Employee API
- `GET /api/me/ws/[slug]/leave-types` — list types with `available_days` for current user
- `POST /api/me/ws/[slug]/leave` JSON `{ leave_type_id, start_date, end_date, reason? }` — submit as `pending`; returns `400 INSUFFICIENT_BALANCE` if the requested *working* days exceed the balance

### Leave requests are append-only
Never delete a `leave_requests` row, and never edit its `start_date`, `end_date`, `leave_type_id` or `user_id`. The **only** mutation allowed is the approve/reject transition out of `pending` — `status`, `rejection_reason`, `actioned_by_user_id` — and it goes through `actionLeaveRequest()`. A correction is a reject plus a new request, never an edit.

---

## People — one tab, not two

**`/ws/:slug/employees` does not exist.** The HR directory merged into
**`/ws/:slug/people`**, and the sidebar slot it used to occupy is now
**`/ws/:slug/org`**, the reporting tree.

The split was deliberate once — membership and HR records are different jobs with
different risks — and it stopped being real when the employee directory started
listing every member. Two screens then showed the same people from opposite
tables and disagreed on the headcount: the employee side filtered
`status='active' AND user_id IS NOT NULL`, so anyone who had not accepted their
invitation was simply missing from it.

### What People is now

Every `workspace_members` row, with the HR record overlaid where one exists, and
**invited people included**. Server-side search, a department filter and one
status control. Backed by `GET /api/ws/[slug]/members`.

**The permission split survived the merge and is the reason this is not just a
rename:** `members:read` opens the page; `employees:read` is what reveals the HR
columns, and the route **strips those fields server-side** for a viewer without
it. A column omitted from the table while still in the JSON is not a permission
check. The strip is an allow-list, not an omit-list — a deny-list starts leaking
the day someone adds a column to `MemberWithUserFull`.

### The join must survive a NULL user_id

`MEMBER_EMPLOYEE_JOIN` matches on `e.user_id = wm.user_id` **OR**, when the
membership has no user yet, on `lower(e.work_email) = lower(wm.email)`. An
invited person has NULL on both sides and `NULL = NULL` is not true in SQL, so
the id join alone silently drops their HR data until they accept.
`idx_employees_ws_work_email` is UNIQUE per workspace, so the fallback cannot fan
one member out into two rows.

### One status control over two columns

| Filter value | Reads |
|---|---|
| `invited` / `declined` | `workspace_members.status` |
| `active` | active membership **and** (`employee_status = 'active'` **or no record at all**) |
| `terminated` `suspended` `on_leave` `notice_period` | active membership + `employees.employee_status` |

`active` includes a member with no HR record because that is what the table's
status column *labels* them. A filter that disagrees with its own column is
worse than no filter. **Onboarding** and **Probation** are derived from dates and
are display states only — deliberately not filterable.

### Row actions are one link

No role dropdown, no status control, no "Add details" fork. One **Edit** link to
`/ws/:slug/people/[memberId]/details`, plus remove. Changing a role from a
`<select>` inside a table row made a consequential change feel like sorting a
column, and left nowhere to state the consequence.

**The details route is keyed on `workspace_members.id`, not a user id** — an
invited person has no user row, and they are exactly who an admin most needs to
open. It also resolves an `employees.id` in that segment, so the approvals queue
can deep-link a pending document straight to the Documents tab.

Three tabs, three independent gates: **Profile** (`employees:read`),
**Documents** (`documents:read`), **Access** (always — `members:read` opened the
page). Access holds the role select, the reporting-manager select and removal;
they are three writes to three endpoints, never one Save button, because they
land in different tables and fail independently.

### Add employee, then offer the invite

`/ws/:slug/people/new` replaces the old inline "invite someone" email box. An
email address alone was never enough to run payroll, holidays or documents
against, and it left every joiner as a row nobody had filled in.

The record is created **first**, the invitation offered **second** — a cancelled
dialog must not throw a five-step form away. "Send invite" posts to the existing
`POST /api/ws/[slug]/members`; `DOMAIN_AUTO_ENROL` is reported as good news, not
an error. Where an employee record already exists for that address, the consent
email greets them by the name on it.

### Sending an invitation IS `pending_consent`

`upsertInvitedMember()` sets `status = 'pending_consent'` with every new token,
on the update branch as well as the insert. It used to refresh the token and
leave the status alone, which is why *the main admin flow did not work*: a row
created by **Add employee** is `no_access`, a re-invited leaver is `declined` or
`revoked`, and a valid seven-day link went out while every accept path read the
status, found it was not `pending_consent`, and answered "Link already used".
`user_id` is deliberately untouched — an existing account keeps its link, a
stranger stays NULL until they accept.

**Re-sending is the ordinary repair, not an error.** `POST
/api/ws/[slug]/members` no longer answers `409 INVITE_PENDING`; every send mints
a fresh 7-day token, so the previous link dies the moment the new one is issued.
It returns `{ resent }` — keyed on whether the row already had a `consent_token`,
which is the only thing that says an invitation was ever sent — and the Access
tab says which of the two happened. `409 ALREADY_MEMBER` and
`409 DOMAIN_AUTO_ENROL` are unchanged.

### Expiry is enforced in `acceptMembership()`, once

`isInviteExpired()` is the rule; `acceptMembership()` is the only place it gates
a write, returning `EXPIRED` → `410 INVITE_EXPIRED`. It used to live on the
emailed consent page alone, so `/api/me/consent`, `/join/[slug]` and `/me/orgs`
all accepted invitations that had expired weeks earlier. The consent page still
asks the question before sending a logged-out visitor round the login flow, but
it asks it through the same function — one rule, two call sites, nothing to
drift. Expiry is checked **after** the email match, so a hijacker is told
`WRONG_ACCOUNT` and learns nothing about the invitation.

**`declineMembership()` is deliberately not expiry-checked.** Refusing something
you no longer want must never fail. `/me/orgs` therefore renders an expired
invitation as **Expired** with "ask an admin to send you a new one" — the row
stays on the list with Decline still live, and only Accept goes.

### Linking the record to the account

An employee record can exist before its person has an account, so
`employees.user_id` stays NULL for the length of an open invitation.
`claimEmployeeForUser()` attaches it **at consent, not at sign-up**:
`acceptMembership()` claims it after the status flips to active, and
`autoEnrolIntoWorkspace()` claims it because *that path is the consent* — a
verified domain has already declared everyone on it staff and the member lands
`active` in one step. `claimPendingMemberships()`, which runs on registration,
links `user_id` and **nothing else**; it used to claim the record too, attaching
payroll, documents and encrypted PAN and bank details to an account that had
agreed to nothing. Registering with an invited email leaves the invitation
pending: signing up is not consent.

`src/lib/membership.ts` is the shell that owns all of this: it spans two
domains, and `employees.ts` already imports `workspaces.ts`, so putting it in a
query file would close an import cycle. Every accept path goes through it —
consent page, `/api/me/consent`, registration, verified-domain auto-enrol.

`POST /api/me/consent` now checks the member row's email against the session
email before acting. It previously accepted any `memberId` from any signed-in
caller, which with record-claiming would have handed over somebody else's
decrypted PII.

---

## Reporting hierarchy

**One nullable column is the org chart:** `workspace_members.manager_user_id`.
No join table, one manager per person.

NULL means "not explicitly assigned" and is resolved to the workspace **owner at
read time** (`src/lib/hierarchy.ts`), never written. Storing the owner's id on
every unassigned row would need a rewrite of them all on each ownership
transfer, and would make "never assigned" indistinguishable from "deliberately
reports to the owner".

`employment_details.reporting_manager_id` (→ `employees.id`) is **vestigial**.
The column still exists and the write path still accepts it; nothing reads it as
truth. A hierarchy keyed on employee records would only contain the people HR
has filled in — one row out of 34 in the live workspace.

### `src/lib/hierarchy.ts` is pure

No database access, no imports from the query layer. Callers fetch flat
`(userId, managerUserId)` pairs and hand them in. Deliberately **not** a
recursive CTE: a 500-person company is 500 tiny rows, and doing the walk in
JavaScript means it behaves identically on better-sqlite3 in development and
libSQL in production. `MAX_DEPTH = 64` guards every walk — 64 levels of
management is not a hierarchy, it is corruption.

`buildReportingTree` · `subtreeOf` (includes self) · `ancestorsOf` (excludes
self) · `wouldCreateCycle` · `directReportsOf` · `unassignedMembers`.

The org chart and the write guard use the same module, so the picture and the
refusal can never disagree about who is under whom.

### Routes

- `GET /api/ws/[slug]/hierarchy` — every active member with their manager, plus
  `ownerUserId` (the root; inferring it from `role === 'owner'` client-side
  breaks the moment a custom role is named that)
- `PATCH /api/ws/[slug]/hierarchy` — `{ userId, managerUserId | null }`;
  `409 CYCLE_DETECTED`, `400 SELF_MANAGER`, `400 NOT_A_MEMBER`

**Gated on `Resource.Employees`, not a resource of its own.** ven-112 introduced
a `hierarchy` resource; it was not ported, because adding a Resource means
rewriting every seeded role grid in `system-roles.json` (invariant 12) for a
distinction nobody has asked for. Revisit when a customer wants an HR role that
may hold a record but not restructure the org.

**`Scope.Subtree` was deliberately NOT merged.** Invariant 14 stands: data scope
is the surface, not the role, and every `/ws` role is `Scope.All`.

### Departures re-parent, they do not orphan

`reparentReportsOf()` runs on both exits, and the ORDER differs because the two
paths differ:

| Path | Order | Why |
|---|---|---|
| `DELETE /api/ws/[slug]/members/[memberId]` | **before** the delete | `removeWorkspaceMember` hard-deletes; the row it reads must still exist |
| `DELETE /api/me/workspaces/[workspaceId]` | **after** the leave | `leaveWorkspace` can refuse (sole admin), and the row only goes to `revoked` |

Without it nothing dangles — `buildReportingTree` treats an unknown manager as
absent — but a whole subtree would silently roll up to the owner instead of to
whoever actually inherits them.

### The chart at `/ws/:slug/org`

Hand-rolled, no layout library. A strict tree never needs edge routing that
avoids nodes, which is the only thing a graph engine would buy. Collapse/expand
is a `Set` of ids; search reveals a match by un-collapsing `ancestorsOf()` and
centring it. The zoom step is a `data-zoom` attribute resolved to `--org-zoom`
**in `globals.css`** — a custom property written inline would sit outside the
reduced-motion and touch-target selector lists (invariant 15).

**It is an indented outline, not a top-down chart.** Siblings used to sit in a
row joined by a horizontal rail, so a workspace with real headcount opened as a
horizontal scroll and depth — the only thing the screen is for — was squeezed
out of view. Depth is now indentation, which costs no width past the deepest
branch. Do not put the levels back side by side.

Three pieces of geometry hold it together, and each is load-bearing:

| | |
|---|---|
| `.org-node::before` / `::after` | The shared **spine** and this node's **elbow**, both hanging 22px left of the node. `.org-branch` pays for that with `padding-left: 44px`, which is what lands the spine on the centre of the parent's 44px chevron. |
| `.org-node:last-child::before` | Clips the spine to the last elbow. Without it the line runs on past the final card and down the side of its subtree, drawing a branch to nobody. |
| `.org-row { min-height: 64px }` | The sibling gap lives **inside** the node, never as a `gap` on `.org-branch` — a gap between nodes would slice the spine at every row. |

The card is a fixed 56px with both lines clipped to one line and a `title`
carrying the full value. That is not a density choice: a card of unpredictable
height has no knowable centre, so the elbow above it would have nothing to
anchor to. A leaf renders `.org-toggle-spacer` in place of the chevron so its
card keeps the level's `x`.

---

## Approvals

**`/ws/:slug/disputes` does not exist.** It was superseded by **`/ws/:slug/approvals`** — one queue holding three kinds of pending item, discriminated by `kind`:

| `kind` | What it is | Backing table |
|---|---|---|
| `leave` | A leave request awaiting action | `leave_requests` |
| `regularization` | An employee asking to correct a past day (`office` / `remote`) | `regularization_requests` |
| `doc` | An employee-uploaded document awaiting verification | `employee_documents` |
| `extension` | A member asking to extend an open parental-leave case by **unpaid** days | `parental_leave_extensions` |

`getPendingApprovalItems()` in `src/lib/approvals.ts` is the single source of truth, reused by the Overview widget and the Approvals page so both always agree.

**Approvals is the ONLY place a pending item is actioned.** It was previously actionable from five: this queue, a queue on `/ws/:slug/attendance`, a "Requests" tab on `/ws/:slug/leaves`, an echoed section on `/ws/:slug/people`, and the Overview widget. Four of those are gone — the attendance queue and its slide-over "Mark as present", the leaves Requests tab (and its `PATCH /api/ws/[slug]/leaves/[id]` route), and the People echo, which had **no permission gate at all**. The Overview widget stays because it is a five-item summary that links here.

Read-only **listings** of the same rows are fine and deliberately kept — the Applied-leaves tab still lists pending requests, with a status filter. Listing is not actioning. Do not re-add an approve/decline control anywhere but `/ws/:slug/approvals`. Routes: `GET /api/ws/[slug]/approvals`, `PATCH /api/ws/[slug]/approvals/[kind]/[id]` — `Resource.Approvals` (`Read` / `Write`; it has no `Delete`).

Approving a regularization does **not** edit a `presence_events` row: it writes an `admin_overrides` row and, where needed, a new regularized event. Invariant 7 still holds.

`kind: 'doc'` items are gated separately: `approvals:read` does **not** imply `documents:read`, so `getPendingApprovalItems()` takes the viewer's role and includes doc items only for a role holding `documents:read`. It is **fail-closed** — omitting the viewer hides the doc items rather than showing them, and the returned `doc` array and `items` are the same shortened truth so every count stays honest.

For a `doc` item, `user_full_name` / `user_email` come from the **employee record**, not the users table — a document can belong to an employee with no linked login yet, and the queue still has to name them.

---

## Assets

Workspace hardware register (`workspace_assets`). Soft-deleted, scoped by `workspace_id`, so a retired laptop's assignment history survives.

Status is one of `assigned | available | repair | retired`, mirrored by a `CHECK` on the column and by `isAssetStatus()` in `lib/db/queries/assets.ts`.

- `GET /api/ws/[slug]/assets` — list + category list + status counts (`?category=`, `?status=`). An unrecognised `status` is *dropped*, not 400'd: otherwise a stale bookmark becomes an error page.
- `POST /api/ws/[slug]/assets` — create. Validation lives in the route's `_validate.ts`; failures return `422 VALIDATION_ERROR` with a `fields` map.
- `PATCH /api/ws/[slug]/assets/[id]` — update · `DELETE` — soft delete
- `POST|DELETE /api/ws/[slug]/assets/[id]/assign` — assign to / unassign from an employee
- `GET /api/ws/[slug]/assets/export` — CSV

**Only the assign endpoint moves a holder.** `PATCH` changes fields; it never sets or clears `assigned_employee_id`. So it refuses both directions of the assignment boundary:

| Attempt | Answer |
|---|---|
| `PATCH` sets `status: 'assigned'` on an asset with no holder | `409 ASSIGN_VIA_ENDPOINT` |
| `PATCH` sets **any** other status on an asset that still has a holder | `409 RETURN_FIRST` |

The second check is keyed on `assigned_employee_id`, **not** on the current status, so a row already in a broken state cannot be patched further sideways. `assigned → retired` is therefore **not** a legal direct edge: `DELETE .../assign` is the only thing that clears a holder, and it is the only way out. `POST .../assign` additionally refuses a `retired` asset (`409 ASSET_RETIRED`) and one already held by someone else (`409 ALREADY_ASSIGNED`).

Guarded by `Resource.Assets` (`Read` / `Write` / `Delete`). The screen resolves all three: `Assets:Delete` gates the remove action, which for a long time had a working route and **no caller at all**.

Add and edit are one `AssetForm` modal keyed off an `initial` prop (the `HolidayForm` idiom), and the edit form **never sends `status`** — that is what keeps it clear of the two 409s above.

---

## Employee Documents

Two tables, deliberately split: `employee_documents` holds *metadata* (name, type, size, verification state) and is what every list query reads; `employee_document_blobs` holds the bytes and is touched only on upload and download. A join would drag megabytes through every folder view. Metadata is soft-deleted; the blob is **hard**-deleted alongside it — orphaned megabytes for a file nobody can reach are a storage leak, not an audit trail.

### The `DocumentStore` seam — `src/lib/storage.ts`

Bytes live in the database as base64 TEXT today. That is a deliberate trade (one Turso connection, no bucket, no signed URLs, no second failure domain), not a permanent decision, so **every byte enters and leaves through the `DocumentStore` interface**. Swapping in S3 becomes a config change plus one class in that file, touching no query file and no route.

Two rules keep the seam honest:
1. Nothing outside `storage.ts` and `db/queries/documents.ts` may see base64. Callers hand over and receive `Buffer`.
2. Bytes and metadata stay in separate tables (above).

Also in `storage.ts`: `MAX_FILE_BYTES` (2 MB), `ALLOWED_MIME_TYPES` (`application/pdf`, `image/png`, `image/jpeg`) and `sniffMimeType()`. **MIME type is decided by sniffing magic bytes, never by trusting `File.type`** — that string is attacker-controlled and would let an HTML or SVG payload be stored and served back under a benign `Content-Type`. Anything off the allowlist is a `415`.

`workspaceId` is a parameter on every `DocumentStore` method rather than being implied by the document id: it keeps the tenant boundary visible at the storage layer and would become the S3 key prefix.

### Lifecycle
`owner` is `admin` (company-issued: offer letter, contract → starts `issued`) or `employee` (employee-supplied: ID proof, payslips → `missing` → `pending` on upload → admin verifies). Status: `missing | pending | verified | rejected | issued`.

### Write order — a metadata row never names bytes that are not stored

The blob write and the metadata write cannot be one transaction (they are separate statements today and would be separate *systems* under S3), so the **order** is the correctness argument instead. Both upload routes follow it exactly:

1. **Clear or create the slot with no `file_name`** — an existing slot goes through `clearDocumentFile()`; a new one is created by `createDocument()` with `status: 'missing'` and `file_name` NULL.
2. `documentStore.put()` — write the bytes.
3. `markDocumentUploaded()` — only now does the row claim `file_name` / `mime_type` / `size_bytes`.

A crash at any point leaves either an honest empty slot or the truth — never a download that 404s, and never yesterday's rejected file wearing today's name.

**Delete is the mirror:** soft-delete the metadata first, *then* `documentStore.delete()`. Once the row is soft-deleted nothing can serve the file, so a failed byte delete leaves unreachable orphans rather than a live row pointing at shredded bytes.

Uploading into an occupied slot **replaces** the file on the existing row — a slot is a slot, and a partial unique index on `(workspace_id, employee_id, doc_key)` would reject a second insert anyway. Two uploads racing for the same *new* slot are answered `409 DUPLICATE_SLOT` (`DuplicateDocumentSlotError`), not a 500: the index, not the pre-read, is what decides the winner.

### Upload limits (the `/me` route)
- **20 uploads per hour per user** — `rate_limit_log`, key `documents:<userId>`, action `document_upload`. Checked *before* the body is read, so a rate-limited caller cannot push 2 MB through first. `429 RATE_LIMITED`.
- **40 live slots per employee** — `doc_key` is member-chosen and every unseen key mints a row, so without a ceiling one member can exhaust storage. Replacing the file in a slot they already own is never blocked by it.
- Re-uploading over a `verified` slot is refused (`409 ALREADY_VERIFIED`) — an admin deletes the slot if it genuinely needs replacing.
- The `owner` form field is **ignored** on the `/me` route: always `owner='employee'`, `status='pending'`. Letting a member self-declare a document company-issued would skip verification entirely.

### Routes
- Admin: `GET|POST /api/ws/[slug]/employees/[id]/documents`, `PATCH|DELETE .../[docId]`, `GET .../[docId]/file` — `Resource.Documents`
- Member: `GET|POST /api/me/ws/[slug]/documents`, `GET /api/me/ws/[slug]/documents/[docId]/file` — `requireWsMember()`, self only

The `.../file` routes are the *only* way bytes reach a browser, and they return real bytes with a `Content-Type`. No JSON route ever carries a payload.

---

## Parental leave (maternity + paternity)

`maternity_cases` — statutory parental leave tracked as a **case with stages**, not as a leave request. The table keeps its original name; `case_type` (`'maternity' | 'paternity'`, default `'maternity'`) is the discriminator. One table because the lifecycle, the date columns and the reminder gate are identical for both — only the entitlement differs.

**Constants and the `case_type` guard live in `src/lib/parental.ts`, which is pure** — no DB access, no query-layer imports, exactly like `src/lib/hierarchy.ts`. The reason is sharper here than there: the case-creation form is a **client** component, so importing a runtime value (`DEFAULT_CASE_WEEKS`) from `lib/db/queries/maternity.ts` pulls `lib/db/index.ts` into the browser bundle and with it better-sqlite3 and libSQL — a build failure whose error is a long `Can't resolve 'fs'` trace that names none of that. `import type` is erased and is always safe; a runtime import is not. `maternity.ts` re-exports them for its own callers.

**`case_type` has no CHECK constraint.** It was added by `ALTER TABLE`, and SQLite cannot attach a CHECK to a column added that way, so `isParentalCaseType()` in `lib/db/queries/maternity.ts` is the *only* thing standing between a route and a garbage value. Every write path must run its input through it.

Deliberately not modelled on `leave_requests`: those are immutable rows booked against an accrued balance, whereas a maternity case spans months, its dates shift as the due date moves, and an admin walks it through a lifecycle. Forcing it into an immutable table would mean deleting and re-creating rows, which those tables forbid.

Stages: `requested → approved → onleave → returned`. Forward-only, one step at a time, so a case cannot jump straight to `returned` and leave no record of the leave starting. The single backward edge `approved → requested` exists because an approval given in error must be revocable before the leave begins. Enforced by `canTransition()` in `lib/db/queries/maternity.ts`.

**One open case per employee, per case type**, guaranteed by the partial unique index `idx_parental_cases_one_open` on `(workspace_id, employee_id, case_type)`. It was renamed from `idx_maternity_cases_one_open` when the third column landed, and the **rename is load-bearing**: `scripts/migrate.js` swallows `already exists`, so re-issuing a `CREATE UNIQUE INDEX IF NOT EXISTS` under the old name with a new definition would be counted as skipped and leave the old two-column index in place — silently, with no failed run. A `DROP INDEX IF EXISTS` plus a `CREATE` under a new name is the only spelling whose outcome is observable. Never reuse a retired index name for a different definition.

`findOpenCaseForEmployee()` in the POST route is only a courtesy that turns the common case into a clean `409 CASE_OPEN` with no failed INSERT behind it — the pre-check and the insert are two statements, so the index is what actually holds. A lost race raises `MaternityCaseOpenError` and gets the same 409. Closed (`returned`) cases are history and do not block a later pregnancy.

**An open case may not have its `start_date` / `end_date` cleared.** The dates, not the status, are the reminder gate: `getActiveParentalUserIds()` matches `start_date <= today <= end_date`, so a case that keeps its status but loses a date drops silently out of the gate and the daily check-in reminder starts nagging someone on parental leave. That function is deliberately **blind to `case_type`** — the gate asks "is this person on parental leave", and narrowing it by type would let one kind through and resume the nagging. Dates may be *moved* while a case is open; clearing one returns `422 VALIDATION_ERROR` with `REQUIRED_WHILE_OPEN`. Only `returned` — where the gate no longer looks at the case — may hold nulls.

- `GET|POST /api/ws/[slug]/maternity` (both take/filter `case_type`), `PATCH|DELETE /api/ws/[slug]/maternity/[id]`
- `GET|POST /api/me/ws/[slug]/parental-extensions` — member, `requireWsMember()`. **`unpaid_days` is never read from the body**: `computeUnpaidExtensionDays()` derives it server-side with `countWorkdays()` over `(day after the case's current end_date … requested_end_date)`, using the workspace's `working_days` and holiday calendar, so weekends and company holidays are excluded. The `/me` form's live preview is a server round trip against that same function rather than a client copy of the rule, and the count is **recomputed at approval time** because the holiday calendar can change in between
- Guarded by **`Resource.Leaves`** — parental leave has no resource of its own.

`parental_leave_extensions` is the sibling table: a member's request to extend an open case by **unpaid** days. Append-only in the `leave_requests` sense — `case_id`, the dates and `unpaid_days` are fixed at insert and the only mutation is the approve/reject transition out of `pending`. `previous_end_date` is stored rather than derived so the request still records what it was extending from after the case's `end_date` has moved. Notification types `extension_submitted` / `extension_approved` / `extension_rejected` carry it — all three in the `approvals` category — with `ref_type: 'parental_extension'`.

---

## Billing

There is **no payment integration in this codebase and none is being added.** CheckMark is free and open source, and every plan is unlimited (see Plan Limits). The plan is still a column on the workspace row, but nothing in the app prices it or asks anyone to upgrade. The `/ws` topbar and the workspace picker no longer print the plan key either.

The Settings tab that used to be **Billing** is now **Ownership** (`src/app/ws/[slug]/settings/OwnershipTab.tsx`). It holds archive and restore and nothing else: the plan card, its limits list and the "Manage billing" no-op are gone, because a tab describing a plan that caps nothing was describing nothing. Archive and restore live there because they are gated on `Resource.Ownership`, labelled "Ownership" in the catalogue, and it is the only Settings tab shown to owners alone. The resource key, the permission keys and `system-roles.json` did not change (invariant 12) — only the visible label did.

---

## Announcements

A workspace-wide notice — a policy update, an office day, a closure. Posted from
Settings, delivered to every active member's in-app feed and phone.

`workspace_announcements` is the **canonical record** (soft-deleted, so an admin
can see and retract what they posted). **Delivery is a fan-out**: one ordinary
`notifications` row per active member, `type: 'announcement'`, `ref_type:
'announcement'`, `ref_id` the announcement id. That is what gives each recipient
their own read state, bell count and feed entry with no new machinery — the same
shape leave notifications already use to carry their subject.

**Write the announcement row first, then fan out.** A crash mid-fan-out leaves a
notice some people have and some do not, which is recoverable and visible. The
reverse order would push a notification whose `ref_id` points at nothing.

**Retraction is not a recall.** Soft-deleting hides it from the list and from
future reads; notifications and pushes already delivered stay where they are. The
confirm dialog says so rather than implying otherwise.

Gated by **`Resource.Announcements`** (read/write/delete), seeded to owner and
admin. Its own resource rather than a fold into `settings` because broadcasting
to everyone's phone is a different trust level from editing signal config — an HR
role should be able to do the first without the second.

Announcements may carry **attachments**: `announcement_attachments` (metadata,
soft-deleted) plus `announcement_attachment_blobs` (bytes, base64), the same
split and the same write order as employee documents — clear or create the slot
with no `file_name`, write the bytes, only then let the row claim them. A
notification row has nowhere to put a file, so a tapped announcement now opens
the member archive at **`/me/announcements`** rather than the notification list;
`notificationHref` resolves that, and nothing may hardcode the path.

- `GET|POST /api/ws/[slug]/announcements` (POST takes JSON **or** `multipart/form-data`) · `DELETE /api/ws/[slug]/announcements/[id]`
- `GET /api/ws/[slug]/announcements/[id]/attachments/[attachmentId]/file` — admin bytes
- `GET /api/me/ws/[slug]/announcements` · `GET /api/me/ws/[slug]/announcements/[id]/attachments/[attachmentId]/file` — member, `requireWsMember()`

Both `.../file` routes check the attachment belongs to that announcement **and** that workspace; the member one also loads the announcement, so a retracted notice's files stop serving immediately.

---

## Notification preferences

Notification control is partitioned by **who the message is for**. The
organisation broadcasts **categories**; the member sets **schedules**. Those are
not two halves of one switchboard — they are different kinds of thing, stored
differently, configured on different screens, and delivered down different
channels. The rest of this section is why.

### The organisation broadcasts categories. There are exactly two.

`src/lib/notifications/categories.ts` is the catalogue and the contract. Every
`NotificationType` maps to exactly one category, and `CATEGORY_OF` is a **total
`Record`** over that union — a new notification type with no category is a
compile error, not a notification that silently bypasses everyone's settings.

| Category | Covers | Scope | Workspace can switch | Member can mute | Channel | Configured on |
|---|---|---|---|---|---|---|
| `approvals` | `leave_submitted`, `regularization_submitted`, `extension_submitted` **and** every leave / regularization / document / parental-extension outcome | workspace | yes | **no** | feed + push | `/ws/:slug/settings` |
| `announcements` | `announcement` | workspace | yes | **no** | feed + push | `/ws/:slug/settings` |

Both are workspace-switchable and neither is member-mutable, so the **whole
catalogue is configured on one screen** and `/me/settings` renders no category at
all. There is no diagonal to keep in step and no second column that can disagree
with the first.

**`approvals` is one switch over both halves of an approval.** It was two —
`approvals_inbox` (a request reaching an approver) and `approvals_outcome` (the
answer reaching whoever filed it) — and they merged because they are one subject
to the admin configuring them, where two near-identical rows are harder to tell
apart than one row is to understand. State the consequence wherever the switch is
offered: **switching `approvals` off silences BOTH audiences.** Approvers stop
being told a request is waiting, *and* employees stop being told the outcome of
requests they filed themselves. The inbox half used to be member-mutable and no
longer is; the outcome half could not be made mutable in exchange, because a
person not learning their leave was rejected is the failure the `memberMutable`
flag exists to prevent — and one category holds one answer.

**`announcements` is locked to members** because it is the one message class that
cannot afford to be missed — a policy change, a closure, an office day. Handing
out a per-member switch for it rebuilds the exact problem the feature exists to
solve.

Neither is **rendered** on `/me/settings`. They used to be, disabled and
captioned with their reason, on the argument that a member should see the
decision was made rather than wonder where the switch went. That was the wrong
trade: a switch nobody may throw still reads as a switch.

Switching a workspace category off is total — `notify()` returns at step 2, so
there is **no feed row and no push**. Two consequences worth stating before
relying on it:

- **`approvals` off means nobody is told at all, on either side.** Not "fewer
  pushes" — approvers must watch the queue themselves, and a rejected leave
  leaves no record the employee will see; they must go and look.
- **`announcements` off means silent, not unposted.** The `workspace_announcements`
  row is written *before* the fan-out, so the notice still reaches
  `/me/announcements` with its attachments. The POST's `delivered` count reports
  **0** in that case rather than the roster size, and the composer says "posted
  silently" — a count of 34 for a notice nobody was alerted about is a lie on the
  one screen an admin uses to check it went out.

**`PATCH /api/ws/[slug]` filters on the way IN exactly as the read path does on
the way out** — an unknown or non-switchable key is dropped, and only a non-array
or a non-string element is a `400`. It used to reject the whole save, so an admin
whose tab predated a category's retirement could not change the switches that are
still live. A retired key has an honest reading; a malformed body does not.

`parseCategoriesOff()` filters the stored array through the catalogue **and** on
`workspaceSwitchable`, and that pair of filters is what made retiring two
categories a change to one file rather than a migration. The column is historical
data: a workspace that switched `reminders` or `presence` off while those were
still categories has those words sitting in it today, and honouring a key with no
switch left anywhere in the product would silence something no screen could
explain. Reading through the catalogue means such keys go quiet the moment they
leave it, and would come back if they returned — nothing is rewritten either way.

### The member sets schedules, and a schedule is not a category

`reminders` and `presence` were categories. They are not any more, and the
argument is the crux of the whole split:

> A category is a class of MESSAGE. A schedule is a TIME. Once the member has
> picked the time, a separate boolean saying "and also, on" is a second source of
> truth for the same fact — a member with `muted = 0` and no time set is "on" by
> one and "off" by the other, and nothing can arbitrate, because neither
> representation is wrong: they answer different questions and were only ever
> assumed to agree. So **the schedule IS the switch, and having a value set IS
> the opt-in.**

Two tables carry it, and their scopes differ for opposite structural reasons:

| Table | Key | Holds | Why that scope |
|---|---|---|---|
| `member_reminder_prefs` | UNIQUE `(user_id, workspace_id)` | `checkin_at`, `checkout_at` — `'HH:MM'` wall-clock in the **workspace's** `display_timezone`. NULL = that kind off; **no row = both off** | Everything the reminder pass gates on belongs to the workspace: the timezone the time is read in, `working_days`, the holiday calendar, whether this member is on approved leave there. A member of two workspaces genuinely wants two schedules — 09:00 in `Asia/Kolkata`, 10:00 in `Europe/London` — and one account-level time would be wrong for one of them every day |
| `member_presence_prefs` | `user_id` PRIMARY KEY | `half_day_after_h`, `full_day_after_h`, `repeat_every_h` (nullable rungs) and `auto_checkout_after_h` **NOT NULL DEFAULT 12** | `presence_events` carries no `workspace_id` and deliberately never will, so a member of two workspaces has ONE open session. "Which workspace's ladder applies to this session" has no answer, and inventing one puts two ladders in a race to push about the same row. `user_id` is the primary key rather than a surrogate id, because there is exactly one row per member by definition |

**Neither table has an `enabled` or `muted` column, and neither may grow one.**
That is the rule above, written into the schema.

**`auto_checkout_after_h` is NOT NULL while every rung beside it is nullable, and
the asymmetry is the point.** The three rungs are NUDGES — switch them all off
and a member loses nothing but a buzz. Auto-checkout is a **MECHANIC**: an open
`presence_events` row is what that day's attendance is computed from, and
invariant 4 means it can never be repaired by editing it afterwards. So the
column refuses to express an off value, `POST /api/checkin` clamps whatever it
reads into `[MIN_AUTO_CHECKOUT_H, MAX_AUTO_CHECKOUT_H]` before scheduling, and
the close itself runs before any push and unconditionally. `12` is exactly what
that route hardcoded before the table existed, so the default reinterprets
nobody's existing session.

**Both member paths are PUSH-ONLY.** Neither writes a `notifications` row:
`checkin_reminder` and `checkout_reminder` have **left `NotificationType`**, and
the ladder never had one. A nudge to check in, or to go home, is worthless an
hour later, and a bell full of last Tuesday's "still checked in?" is a bell
nobody opens — which costs them the approval notices that do matter.
`notificationHref` still resolves both reminder strings because historical
`notifications` rows carry them and still have to open somewhere sensible; it
keys on the type string and is deliberately not typed against `NotificationType`.

The consequence is that **the organisation's two categories are the only things
in the product that write a feed row.** A member who has push denied at the OS
level gets no reminder and no ladder nudge at all, and nothing records that one
was due — the `/me/settings` copy says so rather than leaving it to be
discovered.

- `GET|PATCH /api/ws/[slug]` carries `notificationCategoriesOff` (no new route)
- `GET|PATCH /api/me/presence-prefs` — the account-level ladder, session user
  only. It merges a partial body against the stored row and validates the whole
  object, because the rungs constrain each other, and there is **no `userId`
  parameter anywhere in the file** — one cannot be accepted if it is never read
- `GET|PATCH /api/me/ws/[slug]/reminder-times` — the member's reminder schedule
  for one workspace, gated by `requireWsMember()` like every other `/me`
  workspace route. There is no `enabled` flag in the request or in the table
- `GET|PATCH /api/me/notification-prefs` and
  `GET|PATCH /api/me/ws/[slug]/notification-prefs` are **deleted**. They existed
  to mute a member-mutable category and no category is one; re-adding either
  needs a category that a member may actually mute, not a screen that wants a
  switch

### Retained and currently unread — on purpose

`notification_prefs` (the table **and** its `muted` column),
`src/lib/db/queries/notification-prefs.ts`, `notify()`'s member-mute step, and
`CategoryDef.defaultOn` / `lockedReason` have **no live caller**. No category is
`memberMutable` today, so no member holds a preference row and nothing consults a
default. Say "retained", not "dead code awaiting deletion".

It is kept because the machinery is generic and correct — every reader resolves
through `CATEGORY_DEFS` rather than naming a category, so a third, member-mutable
category revives the whole path by setting one flag — and because re-deriving it
would mean rediscovering two things that are not obvious from the outside and are
silent when got wrong:

1. **SQLite treats NULLs as DISTINCT in a unique index.** That is why the table
   carries **two partial** unique indexes (`WHERE workspace_id IS NOT NULL` and
   `WHERE workspace_id IS NULL`) rather than one plain
   `UNIQUE (user_id, workspace_id, category)`, which would not constrain the
   account-level rows at all. The same `NULL = NULL` trap that once detached
   invited people's HR records from their memberships.
2. **A boolean column is required for two defaults to coexist**, because absence
   can only ever carry one meaning. A row used to *mean* muted and un-muting was
   a DELETE; under that shape "off by default" and "never chose" are spelled
   identically and no query can tell them apart. The column is also what makes an
   explicit choice **survive** a later change to the default instead of silently
   inverting with it.

The migration deletes rows naming a category that no longer exists
(`approvals_inbox`, `approvals_outcome`, `reminders`, `presence`) — inert either
way, since every read filters through `isNotificationCategory`, but a preference
row for a category nobody can mute contradicts invariant 25 on its face.

### Storage — both sides record deviations only

- **Workspace:** `workspaces.notification_categories_off`, a JSON array of the
  **disabled** keys, default `'[]'`. Storing the disabled set rather than the
  enabled one means a category added to the catalogue later is on everywhere with
  no backfill; the inverse would ship it silently off for every existing
  workspace.
- **Member:** a `notification_prefs` row is an **explicit choice** and `muted` is
  what it chose; absence means "never touched it" and resolves to the category's
  `defaultOn`. Nothing is ever seeded. (No category is mutable today, so in
  practice the table is empty.)
- **Schedules record presence, not deviation**, which is the opposite convention
  and deliberately so: there is no default time to deviate from, and a stored
  `'09:30'` is the entire fact. `setMemberReminderPrefs()` leaves a row with two
  NULLs rather than deleting it, so "never configured" and "deliberately off"
  stay distinguishable at the query layer even though both deliver nothing.
- **`workspaces.checkin_reminder_at` / `checkout_reminder_at` are VESTIGIAL.**
  Still written by `PATCH /api/ws/[slug]`, never read as the schedule again, and
  deliberately not selected by anything in `lib/reminders.ts` or
  `db/queries/reminders.ts`. They survive only as a pre-filled *suggestion* on
  the member's own settings screen, phrased in the past tense so nobody reads
  them as a setting that is already covering them. Selecting them as a delivery
  fallback is the first step back to pushing at everybody, which is the nag this
  move exists to end.

The workspace switchboard is gated on **`Resource.Settings`**, not a resource of
its own: adding a `Resource` means touching `system-roles.json` (invariant 12),
and choosing which categories are live is settings-shaped. Broadcasting to
everyone's phone earned `Resource.Announcements`; configuring a switch does not.

### `notify()` is the only way a notification leaves the system

`src/lib/notify.ts`. Before it, `createNotification()` and `sendPushToUser()`
were called side by side at seven places, each building its own `data.url` — and
the announcement fan-out had already drifted, hardcoding a URL with an unencoded
slug. **The order of operations is the correctness argument:**

1. resolve the category from the type
2. a **workspace-disabled** category writes **nothing** — no row, no push
3. `createNotification()` runs for every recipient, **unconditionally**
4. a **member's mute** suppresses only the push *(no live caller — see above)*
5. the push URL comes from `notificationHref`, never a literal

Step 3 is what makes step 4 safe: the member switch is push-channel only, so the
in-app feed stays a complete record and a mute would mean "stop buzzing my
phone", not "hide this from me". Step 2 is different on purpose — a workspace
switching a category off is saying it does not apply to this organisation, so
there is nothing to keep a record of.

`notify()` takes a **list** of recipients. A fan-out reads the workspace once,
not once per person.

**The two push-only paths do not route through it**, and that is invariant 24's
pair of sanctioned exceptions — `src/lib/reminders.ts` and the ladder loop in
`src/app/api/push/cron/route.ts`. Neither is skipping the preference check; there
is nothing for `notify()` to do. Both write **no feed row**, which `notify()`
cannot express (writing it unconditionally is the whole point of step 3); both
carry no category to resolve; and both resolve their schedule from **one bulk
read** — `getMemberReminderTimes()` per workspace, `getPresenceLadderPrefs()` per
cron batch — where `notify()` resolves per call, which for 500 open events is 500
lookups. The preference has not been bypassed, it has moved: **having a time or a
rung set at all is the opt-in**, so a member with no row generates nothing to
send and there is no switch left to forget to consult.

---

## Office days (bulk WFO)

An admin declares a date an office day, and everyone who worked from home that
date counts as **WFO**, so no attendance allowance is cut.

It writes one `admin_overrides` row per presence event on that date, with
`source = 'office_day'`. `matched_by` then becomes `'override'` in
`src/lib/signals.ts`, and `isOfficeMatched()` already counts override as office —
so the monthly grid, analytics, the XLSX export, `/me`'s WFO/WFH tiles and the
insights trend all update with **no read-path changes**. That is the whole reason
this reuses invariant 7 rather than inventing a new table.

**Only people who already have an event that date are converted.** Someone who
never checked in stays absent; someone on approved leave stays on leave. No event
is ever synthesized — invariant 4 still holds.

Three things the table gained to make this safe:

| Addition | Why |
|---|---|
| `admin_overrides.source` | Tells an office day from a regularization, so undo cannot delete an approved correction. Mirrors `presence_events.source`. Existing rows backfilled to `'regularization'` — the only writer before this. |
| `UNIQUE (workspace_id, presence_event_id)` | **This index IS the idempotency guarantee.** The bulk write is `INSERT OR IGNORE`, so re-declaring a day is a no-op. A pre-read would be two statements and a race. |
| `INDEX (workspace_id)` | `getOverrideEventIds()` runs on every `queryWorkspaceEvents` call — i.e. every workspace API request — and the table previously had no index at all. |

**Weekends and holidays are refused, loudly.** `summarizeAttendanceDays` checks
`!isWorkday(...)` and `holidayDates.has(date)` **before** it looks at events, so an
office day declared on a Saturday or a public holiday would write override rows
that nothing ever reads. The route reuses the `WEEKOFF_DATE` / `ON_HOLIDAY` refusals
the single-day regularization path already has. A loud refusal beats a silent no-op.

- `POST /api/ws/[slug]/office-days` · `DELETE /api/ws/[slug]/office-days/[date]`
- Guarded by `Resource.Approvals` — it is an attendance correction, generalised.

---

## Scheduled reminders

Two independent passes, both driven by `POST /api/push/cron` (Bearer `CRON_SECRET`, called from GitHub Actions at :00 and :30). **Both are push-only and neither writes a `notifications` row** — see the notification-preferences section above.

> **`/api/push/cron` must stay in `PUBLIC_API_ROUTES` in `src/proxy.ts`.** That list
> means *not cookie-gated*, not unauthenticated — the route checks `CRON_SECRET`
> itself. Leaving it off meant the middleware answered the GitHub Action `401`
> before the route ran, and **the entire cron silently never executed in
> production**. Any endpoint authenticating by Bearer token or shared secret has
> the same requirement.
>
> `getOpenEventsForCron()` carries a `LIMIT` and a **48-hour age cutoff** so an
> outage can never again build a backlog that fires thousands of pushes on
> recovery. `scripts/drain-open-events.js` (silent, `--apply`-gated) is how an
> existing backlog is cleared — run it before enabling the workflow.

1. **Event-anchored — the member's own session ladder** (in the cron route): starts from an open `presence_events` row, counts elapsed hours, and fires the rungs `resolveLadder()` expands from that member's `member_presence_prefs`. Dedupes on `presence_events.push_reminders_sent`, read through `normaliseLadderKey()` so a session opened under the old hardcoded `'5h'` / `'10h'` names is not re-nudged under the new ones. See **the session ladder** below.
2. **Wall-clock** (`src/lib/reminders.ts` → `runReminderPass()`): anchors on *workspaces* instead. The event-anchored design structurally cannot notice somebody who never checked in — there is no row to iterate. This pass finds the workspaces where **some member** has a time set, works out whose configured time is now in the workspace's own timezone, then finds who still owes a check-in or check-out. Dedupes on the `reminder_log` table (unique on `workspace_id, user_id, kind, local_date`), which is now the **only** record that a reminder happened: there is no feed row to notice and the push leaves no trace on our side.

**The schedule is the member's, not the workspace's** — one pair of times per member per workspace in `member_reminder_prefs`, and having a time set is the opt-in. Nothing in the pass reads `workspaces.checkin_reminder_at` / `checkout_reminder_at` and nothing may start to: a delivery fallback to a workspace time resurrects the push-at-everybody behaviour the move exists to end.

Everything in pass 2 is about **not nagging**. A reminder that fires on someone's approved leave, on a public holiday or on a Sunday is how a user disables push permanently — which also costs them the approval notifications that work today. Gates, in order:

```
1.  workspace archived            → excluded by the query
2.  today not a working day       → skip the whole workspace
3.  today is a company holiday    → skip the whole workspace
4.  compute each member's due set → if nobody is due, return before any
                                    member query runs
5.  member on approved leave      → skip the member
6.  already reminded today        → skip the member (reminder_log)
```

The old gate **1b** (workspace `reminders` switch) and old gate **7** (member mute) are **gone**, not inert: neither is expressible any more. There is no `reminders` category for a workspace to switch and no mute for a member to hold — the absence of a time is the off state, and it is checked at gate 4 along with everything else.

Gate **4 moved inside the workspace.** It used to be one comparison against the workspace's own configured time; it is now one comparison per member, against `getMemberReminderTimes(ws.id)`. The loop still iterates **workspaces**, because the holiday lookup, the leave lookup and the parental-leave lookup are each keyed on the workspace and answer the question once for every member of it — a member-anchored loop would re-read all three per person, ~1500 extra round trips every thirty minutes for a 500-person workspace.

Gate 4's **early return is load-bearing for cost.** On most of the 48 daily ticks not one member of a given workspace is due, and `getMembersMissingCheckin` is the expensive query in the file — a `NOT EXISTS` over every member's presence events for the day. Reading the schedules first (one indexed read of a handful of rows) and returning when the due set is empty is what keeps a quiet tick nearly free; the leave and parental reads sit *after* gate 4 for the same reason.

Gate **6 claims before it sends**, and `recordReminderSent()` is `INSERT OR IGNORE` returning `changes > 0`, so the insert **is** the check. A read-then-write would let two overlapping cron runs both past the line and push twice.

`ReminderPassResult.skipped` is `nonWorkingDay / holiday / onLeave / alreadySent / outsideWindow / noneDue`, and every one of them counts per workspace-**day**, not per workspace — the pass evaluates two dates on one tick a day. `outsideWindow` counts a **kind** somebody wants but not in this half hour; `noneDue` counts a whole workspace-day that cleared the day gates with nobody due. The two are **disjoint by construction**: the nothing-to-do return comes first, so an idle workspace-day is counted once as `noneDue` rather than also once per configured kind. `noneDue` and on a healthy run it is by far the largest number in the object — a workspace is due at most twice a day and this pass looks at it 48 times.

`REMINDER_GRACE_MIN = 30` — how late a reminder may still be delivered. The workflow ticks at `:00` and `:30`, so a 30-minute window is exactly one tick wide: **every minute-of-day is reachable by exactly one tick**, none is claimed twice, and the worst-case lateness is 29 minutes.

**That is only true because the pass evaluates TWO workspace-local dates on the first tick of a local day.** It used to be false at the day boundary: `minutesNow` resets to 0 when `todayInTz()` rolls over, so the 23:30 tick reached 23:30 and the 00:00 tick started again at 00:00 — and **23:31–23:59 was evaluated by no tick at all**, silently, for any member who set a time in it. `runReminderPass()` therefore runs the gate chain per *candidate date*: always today, plus yesterday when `minutesToday < REMINDER_GRACE_MIN`. Ticks are 30 minutes apart, so exactly one tick a day carries that second candidate, and it cannot double-send: yesterday's elapsed minutes are a whole day larger, so one stored time can never satisfy both windows. **The carry-over is a full workspace-day** — its own working-day and holiday gates, its own presence-event window, its own `reminder_log` date — because a 23:45 reminder is *about* yesterday, and claiming today's slot would leave yesterday's re-deliverable and burn today's before it came due. **The accepted cost is stated rather than hidden:** GitHub Actions cron is best-effort, so a skipped run now *drops* that day's reminder instead of delivering it stale. That is the intended trade — the window was 90 minutes precisely so a missed tick could be caught up, and catching up is the wrong thing to do here. A check-in reminder that lands at lunchtime is not a reminder, it is a nag, and a nag is what makes somebody revoke push permission outright; that permission is shared with the approval notifications they actually want. A missed nudge costs nothing anybody will notice. `reminder_log` guarantees at most one delivery per person, per kind, per local day whatever the window is — it is the dedupe, not this constant.

### The session ladder

`src/lib/presence-ladder.ts` is **pure** — no DB access, no imports from
`lib/db/**` — for the same sharp reason as `src/lib/parental.ts`: the
`/me/settings` form that edits these values is a **client** component and needs
the bounds at runtime, so a runtime import from a query file would pull
`lib/db/index.ts`, better-sqlite3 and libSQL into the browser bundle and fail the
build with a `Can't resolve 'fs'` trace naming none of it. `resolveLadder`,
`normaliseLadderKey`, `LADDER_WINDOW_H`, `DEFAULT_PRESENCE_PREFS` and the bounds
all live there; `db/queries/presence-prefs.ts` re-exports them for server callers.

**A `MemberPresencePrefs` is guaranteed finite, and the overtime loop is bounded
anyway.** `toPrefs()` in `db/queries/presence-prefs.ts` is the one place a stored
value is flattened: a non-finite rung becomes `null` (absence already means off),
and a non-finite `auto_checkout_after_h` becomes the default `12` — it cannot
become `null`, because invariant 31 is why that column is NOT NULL. The `== null`
test runs **before** the finiteness test, since `Number(null)` is `0` — finite,
and a close time of zero would shut the session in the instant it opened. The
loop then guards itself twice over: `MAX_OVERTIME_RUNGS` caps the iteration, and
the exit test is written `if (!(hours < autoCheckoutAfterH)) break` rather than
`>=`, so a `NaN` reaching it **stops** instead of comparing false forever. The
column has no CHECK constraint and SQLite is loosely typed, so a migration or an
importer writing text is the whole threat model — and the old spelling turned it
into a non-terminating loop inside the cron.

`resolveLadder()` expands a member's four numbers into the ordered pushes their
session earns: a half-day rung (opens `/me`), a full-day rung (opens the
extension picker — from there the only honest answers are "check out" and "tell
us you are still working", and the second needs a screen), then overtime rungs
every `repeat_every_h` until **strictly before** `auto_checkout_after_h`. A rung
landing exactly on auto-checkout would tell the member "you are still checked in"
and "we checked you out" in the same breath. Overtime needs **both** a repeat
interval and a full-day mark; anchoring it on the half-day rung instead would be
the function inventing a schedule the member never set.

**A rung outside its window is claimed without being sent.** Past
`LADDER_WINDOW_H` (1.5h) after its hour, the dedupe key goes into
`push_reminders_sent` and no push leaves. This is the fix for a reported bug, not
a nicety: after a cron outage an event first seen thirteen hours old had every
rung due at once, so the half-day push, the full-day push and the auto-checkout
notice landed within seconds of each other — which members reported as "I got my
5-hour notification after checkout", because that is exactly what it looked like.
**Claiming rather than skipping is the deliberate half:** a skipped rung stays
unclaimed and is re-evaluated, found stale and skipped again on every tick for
the life of the session.

The cron **re-checks `isEventOpen()` immediately before each push.** The batch is
read in one query and the loop has been awaiting pushes ever since, so a member
who checked out mid-loop was still being buzzed about an open session they had
already closed.

**Auto-checkout is the exception to all of it.** It is not a rung, it is not
subject to the staleness ceiling — what it reports is still true whenever it
arrives — and it obeys no preference: `autoCheckoutEvent()` runs first and
unconditionally. The *push* is conditional on that write having done something.
The UPDATE carries `AND checkout_at IS NULL`, so `autoCheckoutEvent()` returns
whether it actually closed anything, and announcing "we closed your session" to
somebody who closed it themselves is announcing a thing that did not happen. The
key is claimed either way — the event is resolved, and leaving it unclaimed
re-runs the branch on every future tick.

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
- `employees-list.ts` - the directory/list read path, kept out of `employees.ts` so a list query can never accidentally decrypt sensitive columns
- `assets.ts` - workspace asset register (hardware, assignment history)
- `documents.ts` - employee document metadata **and** the blob helpers; the only file outside `src/lib/storage.ts` allowed to see base64
- `maternity.ts` - parental leave cases (maternity + paternity) + their stage machine; owns `isParentalCaseType()`, the only validation on `case_type`
- `hierarchy.ts` - the reporting line (`workspace_members.manager_user_id`); the tree walk itself is pure and lives in `src/lib/hierarchy.ts`
- `regularizations.ts` - employee requests to correct a past day
- `roles.ts` - workspace roles and permission grids
- `notifications.ts` - in-app notifications
- `notification-prefs.ts` - per-member category push preferences; a row is an EXPLICIT CHOICE and `muted` is what it chose, absence resolves to the category's `defaultOn`. **No live caller today** — no category is `memberMutable` — and retained deliberately; see Notification preferences
- `reminders.ts` - the wall-clock pass's reads/writes: the member schedules in `member_reminder_prefs` (per `(user_id, workspace_id)`; the time IS the switch, so there is no enabled column and must never be one) and the `reminder_log` dedupe. It deliberately never selects `workspaces.checkin_reminder_at` / `checkout_reminder_at`
- `presence-prefs.ts` - the account-level session ladder in `member_presence_prefs` (one row per member, `user_id` PRIMARY KEY). Three nullable rungs plus `auto_checkout_after_h`, which is NOT NULL because auto-checkout is a mechanic rather than a nudge. Shapes and bounds live in the pure `src/lib/presence-ladder.ts` and are only re-exported here, so a client component can import them without bundling the SQLite driver

### Migration
`scripts/migrate.js` - **single migration script** and must always be **fully up-to-date**.
- Fresh DB: creates every table/column.
- Existing DB: additive `ALTER TABLE` statements add missing columns (wrapped to skip duplicates).
Run: `npm run migrate`.

> **`src/lib/db/schema.ts` was deleted.** There is no TypeScript schema file and no ORM model. `scripts/migrate.js` is the *only* description of the database. To learn what columns a table has, read that script — nothing else in the repo knows. Row shapes are hand-written interfaces inside each query file, and they are documentation, not enforcement: the compiler never checks them against the DB, so a column rename that only touches the interface will typecheck and then fail at runtime.

---

## Auth System

### There is one login, and it asks nothing about an organisation

`src/app/(public)/login/page.tsx` is a single state machine:

```
email ─┬─ existing account ──── password ──────────────────┐
       ├─ deactivated account ─ deactivated (reactivate) ──┤
       └─ new email ─────────── otp ─── create account ────┤
                                                           ├─▶ redirect
password ─ "Forgot password?" ─ forgotPassword ─ otp ─ resetPassword ──┘
```

`otp` is shared by the two flows that need a code; `isResetFlow` is what tells
them apart on the way out.

**The Personal / Organisation question is gone**, along with `OrgSetupStep`, the
live slug checker, and the `accountType` / `orgName` / `orgSlug` / `orgDomain`
half of `POST /api/auth/register`. The answer was never stored: it only decided
whether that route created a workspace in the same request, which is a question
nobody can answer before they have seen the product. Creating a workspace is now
its own act at `/ws/new` → `POST /api/workspace`, which is also the only path
reachable by someone who already has one. Do not re-add an account type; there is
nowhere to store it and nothing that would read it.

`POST /api/auth/register` now does exactly five things, in an order where each
step guards the next: the `cm_otp_ok` cookie must prove the email (invariant 3),
`EMAIL_TAKEN` before any write, `claimPendingMemberships()` (which links
`user_id` and **nothing else** — signing up is not consent, and the HR record is
claimed in `acceptMembership()`), verified-domain auto-enrol, then the session
cookie.

**Where a session lands is one function.** `getRedirectAfterLogin()` in
`src/lib/permissions/ranks.ts` — none → `/me`, one → `/ws/<slug>`, several →
`/ws` — and login, register, `reset-password`, `/api/me/reactivate` and
`/app/dashboard` all call it. Four of them used to spell the ladder out inline,
and `/dashboard` disagreed: it sent everyone with org access to the `/ws` picker,
which for the common case of one workspace was a list of one to click through.

`/login?invite=<slug>` carries the invitation through **both** exits — after a
successful sign-in or sign-up, *and* when the visitor already has a session. The
second case used to redirect to `/me` and drop the invitation on the floor,
landing the person on a screen that said nothing about the workspace that asked
for them.

All login copy lives in `src/locales/en/auth.ts` (invariant 16).

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

> **Known gap — OTP codes are stored in plaintext.** `otp_codes.code` is a plain `TEXT` column: there is no `code_hash` and no bcrypt anywhere in the OTP path. `getValidOtp()` in `lib/db/queries/users.ts` looks the code up with a literal `AND code = ?`. Anyone with read access to the database can read every live OTP and complete a registration, a login or an ownership transfer as that email. The 10-minute expiry (`otpExpiresAt()` in `src/lib/auth.ts`) and the `used` flag limit the window; they do not close it. Do not describe OTPs as hashed. Fixing this means storing a hash and comparing in code (the `AND code = ?` lookup has to become a fetch-by-email-then-compare), which is a real change to that query — not a doc edit.

---

## Architecture

### Route handlers
- Read user ID from `getServerUser()` (never from request body)
- Gate workspace routes with `requireWsAccess(req, slug, Resource.X, Action.Y)`; on `null` return `forbidden()` (both from `@/lib/ws-access`)
- Gate `/api/me/ws/[slug]/*` routes with `requireWsMember(req, slug)` from `@/lib/ws-admin` — membership, not permission
- Call query functions, return JSON
- Errors: `{ error: "Human message", code: "MACHINE_CODE" }`, consistent HTTP status

`Resource` and `Action` are enums in `src/lib/permissions/catalogue.ts`, not loose strings, so the compiler rejects a guard that names a resource nobody can grant. The screen a route backs is registered in `src/lib/permissions/screens.ts` against the *same* resource — sidebar visibility and route enforcement must agree, and they only do because both read that registry.

### Server vs Client components
- Default: Server Components
- Client only when: interactive state, browser APIs (GPS, Notification), usePathname/useParams
- Never put business logic in Client Components - fetch from API routes instead

### Copy (strings)
- English UI and marketing copy is assembled in `src/locales/en.ts`, but **new copy goes in a per-area module** under `src/locales/en/<area>.ts` (`me.ts`, `me-screens.ts`, `me-settings.ts`, `me-announcements.ts`, `marketing.ts`, `documents.ts`, `ws-overview.ts`, `ws-people.ts` (which also holds `wsPeopleUi` and `wsOrg`), `ws-assets.ts`, `ws-parental.ts`, `ws-approvals.ts`, `ws-announcements.ts`, `ws-person.ts`, `ws-settings.ts`, `ws-reminders.ts`). `en.ts` imports each module and spreads it onto the `en` object.
- Both `en.me.x` and `import { me } from '@/locales/en/me'` resolve to the same object, so either import style works at a call site. Prefer the direct module import in new code — it keeps two agents editing two different areas out of the same file.
- The groups still written inline in `en.ts` are the original single-file copy, kept so existing `en.x` call sites keep working. Move a group into a module as its screens are touched; do not add to them.
- Technical identifiers (cookie names, DNS prefixes, DB filenames) live under `en.constants`.

### Layouts
- `src/app/(public)/layout.tsx` - passthrough, public pages
- `src/app/me/layout.tsx` - `.shell-me`: 460px column, `.me-topbar`, `.me-content`, fixed `.me-bottomnav`. Safe-area insets on `html` (top/left/right) and on the bottom nav's padding
- `src/app/ws/[slug]/layout.tsx` → `src/components/ws/WsLayoutClient.tsx` - `.shell-ws`: a **collapsible sidebar** beside a column carrying the 64px `.ws-topbar` and the 1180px `.ws-content`. It is a sidebar at every width — the ≤860px horizontal tab strip is gone. The *page* scrolls, not an inner div, so the topbar's own sticky works and browser scroll restoration behaves
- **Two independent states, and neither component reads the viewport.** `.shell-ws` carries `data-nav="expanded|collapsed"` (228px column ↔ 64px icon rail) and `data-drawer="open|closed"` (the off-canvas overlay). The stylesheet decides which one means anything at a given width: every rail rule lives inside `@media (min-width: 861px)`, every drawer rule inside `@media (max-width: 860px)`. `data-nav` is persisted to the `cm_nav` cookie and **read by the Server Component layout**, so the first paint is already the right width; `data-drawer` is deliberately not persisted — a nav drawer that reopens itself on the next page is a bug, not a preference
- **The drawer reuses `useOverlay`** (`src/components/ui/use-overlay.ts`) for Escape, body-scroll lock, focus-in/focus-return and the focus trap — the same contract `Modal`, `SlideOver` and `BottomSheet` share. It is not portalled, so the `mounted` guard is unused. The one piece of responsive JS in the shell is a `matchMedia` listener that force-closes the drawer at ≥861px, because the focus trap is only correct while the sidebar is an overlay
- Sidebar entries come from `visibleScreenGroups()` in `src/lib/permissions/screens.ts` — never a hardcoded nav list. Hiding a tab is a courtesy; the matching route enforces the same permission independently

See `docs/design/shells.md` for the full anatomy.

### SEO and indexing
- Root metadata lives in `src/app/layout.tsx`.
- Public crawl rules live in `src/app/robots.ts`; the sitemap lives in `src/app/sitemap.ts`.
- Keep `/`, `/for-teams`, `/for-you`, `/pricing`, `/open-source`, `/privacy`, and `/terms` indexable.
- Keep `/login`, `/consent/*`, `/me/*`, `/ws/*`, and `/api/*` non-indexable.
- Set `NEXT_PUBLIC_APP_URL` to the production canonical origin (`https://checkmark.kabirinnovations.com`) before deployment so canonical links, Open Graph URLs, robots, and sitemap point at the live domain.

---

## Design System

Full documentation: **`docs/design/`**. The tokens below are the authoritative summary; the source of truth is `src/app/globals.css`.

The palette is the design-spec **electric blue** (`#1B4DFF`) on deep navy, with Syne headings and DM Sans body text.

| Variable | Value | Use |
|----------|-------|-----|
| `--brand` | `#1B4DFF` | Primary buttons, links, active nav, verified state |
| `--brand-hover` | `#1640E0` | Hover fill on `.btn-primary` only |
| `--navy` | `#0D1B2A` | Headings, `.stat-num`, dark text |
| `--teal` | `#00D4AA` | Success accent (toast success dot) |
| `--amber` | `#F59E0B` | Warnings, `partial` status, IP signal |
| `--danger` | `#EF4444` | Errors, destructive, `none` status |
| `--info` | `#8B5CF6` | `override` status — the one off-brand semantic |
| `--surface-0` | `#FFFFFF` | Card and panel backgrounds |
| `--surface-1` | `#F8FAFC` | Page backgrounds |
| `--surface-2` | `#F1F5F9` | Inputs, tracks, hover fills |
| `--text-primary` | `#0D1B2A` | Body text |
| `--text-secondary` | `#64748B` | Labels, secondary text |
| `--text-muted` | `#94A3B8` | Hints, eyebrows, empty states |
| `--border` | `#E2E8F0` | All borders — a flat slate grey, not a tint |
| `--header-bg` | `#0D1B2A` | Dark chrome (toast background) |
| `--ring` | `rgba(27,77,255,0.28)` | Focus rings, signal-dot halos, stepper glow |
| `--brand-glow` | `rgba(27,77,255,0.18)` | Marketing ambient blobs **only** — weaker on purpose |
| `--radius-sm/md/lg/xl` | `6 / 10 / 16 / 22px` | Chips+icon buttons / controls / cards / overlay panels |
| `--shadow-sm` | `0 1px 2px rgba(13,27,42,0.06)` | Active tab pill |
| `--shadow-md` | `0 4px 16px rgba(13,27,42,0.08)` | Modal, dropdown, toast |
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | Default exit/settle |
| `--ease-inout` | `cubic-bezier(0.77,0,0.175,1)` | Long symmetric moves (check-in rings) |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Overshoot — toggle knob, modal, toast |
| `--ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | Bottom sheet only |

Fonts: **Syne** (headings), **DM Sans** (body), **JetBrains Mono** (`.stat-num`, code, timestamps).

Rules:
- **No shadows on inline surfaces.** Cards, inputs, chips, rows and tables are separated by `--border` alone. Elevation exists only where something floats *above* the page: toasts, modals, slide-overs, bottom sheets, dropdowns and the active `.tabbar` pill. A shadow on a card is a bug; a shadow on a modal is the design.
- No gradients — flat fills. (The marketing surface under `src/app/(public)/` and `src/components/*` landing components is exempt and keeps its own Tailwind styling.)
- **Minimum touch target 44px, enforced globally and uniformly** — `.btn`, `.btn-sm`, `.icon-btn`, `.tabbar button`, `.dropzone`, `.me-navitem` all carry `min-height: 44px` (`.icon-btn` also `min-width`). This is stricter than WCAG 2.2 AA (24px) and matches Apple HIG / WCAG 2.1 AAA. It applies on desktop too: an admin clearing an approvals queue on a phone gets the same target as a member checking in, and it deliberately costs some of the mock's table density.
  - **One exception, `.toggle`:** it keeps its 42×25 visual and gets a 44×44 hit area from a transparent `::after` overlay. Stretching a switch track to 44px tall reads as a broken control. The rule governs the *hit area*, not the paint.
- Skeleton loaders for async, never spinners. `Button` deliberately has no spinner — it sets `aria-busy` and dims its label.
- Tailwind CSS v4, utility-only — no component libraries.
- **Styling lives in `globals.css` or in a `src/components/ui/` primitive.** Never a per-component `<style>` block, never an ad-hoc inline style object. See invariant 15.

---

## Plan Limits (lib/plans.ts)

**Every plan is unlimited by default.** Users are never blocked: self-hosted and hosted instances alike get

| Limit | Value |
|-------|-------|
| `maxUsers` | `null` — no member cap |
| `historyMonths` | `null` — no history window |
| `maxLocations` | `null` — no cap (advisory; never enforced anyway) |
| `csvExport` | `true` |

`getPlanLimits()` returns one `UNLIMITED` object for `free`, `starter`, `growth` and any unknown value, so `historyStartDate()` always returns `null`. There are no tier numbers left in the file, deliberately — a figure nothing enforces reads like a promise.

**The `workspaces.plan` column, the `Plan` type and every enforcement point are kept**, and while the limits are unlimited each one is a no-op:
- `queryWorkspaceEvents()` in `src/lib/signals.ts` — history floor and member cap, applied before signal matching
- `GET /api/ws/[slug]/export` — `PLAN_GATE` / `PLAN_HISTORY_GATE` (402)
- `GET /api/ws/[slug]/monthly` — `PLAN_HISTORY_GATE`
- the regularization and office-day `OUTSIDE_HISTORY` refusals, and `getCorrectableDates()`

That is the seam for an operator of a hosted instance who wants caps back: give a plan its own limits object in `PLAN_LIMITS`, and the checks above start enforcing it with no migration. Two things that operator must also handle:
- **A member cap is silent.** `queryWorkspaceEvents()` just slices the member list; the overview's member-limit banner is gone. Reintroducing `maxUsers` without a visible notice makes people vanish from every dashboard with no explanation.
- **`maxLocations` was never enforced** — `POST /api/ws/[slug]/signals` never counts existing rows. It needs a count check before it means anything.

Do not re-add upgrade prompts, pricing links or plan badges to the app.

---

## Key Invariants

1. **User ID never from client** - always from `x-user-id` header (proxy-set from JWT)
2. **Workspace scoping** - slug → workspace.id via `requireWsAccess(req, slug, Resource, Action)`, then all queries use `ctx.workspace.id`. Never `requireWsAdmin()` — it does not exist.
3. **OTP registration** - `cm_otp_ok` cookie must be present + valid before account creation
4. **Consent validation** - 3 checks: status=pending_consent, token not expired, logged-in email matches invited email
5. **Location labels** - set asynchronously post-check-in via Nominatim. May be NULL - that's acceptable, not a bug
6. **Checkout signals** - GPS/WiFi/IP collected at checkout too. Both check-in AND checkout signals stored
7. **Admin overrides** - stored in `admin_overrides` table, never modify original `presence_events` row
8. **Rate limiting** - `rate_limit_log` table: IP-keyed for login (10 attempts per 15 min), user-keyed for checkin (10 per hr). Use `getRateLimitCount` + `recordRateLimitHit` from `lib/db/queries/users.ts`.
9. **API token O(1) lookup** - `token_prefix` column stores first 8 chars of the raw token. Always use prefix lookup in `POST /api/v1/checkin`. Never skip it.
10. **Every workspace has its system roles** - permissions resolve by joining `workspace_members.role` → `workspace_roles`, so a workspace with no rows in `workspace_roles` grants *nobody* anything, its creator included. `createWorkspace()` seeds owner/admin/member via `seedSystemRoles()` in the same transaction as the workspace row. Never insert a workspace by any other path.
11. **The workspace creator is the `owner`** - not an `admin`. Only `owner` holds the `ownership` resource (transfer, archive), so a workspace whose creator is an admin has nobody who can do those things.
12. **One definition of the seeded grids** - `src/lib/permissions/system-roles.json`, read by both the app (`system-roles.ts`) and `scripts/migrate.js`. Never write a second copy: the app and the migration drifting apart is exactly what shipped every new workspace with no roles.
13. **You can only hand out permissions you hold** - `guardEscalation()` runs on role *create*, role *edit* AND role *assignment* (`PATCH /members/[id]/role`). Rank is not a ceiling on its own: every custom role shares `CUSTOM_ROLE_RANK`, so rank alone lets any custom role with `members.role:write` assign any other custom role, however powerful. Never gate an assignment on rank alone.
14. **Data scope is the surface, not the role** - `/me/*` is always self-only, for every role, decided by the session user ID with no role lookup. So `Scope.Self` means "no org surface at all" (only the seeded `member` role carries it) and every `/ws` role is `Scope.All`. The roles builder offers no choice, and routes set scope server-side rather than accepting one from the client.
15. **Styling has exactly two homes** - a class in `src/app/globals.css`, or a primitive in `src/components/ui/`. Never a per-component `<style>` block and never an ad-hoc inline style object. The reason is mechanical, not aesthetic: the reduced-motion guard, the 44px touch-target rule and the elevation rule are all written as selector lists in `globals.css`, so a style declared anywhere else is invisible to them and silently exempt. If a primitive needs a class the stylesheet does not have, add the class — do not inline it. (Known exceptions, all pre-dating this rule: `src/components/shared/Toast.tsx` and `TopProgressBar.tsx`, and the marketing components, which are outside the app design system. The fourth — `src/app/ws/[slug]/members/[memberId]/page.tsx` — is **deleted**: 1,306 lines linked from nowhere, in no screen registry, duplicating the person page. Its API routes under `/api/ws/[slug]/members/` remain and are used.)
16. **Copy lives in a locale module** - new user-facing strings go in `src/locales/en/<area>.ts` and are composed into `en` by `src/locales/en.ts`. Never a literal in a component or route, and never a new inline group in `en.ts`.
17. **The workforce directory is ONE screen** - `/ws/:slug/people`. Never re-add an
    employees tab. `members:read` opens it; `employees:read` is what reveals the HR
    columns, and `GET /api/ws/[slug]/members` strips them server-side with an
    **allow-list** rather than omitting them in the table. Invited people
    (`status = 'pending_consent'`) belong in it, which is why the member/employee
    join carries a work-email fallback: both sides are NULL before they accept.
18. **The reporting line lives on `workspace_members.manager_user_id`** - one
    nullable column, NULL resolved to the owner at READ time and never written.
    `employment_details.reporting_manager_id` is vestigial; do not start reading it.
    Every walk goes through `src/lib/hierarchy.ts`, which is pure, so the org chart
    and the cycle guard cannot disagree.
19. **An employee record may exist before its account does** - so `employees.user_id`
    is NULL for the length of an open invitation and the directory finds the row by
    work email. Every accept path must go through `src/lib/membership.ts`, which
    claims the record **at consent**, never at sign-up: registering with an invited
    email links `user_id` on the membership and no more. A new accept path that
    skips the shell leaves a permanently unlinked record; one that claims on
    registration hands an account that has agreed to nothing somebody's payroll,
    documents and encrypted PAN and bank details.
20. **Secret-authenticated endpoints must be in `PUBLIC_API_ROUTES`** - `proxy.ts`
    cookie-gates every other `/api/*` route and `getSessionFromRequest` never reads
    `Authorization`, so a Bearer caller is refused before its own auth check runs.
    This silently killed the whole push cron.
21. **An office day writes overrides, never events** - `source = 'office_day'`, and the
    UNIQUE `(workspace_id, presence_event_id)` index is what makes the bulk insert
    idempotent. Undo deletes only `source = 'office_day'` rows, so an approved
    regularization's override survives.
22. **An announcement is a record plus a fan-out** - the row first, then one
    `notifications` row per active member. Deleting it does not unsend anything.
23. **Document bytes never appear in a JSON response** - every file goes in and out through the `DocumentStore` seam in `src/lib/storage.ts` as a `Buffer`, and comes back to the browser from a dedicated `.../file` route with real bytes and a `Content-Type`. Nothing outside `storage.ts` and `db/queries/documents.ts` may see base64. Putting a payload into a JSON body would also drag megabytes through every list query and turn the S3 swap from a one-file change into a rewrite.
24. **`notify()` is the only way a notification leaves the system** - one seam in
    `src/lib/notify.ts`. `createNotification()` runs unconditionally for every
    recipient; a member's mute suppresses **only the push**; a workspace-disabled
    category writes nothing at all. Calling `createNotification` and
    `sendPushToUser` directly from a route puts the preference check back in N
    places, which is how it gets forgotten. **Exactly two sanctioned
    exceptions**, both documented where they live: `src/lib/reminders.ts` and the
    ladder loop in `src/app/api/push/cron/route.ts`. Neither is skipping a check.
    Both are **push-only** - they write no feed row at all, which `notify()`
    cannot express, because writing it unconditionally is the whole point of its
    step 3 - so there is no category to resolve and nothing for the seam to do.
    And both resolve their schedule from ONE bulk read (`getMemberReminderTimes()`
    per workspace, `getPresenceLadderPrefs()` per cron batch) where `notify()`
    resolves per call, which for 500 open events is 500 lookups. The preference
    did not move out of the seam, it moved into the data: having a time or a rung
    set at all is the opt-in. Adding a third exception needs both halves of that
    argument.
25. **A `notification_prefs` row is an EXPLICIT CHOICE, and `muted` is what it
    chose** - absence means the member never touched the switch and resolves to
    `CATEGORY_DEFS[category].defaultOn`, so nothing is ever seeded and a member
    who has not opened the settings screen has no rows at all. Both directions
    WRITE a row; un-muting is not a DELETE, because absence can only ever carry
    one meaning and it already carries "never chose". **The whole mechanism has
    no live caller today** - no category is `memberMutable`, so nothing reads or
    writes the table - and it is RETAINED, not dead code awaiting deletion: every
    reader resolves through `CATEGORY_DEFS` rather than naming a category, so one
    flag revives it, and deleting it would mean rediscovering that SQLite treats
    NULLs as DISTINCT in a unique index (hence two PARTIAL indexes, not one) and
    that a boolean column is what lets two defaults coexist. Never answer "is this
    muted?" by testing for a row's existence, and never write a preference row for
    a category whose `memberMutable` is false.
26. **A pending item is actioned in exactly one place** - `/ws/:slug/approvals`.
    `getPendingApprovalItems()` is the only source, and the four duplicate action
    surfaces (attendance queue, leaves Requests tab, People echo, and the second
    `PATCH /api/ws/[slug]/leaves/[id]` write path) were deleted, not hidden.
    Read-only listings of the same rows are fine; an approve/decline control
    anywhere else is not.
27. **Every destructive action confirms through `ConfirmDialog`** -
    `src/components/ui/ConfirmDialog.tsx`, built on `Modal` so it inherits the
    portal, Escape, scroll-lock, focus-trap and focus-restore contract. Never
    `window.confirm`: it cannot be styled or themed, blocks the main thread, and
    sits outside every accessibility and 44px guarantee the rest of the system
    makes.
28. **A retired index name is never reused for a new definition** -
    `scripts/migrate.js` swallows `already exists`, so re-issuing
    `CREATE UNIQUE INDEX IF NOT EXISTS` under an existing name with a changed
    `WHERE` clause is silently counted as skipped and the OLD definition
    survives. `DROP INDEX IF EXISTS` plus a `CREATE` under a NEW name is the only
    spelling whose outcome is observable. This is why the one-open-case index is
    now `idx_parental_cases_one_open`.
29. **The two settings screens do not divide a catalogue; they configure
    different KINDS of thing.** `/ws/:slug/settings` holds the whole category
    catalogue - `approvals` and `announcements`, both workspace-switchable,
    neither member-mutable. `/me/settings` holds no category at all: what a member
    configures there are SCHEDULES, their reminder times per workspace and their
    session ladder per account. A category is a class of MESSAGE and a schedule is
    a TIME, and the reason they are not the same control is that a boolean beside
    a stored time is a second source of truth for one fact - `muted = 0` with no
    time set is on by one and off by the other, and nothing can arbitrate.
    **Never add an on/off toggle beside a schedule, and never render a category
    the viewing screen's flag does not carry** - a switch nobody may throw still
    reads as a switch.
30. **A ladder rung outside its window is CLAIMED WITHOUT BEING SENT** - past
    `LADDER_WINDOW_H` (1.5h) after its hour, the dedupe key is written to
    `presence_events.push_reminders_sent` and no push leaves. A rung delivered
    hours late is not a nudge about anything; after a cron outage every rung of a
    thirteen-hour-old event was due at once and landed seconds apart, which
    members reported as "I got my 5-hour notification after checkout". Claiming
    rather than skipping is the load-bearing half: a skipped rung stays unclaimed
    and is re-evaluated, found stale and skipped again on every tick for the life
    of the session. The cron also re-reads `isEventOpen()` immediately before each
    push, because the batch is read once and then looped.
31. **Auto-checkout is a MECHANIC and never depends on a preference** -
    `autoCheckoutEvent()` runs first and unconditionally, it is not one of the
    configurable rungs, and `member_presence_prefs.auto_checkout_after_h` is NOT
    NULL so the column cannot express an off value. An open `presence_events` row
    is what the day's attendance is computed from and invariant 4 forbids
    repairing it by editing, so a session that never closes leaves that day
    permanently wrong. Only the *notice* is conditional, and only on the write
    having done something: the UPDATE carries `AND checkout_at IS NULL`, so a
    member who checked out by hand is not told we closed a session we did not
    close. The key is claimed either way.

---

## What NOT to Do

- Never call `db.query()` / `db.execute()` outside of `lib/db/queries/`
- Never re-add an approve/decline control outside `/ws/:slug/approvals` — a read-only listing is fine, an action surface is not
- Never use `window.confirm` — every destructive action goes through `ConfirmDialog`
- Never reuse a retired index name for a different definition; the migration runner will silently skip it
- Never send `status` from the asset edit form — the assignment boundary is enforced with 409s and moves only through `.../assign`
- Never let a leave-type edit ship without saying it recomputes everyone's balance
- Never filter `getActiveParentalUserIds()` by `case_type` — the reminder gate must see both parents
- Never accept `userId` or `workspaceId` from request body/params without verification
- Never delete presence_events rows
- Never store raw WiFi SSIDs
- Never skip `requireWsAccess(req, slug, Resource, Action)` on a `/api/ws/[slug]/*` route — and never reintroduce `requireWsAdmin()`
- Never put a shadow on an inline surface (cards, inputs, chips, rows); shadows are for overlays only
- Never add gradients to app UI
- Never write a `<style>` block in a component or an ad-hoc inline style object — add a class to `globals.css`. An inline style is also unreachable by a media query, so anything that has to change at a breakpoint *must* be a class
- Never put a breakpoint override for a selector *earlier* in `globals.css` than the base rule for the same selector — the file has no cascade layers, so the later rule wins and the override is silently dead. This has now bitten twice (`.stat-row`, `.nav-drawer-toggle` vs `.icon-btn`)
- Never give a `/ws` screen an icon that only reads next to its own label — the 64px rail removes every label, so the glyph is the whole distinction
- Never hide a collapsed nav label with `display: none` — it is the link's accessible name; hide it visually
- Never leave `animation-fill-mode: both` on a class that animates `transform` and contains `position: fixed` children — the held transform becomes their containing block and they anchor to the document instead of the viewport (see `.page-enter` in `docs/design/shells.md`)
- Never return document bytes (or base64) in a JSON response body
- Never trust `otpVerified: true` from client
- Never use spinners - use skeleton loaders
- Never add a second workspace picker to a `/me` screen — the top-bar pill is the only one
- Never print the workspace name inside `/me` content already scoped to the active workspace
- Never seed a workspace colour on the slug — `swatchColor()` takes the workspace **id**
- Never change an asset's status while it still has a holder — return it via `DELETE .../assign` first
- Never add a secret-authenticated API route without adding it to `PUBLIC_API_ROUTES`
- Never declare an office day on a weekend or holiday — the classifier skips those days before it reads events, so the rows would be written and never read
- Never delete an `admin_overrides` row without filtering on `source`
- Never re-add an Employees tab, or a second directory of the same people
- Never add a role or status control to a directory row — those live on the details page
- Never key the person details route on a user id — an invited person has none
- Never read `employment_details.reporting_manager_id` as the reporting line
- Never accept a `memberId` from the client without checking it belongs to the caller
- Never look for `src/lib/db/schema.ts` — it is deleted; read `scripts/migrate.js`
- Never call `createNotification` and `sendPushToUser` directly from a route — go through `notify()`
- Never let a member's mute suppress the in-app row; the mute is push-channel only
- Never seed a `notification_prefs` row — absence means "never chose" and resolves to the category's `defaultOn`. The table has no live caller at all today; treat it as retained machinery, not as dead code to delete
- Never decide "is this muted?" by testing whether a row exists — resolve through `CATEGORY_DEFS`. Do not reintroduce a `mutedUserIdsFor()`-shaped helper returning a bare set of muted ids
- Never un-mute by DELETEing the row — both directions write a row, because absence already carries "never chose"
- Never read `workspaces.checkin_reminder_at` / `checkout_reminder_at` as the reminder schedule — they are **vestigial**, still written by `PATCH /api/ws/[slug]` and never read as truth. The schedule is `member_reminder_prefs`; selecting the workspace column as a fallback is how push-at-everybody comes back
- Never write a `notifications` row for a reminder or a ladder push — both paths are push-only by design, `checkin_reminder` / `checkout_reminder` have left `NotificationType`, and a bell full of last Tuesday's nudges is a bell nobody opens
- Never fire a ladder rung outside its window — past `LADDER_WINDOW_H` it is claimed, not sent, and a skipped-but-unclaimed rung is re-evaluated forever
- Never let auto-checkout depend on a notification preference, and never make `auto_checkout_after_h` nullable — it is a mechanic, not a nudge
- Never put an on/off toggle beside a member's reminder time or ladder rung — the value IS the switch, and a boolean next to it is a second source of truth nothing can arbitrate
- Never add a second workspace picker beside the `/me` reminder times — they are scoped to the top-bar pill like every other `/me` screen
- Never render a notification category on a settings screen whose flag it does not carry — a locked switch only invites someone to throw it and be told no
- Never report an announcement's `delivered` as the roster size without checking the category is on — it is 0 when switched off, and the notice is still posted
- Never rely on one UNIQUE index across a nullable column in SQLite — NULLs are distinct there
- Never lower `CRON_MAX_EVENT_AGE_H` below 24h — auto-checkout fires at 12h and extensions reach 24h, so a tighter window orphans the very sessions it should close

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TURSO_DATABASE_URL` | No (dev) | Turso URL. Empty → SQLite at ./checkmark.db |
| `TURSO_AUTH_TOKEN` | No (dev) | Turso auth token |
| `LOCAL_DATABASE_PATH` | No | Optional SQLite path for `npm run db:sync`; defaults to ./checkmark.db |
| `JWT_SECRET` | **Yes** | 32+ char random string |
| `RESEND_API_KEY` | Recommended | OTPs go to console if missing |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical app URL. Use `http://localhost:3000` in dev and `https://checkmark.kabirinnovations.com` in production |
| `VAPID_PUBLIC_KEY` | Push | VAPID public key for web-push |
| `VAPID_PRIVATE_KEY` | Push | VAPID private key for web-push |
| `VAPID_EMAIL` | Push | Contact email for VAPID (`mailto:...`), defaults to kabir.innovate@gmail.com |
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
