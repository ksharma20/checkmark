# Known gaps and traps

A register of findings that are **knowingly deferred**, not forgotten. Produced by
two review passes (correctness + interaction) over the `feat/revamp` branch on
2026-09-01. P0 and P1 correctness findings from those passes were fixed on the
branch; everything here was deferred by an explicit decision.

Revisit condition: before the next feature round on `/me` or the employee modules,
or immediately if any item below is reported by a real user.

### Accepted risk — user decision, do not "fix" without asking

**`user_id` is assignable via the employee write payload.** `employees/route.ts:127`
and `[id]/route.ts:154` both `pick(body, 'user_id')`; `_validate.ts` never mentions
it; `idx_employees_user` is **non-unique**; `findEmployeeByUserId` is `LIMIT 1` with
no `ORDER BY`. So a holder of `employees:write` can point an employee record at
another member's user id, and that member's `/me` then serves them someone else's
**decrypted PAN / Aadhaar / bank account** plus their document folder. The likelier
accident is two rows sharing a `user_id`, making which record a member sees
non-deterministic.

Accepted on the basis that `employees:write` is already a high-trust permission.
Sits alongside the existing accepted risk that any `employees:read` holder gets
fully decrypted PII (`docs/architecture/employee-records.md:178-213`).

### P2 races — deferred

| Finding | Where |
|---|---|
| Workspace A's documents paint under workspace B; `busyKey` is one slot for N uploads | `me/documents/DocumentsScreen.tsx:191-219` |
| `save()` can adopt workspace A's employee record into B; lost-update on concurrent edits | `me/profile/ProfileScreen.tsx:274-327` |
| Accepting an invite never shows the workspace (`activeList` never re-syncs after `router.refresh()`) | `me/orgs/OrgsClient.tsx:23-24,61-76` |
| Navigating away from a `?ws=` deep link silently swaps workspace (`initialSlug` is fixed at first layout render) | `me/workspace-scope.tsx:92-98` |
| `/me` home filters "today" on the **UTC** date while everything else uses workspace tz — evening check-ins vanish in UTC− zones | `me/page.tsx:52,173-176` |
| 30s poll has no ordering guard; failed `/overview` leaves a permanent skeleton | `ws/[slug]/attendance/AttendanceClient.tsx:73-100` |
| Enter key bypasses the submit guard → duplicate domain / duplicate leave type | `DomainsTab.tsx:198`, `LeaveTypesSection.tsx:144` |
| Approve stays clickable during a Decline → both PATCH, employee gets the rejection push | `leaves/LeaveRequestsTab.tsx:97` |
| Loading states stick forever on a rejected fetch | `LeaveTypesSection`, `SignalsTab`, `OpeningBalancesSection`, `DomainsTab:80-93` |
| Failures reported as successes (413 renders as a success-coloured "0 imported"; year-step shows wrong year's rows) | `OpeningBalancesSection:124-146`, `HolidaysClient:43-54`, `LeaveScreen:543`, `RosterScreen:119` |

### Validation gaps — found while fixing, not fixed

`confirmation_date` and `probation_end_date` have **no server-side validation at
all** in `src/app/api/ws/[slug]/employees/_validate.ts`, despite being date fields
the wizard collects and validates client-side. Adding it would newly reject
payloads that are accepted today, so it was left. Any API client can currently
store arbitrary strings in both columns.

### Cosmetic follow-ups from the P0/P1 fix round

- `ApprovalsClient.tsx` still renders the **"Documents" filter tab** for a viewer without `documents:read`; it will simply be empty. No data is exposed (the items are never fetched), but the tab is pointless for that role.
- `wsEmployees.documentByCompany` / `documentByEmployee` in `src/locales/en/ws-people.ts` are now unused, superseded by `documents.owner.*`.

### Consistency gaps found during the docs re-sync

- **The `/ws` pill swatch does not match the `/me` pill** for the same workspace. `WsLayoutClient.tsx` paints a flat `var(--brand)` with the first initial; `/me` uses `swatchColor()` seeded on the workspace id. A user who recognises a workspace by colour on mobile gets a different colour on the admin surface.
- **The sole-admin leave refusal** (`DELETE /api/me/workspaces/[workspaceId]`, `409 SOLE_ADMIN`) returns a hardcoded English string that is not in `src/locales/en.ts` and does not name the workspace.


### From the People/Employees merge and the ven-112 port (2026-09-01)

**Fixed in that round, listed so nobody re-files them:** the duplicated
`AVATAR_COLORS` hash (now `personColor()` in `src/lib/workspace-color.ts`), the
`EmployeesClient` filter races (that file is deleted), and the missing ownership
check on `POST /api/me/consent` (it now compares the member row's email to the
session email — it had to be fixed, because record-claiming would otherwise have
handed over another person's decrypted PII).

| Gap | Where | Why it was left |
|---|---|---|
| `employment_details.reporting_manager_id` is still written and never read | `employees.ts` `EMPLOYMENT_FIELDS`, `employees/route.ts:166` | Dropping a column the API accepts is a breaking change for any caller already sending it. It is inert, not wrong. Remove it in a deliberate pass. |
| `setManagerByEmail()` has no call site | `db/queries/hierarchy.ts` | Ported from ven-112 for a bulk CSV import that does not exist yet. |
| `GET /api/ws/[slug]/hierarchy` returns the whole roster | `hierarchy/route.ts` | Correct today (`visibleMemberIds` is every active member). It becomes a leak the day `Scope.Subtree` lands - that is the merge to do it in. |
| The org chart has no drag-to-reparent | `ws/[slug]/org/OrgTreeClient.tsx` | The reporting line is set from the details page. Deliberately deferred until the chart has been used against real data. |
| `confirmation_date` / `probation_end_date` still have no server-side validation | `employees/_validate.ts` | Unchanged from before; adding it would newly reject payloads accepted today. |

### Deferred from `feat/ven-112` in full

`Scope.Subtree` - the role-level data scoping the reporting tree was built to
feed. Not merged: it rewrites invariant 14, changes what every existing custom
role can see in production, and needs its own review round. What it would touch,
should someone pick it up: `catalogue.ts` (the enum plus the `parseScope`
fallback flip), `system-roles.json`, `ws-access.ts` (`resolveVisibleMemberIds`),
`signals.ts` (`memberIds` intersection), `RolesClient.tsx`, and a `memberIds`
thread through nine `/api/ws/[slug]/*` routes. **`system-roles.json` on that
branch is reformatted wholesale, so a textual merge silently drops `assets` and
`documents` from the owner and admin grids — hand-merge it.**


### Round 4 — found while building, not fixed

| Gap | Where | Note |
|---|---|---|
| `NotificationRow` is built from inline style objects | `src/components/notifications/NotificationRow.tsx` | Pre-existing (9 of them before this round), violating invariant 15, so the reduced-motion and touch-target selector lists never see it. Not in the documented exception list either. |
| **The whole `/ws/[slug]/settings` directory violates invariant 15** | `SignalsTab` (22), `DomainsTab` (15), `BillingTab` (14), `OrgTab` (12), `LeaveTypesSection` (10) | Counted in round 5: 73 ad-hoc inline style objects across five tabs, none in the documented exception list, all invisible to the reduced-motion and 44px selector lists. `AnnouncementsSection` (round 4) has **zero** and is the proof it is achievable with the existing utilities. `NotificationsTab` (round 5) was brought to zero except the three inside the verbatim-moved `ReminderField`. Left alone because converting five tabs is a styling refactor of its own, and **no page on this branch has been rendered yet** — changing appearance blind is how the walkthrough gets harder, not easier. Do it in the pass right after the walkthrough. |
| `presence_events` mixes datetime formats | `checkin_at` vs `checkout_at` / `scheduled_checkout_at` | `checkin_at` is SQLite `'YYYY-MM-DD HH:MM:SS'`; the other two are full ISO with `Z`. Comparisons are lexicographic, so every consumer normalises by hand (`toSqliteDt`). A row written with a `T` separator would compare wrong on a boundary day. Needs a data migration, not a code fix. |
| Announcements have no sidebar entry of their own | `src/lib/permissions/screens.ts` | The section rides the Settings screen. It is gated on `Resource.Announcements` independently so access is correct, but the resource has no `Screen`, so nothing in the nav advertises it. |
| No dense list-row class | `globals.css` | `DomainsTab`, `LeaveTypesSection` and the announcements list each hand-roll a bordered row. `.card + .card` was used instead, which is correct but 20px-padded where a denser row would read better. |
| Free-plan `maxUsers` slice can hide members from the office-day preview | `queryWorkspaceEvents` | The preview reads both the uncapped write set and the capped `matched_by` source, falling back to `has_override` for events the capped read omitted. Documented in `office-days.ts`; only bites a free-plan workspace over its seat cap. |

### Notification audit — deferred (2026-09-02)

Found while fixing the cron outage. None of these is fixed; all are real.

| Gap | Where | Why deferred |
|---|---|---|
| ~~No per-member notification mute~~ | — | **Fixed in round 5.** Per-category, push-channel-only mutes; `createNotification` is unconditional so the feed stays a complete record. Locked for `announcements` and `approvals_outcome`. |
| The feed grows forever | `notifications` | No `deleted_at`, no `expires_at`, no retention job, and nothing ever DELETEs. `getNotificationsForUser` takes an `offset` no caller passes, so anything past the newest 50 is unreachable in the UI while still counting toward the unread badge. |
| Dead push subscriptions are only reaped on `410` | `src/lib/push.ts` | `404` is also permanent for FCM/autopush, and repeated `403` means rotated VAPID keys. Those rows survive forever and every send retries them. |
| Archived workspaces still inflate the unified `/me` count | `getUnreadCount`, `requireWsMember` | Neither joins `workspaces.archived_at`. The reminder pass filters it correctly; the feed does not. |
| The bell poll has no ordering or cancellation guard | `NotificationBell.tsx` | A 30s `setInterval` with a bare `fetch` and only a `mounted` flag. A slow response from poll *n* can land after *n+1*; switching workspace does not cancel the in-flight request for the old slug. |
| Pass-1 cron pushes leave no feed row | `api/push/cron` | The 5h / 10h nudges and the auto-checkout confirmation are push-only. **Re-decided in round 5 and deliberately kept:** a nudge to go home is worthless an hour later, and putting it in the feed fills the bell with things nobody revisits. Accepted cost, now larger than before — muting `presence` (or having push denied) means being auto-checked-out with zero in-app evidence. Revisit if anyone reports being surprised by a closed session. |
| Announcement fan-out is unchunked | `announcements` POST | One `Promise.allSettled` over every active member. Fine at 34; wants chunking past a few hundred. |
| `getPushSubscriptionsForUser` returning `[]` is a silent no-op | `src/lib/push.ts` | `Promise.allSettled([])` resolves; there is no signal that a notification reached nobody. |

### Presence / check-in audit — deferred (round 5)

| Gap | Where | Why deferred |
|---|---|---|
| **The check-in state resets on the UTC day, not the workspace's** | `getOpenEventToday()` (`queries/events.ts:173`), `src/app/me/page.tsx:52` | Both use `date('now')` / `toISOString()`, which are **UTC**, so the button flips from *Check out* back to *Check in* at 00:00 UTC — **05:30 IST**, not local midnight. This is the mechanism that produced the 2,060-row open backlog: the row was never closed, it just stopped matching. The reminder pass does this correctly with `todayInTz(ws.display_timezone)`. Deferred because the fix is genuinely ambiguous: `presence_events` carries no `workspace_id` by design, so a member of two workspaces in two timezones has no single answer to "whose midnight". |
| `/api/checkin/extend` reads the *unbounded* `getOpenEvent()` | `api/checkin/extend/route.ts:9` | Every other check-in route uses the date-bounded `getOpenEventToday()`. Before the drain this meant extend could act on a months-old orphan. Low impact once the backlog is closed and the cron is live, but the inconsistency is real. |
| `getActiveMemberIds` does not exclude deactivated users or the author | `queries/workspaces.ts:249` | Weaker than `getMembersWhoCan`, which joins `users` and filters `deleted_at` / `deactivated_at`. Only the announcement fan-out uses it, so a poster is notified of their own announcement and a deactivated member still gets a row. |
| `MILESTONES_H` is declared twice | `api/push/cron/route.ts`, `scripts/drain-open-events.js` | Bound only by a comment. The drain pre-claims every key so a drained row can never push; if the two drift, that guarantee quietly weakens. |

### P3 — dead code

`AccessContext.visibleMemberIds` is now read by `PATCH /api/ws/[slug]/hierarchy`, but
`getActiveMemberIds()` still runs on **every `requireWsAccess` call** i.e. every
workspace API request, for one consumer. Unreferenced:
`getRemindersSentOn`, `listAssetsForEmployee`, `getPendingDocumentCount`,
`softDeleteEmployee`. Attendance page gates `dashboard:read` but fetches an
`approvals:read` endpoint → silent 403 panel. Raw `db.query()` in
`api/me/ws/[slug]/counts/route.ts:17` violates CLAUDE.md principle #1.

### Interaction pass — 24 findings, deferred

Headline: `.page-enter` (380ms) wraps every route and `.fx-spring` (480ms) + stagger
fire *inside* it, so one `/ws` sidebar click costs **~740ms of compounding nested
motion** on a 100+/day action. Real bugs in that set: `Toast` has no `key` so a
second toast never replays its animation; `.ci-fade-target`/`.ci-fade-in` are
hardcoded together so the check-in crossfade is dead code; `.progress > div`
animates on mount but snaps on every subsequent change. Nothing has an exit
animation. Full table in the round-2 review output.

### Pre-existing landmine the new code leans on

`src/lib/db/index.ts:58-68` — the **local SQLite** `transaction()` wraps an awaited
async callback in raw `BEGIN`/`COMMIT` on one shared connection, so two overlapping
`db.transaction()` calls interleave and one can commit or roll back the other's
writes. Turso's path is correct, so this is dev-only — but `createEmployee`,
`archiveEmployee`, `restoreEmployee`, `deleteDocument` and `insertDocumentBlob` are
all new transaction users, so dev hits it far more often now.

---
