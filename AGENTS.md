# CheckMark - AGENTS.md

AI agent coordination guide for working on this codebase.

---

## Agent Roles

### Explore Agent
**Use for:** Understanding existing code before changing it.
- Read files in `src/lib/`, `src/app/api/`, `src/app/(public)/`, `src/app/me/`, `src/app/ws/`
- Map signal flow: client → API route → query function → DB
- Check schema in `lib/db/schema.ts` + `scripts/migrate.js`
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
- Verify all workspace routes call `requireWsAdmin()`
- Verify no raw SQL in route handlers
- Check cookie settings (httpOnly, SameSite, secure)

### Reviewer Agent
**Use for:** Validating a completed change before merge.
- Run `npm run build` - must pass
- Verify changed routes use `getServerUser()` not req.body.userId
- Verify new DB queries are in `lib/db/queries/` not inline
- Check for new signal matching logic - must be AND semantics

---

## Task Boundaries

### Safe to parallelize (no shared state)
- Marketing page changes (`src/app/(public)/`)
- Different API route domains (checkin vs workspace vs me)
- Different query files (`users.ts` vs `events.ts`)
- UI components that don't share state

### Must be sequential (shared state)
- Schema changes + migration script + query functions that use new columns
- Signal matching logic changes + dashboard display changes
- Auth flow changes (proxy.ts + auth.ts + login page)

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

---

## Route Handler Pattern

```ts
// src/app/api/ws/[slug]/example/route.ts
import { requireWsAdmin } from '@/lib/ws-admin'
import { getServerUser } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await requireWsAdmin(req, params.slug)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ctx.workspace.id and ctx.userId are now verified
  const data = await getSomethingForWorkspace(ctx.workspace.id)
  return NextResponse.json(data)
}
```

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

Common codes: `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`, `ALREADY_EXISTS`, `RATE_LIMITED`, `PLAN_LIMIT`.

---

## When to Read First

Before editing any of these files, always read them first:
- `lib/signals.ts` - core logic, easy to break AND semantics
- `lib/auth.ts` - security-critical, JWT + cookie handling
- `lib/db/schema.ts` - understand all columns before adding queries
- `proxy.ts` - edge middleware, limited runtime (no Node.js APIs)

---

## What Agents Must Not Do

- Write SQL directly in route files
- Modify `presence_events` rows (immutable after insert, except `note`)
- Delete user/workspace data (soft delete only)
- Store raw WiFi SSIDs (always bcrypt hash)
- Add drop shadows or gradients to UI components
- Introduce new npm dependencies without noting it in the PR description
- Change signal matching from AND to OR logic
- Trust userId or workspaceId from request body without JWT verification

---

## Keeping Docs in Sync

**REQUIRED:** Whenever you change code that affects documented behaviour - API routes, auth flow, signal matching logic, plan limits, cookie settings, DB schema, environment variables - you MUST also update the relevant docs:

1. `README.md` - update the affected section
2. `CLAUDE.md` - update invariants, architecture, or key rules if affected
3. `AGENTS.md` - update conventions or patterns if affected

Never let code and docs diverge. Stale docs cause bugs in future AI-assisted sessions because agents rely on them for context.

**What counts as "documented behaviour":**
- Adding/removing/renaming API routes
- Changing HTTP status codes or error codes
- Modifying auth flow (cookies, OTP, JWT)
- Changing signal matching semantics
- Adding DB columns or tables
- Changing plan limits or feature flags
- Adding/removing environment variables
