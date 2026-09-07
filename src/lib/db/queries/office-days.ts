import { db } from '../index'
import { localMidnightToUtc } from '@/lib/timezone'
import { dateKeyInTimezone, nextDateKey } from '@/lib/attendance-summary'

/**
 * Bulk "office day" declarations.
 *
 * An admin declares a date an office day and everyone who was working that date
 * — but whose signals did not verify — is counted as WFO. The mechanism is
 * deliberately NOT a new table and NOT an edit to `presence_events` (invariant
 * 4): it writes one `admin_overrides` row per presence event on the date. From
 * there `lib/signals.ts` already reports those events as `matched_by:
 * 'override'`, and `isOfficeMatched()` in `lib/attendance-summary.ts` already
 * counts `'override'` as an office day. The monthly grid, the analytics screen,
 * the XLSX export, `/me`'s WFO/WFH tiles and the insights trend therefore all
 * pick the change up with no read-path change at all.
 *
 * ── source ────────────────────────────────────────────────────────────────
 * `admin_overrides.source` is what makes undo safe. Two features write this
 * table — an approved regularization and a bulk office day — and deleting an
 * office day must never delete somebody's approved regularization. Every row
 * written here carries `source = 'office_day'` and every delete here is
 * restricted to it. Rows written by the regularization path (`source` NULL or
 * `'regularization'`) are invisible to this file's DELETE.
 *
 * ── idempotency ───────────────────────────────────────────────────────────
 * `idx_admin_overrides_event` is UNIQUE on `(workspace_id, presence_event_id)`,
 * so `INSERT OR IGNORE` is the whole idempotency story: re-declaring the same
 * day is a no-op, and two admins racing the same date cannot double-write. A
 * read-then-insert would be two statements with a window between them; the
 * index has no window.
 */

/** The `admin_overrides.source` value this feature owns. */
export const OFFICE_DAY_SOURCE = 'office_day'

/**
 * `checkin_at` is stored as a SQLite datetime ("2026-05-12 09:00:00") — space
 * separator, no Z. ISO bounds use "T" (ASCII 84) which sorts above space (32),
 * so a same-day event fails `>= "2026-05-12T00:00:00Z"`. Normalize both bounds
 * before comparing, exactly as `queries/events.ts` does.
 */
function toSqliteDt(s: string): string {
  return s.replace('T', ' ').replace('Z', '').slice(0, 19)
}

/** The half-open UTC window [start, end) covering one workspace-local date. */
function dayBoundsUtc(date: string, timezone: string): { start: string; end: string } {
  return {
    start: toSqliteDt(localMidnightToUtc(date, timezone)),
    end: toSqliteDt(localMidnightToUtc(nextDateKey(date), timezone)),
  }
}

export interface OfficeDayEvent {
  presence_event_id: string
  user_id: string
  /** 1 when an `admin_overrides` row of ANY source already covers this event. */
  has_override: number
  /** The source of that existing override, when there is one. */
  override_source: string | null
}

/**
 * Every live presence event on one workspace-local date, for active members.
 *
 * `presence_events` carries no `workspace_id` (multi-workspace users share one
 * event stream), so the workspace boundary is the membership join — the same
 * shape `queryWorkspaceEvents()` gets by resolving member ids first.
 *
 * This is the complete, un-clamped set: unlike `queryWorkspaceEvents()` it
 * applies no plan history window and no free-plan `maxUsers` cap, because it is
 * used to decide what to WRITE. A cap that silently hides members would make a
 * "mark everyone in office" action quietly skip some of them.
 */
export async function listWorkspaceEventsOnDate(
  workspaceId: string,
  date: string,
  timezone: string,
): Promise<OfficeDayEvent[]> {
  const { start, end } = dayBoundsUtc(date, timezone)
  return db.query<OfficeDayEvent>(
    `SELECT pe.id                                      AS presence_event_id,
            pe.user_id                                 AS user_id,
            CASE WHEN ao.id IS NULL THEN 0 ELSE 1 END  AS has_override,
            ao.source                                  AS override_source
     FROM presence_events pe
     JOIN workspace_members wm
       ON wm.user_id = pe.user_id
      AND wm.workspace_id = ?
      AND wm.status = 'active'
     LEFT JOIN admin_overrides ao
       ON ao.presence_event_id = pe.id
      AND ao.workspace_id = ?
     WHERE pe.deleted_at IS NULL
       AND pe.checkin_at >= ?
       AND pe.checkin_at <  ?
     ORDER BY pe.checkin_at ASC`,
    [workspaceId, workspaceId, start, end],
  )
}

/**
 * Set-based `INSERT OR IGNORE` of office-day overrides.
 *
 * Deliberately NOT `createAdminOverride()` in a loop: that helper does one
 * INSERT plus one SELECT per row, so a 200-person office day would be 400 round
 * trips to Turso. Rows are chunked at 100 (600 bound parameters) to stay well
 * inside SQLite's variable limit.
 *
 * Returns the number of rows actually written — events already carrying an
 * override are ignored by the unique index and are not counted.
 */
export async function bulkCreateOfficeDayOverrides(params: {
  workspaceId: string
  adminUserId: string
  presenceEventIds: string[]
  note?: string | null
}): Promise<number> {
  if (params.presenceEventIds.length === 0) return 0

  const CHUNK = 100
  let written = 0

  for (let i = 0; i < params.presenceEventIds.length; i += CHUNK) {
    const chunk = params.presenceEventIds.slice(i, i + CHUNK)
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const bindings = chunk.flatMap((eventId) => [
      crypto.randomUUID().replace(/-/g, ''),
      params.workspaceId,
      eventId,
      params.adminUserId,
      params.note ?? null,
      OFFICE_DAY_SOURCE,
    ])

    const { changes } = await db.execute(
      `INSERT OR IGNORE INTO admin_overrides
         (id, workspace_id, presence_event_id, admin_user_id, note, source)
       VALUES ${values}`,
      bindings,
    )
    written += changes
  }

  return written
}

/**
 * Undo one office day.
 *
 * Restricted to `source = 'office_day'`, so an approved regularization's
 * override on the same event survives untouched. The event set is resolved in
 * a subquery rather than passed in from the caller: the delete is then one
 * statement against the same date window the declare used, and cannot drift
 * from it or race a check-in that landed in between.
 *
 * The membership join deliberately omits `status = 'active'`: undo must be able
 * to clean up rows for somebody who was deactivated after the day was declared.
 */
export async function deleteOfficeDayOverrides(
  workspaceId: string,
  date: string,
  timezone: string,
): Promise<number> {
  const { start, end } = dayBoundsUtc(date, timezone)
  const { changes } = await db.execute(
    `DELETE FROM admin_overrides
     WHERE workspace_id = ?
       AND source = ?
       AND presence_event_id IN (
         SELECT pe.id
         FROM presence_events pe
         JOIN workspace_members wm
           ON wm.user_id = pe.user_id AND wm.workspace_id = ?
         WHERE pe.checkin_at >= ? AND pe.checkin_at < ?
       )`,
    [workspaceId, OFFICE_DAY_SOURCE, workspaceId, start, end],
  )
  return changes
}

export interface DeclaredOfficeDay {
  /** Workspace-local `YYYY-MM-DD`. */
  date: string
  /** How many presence events on that date carry an office-day override. */
  eventCount: number
  /** How many distinct people that is. */
  peopleCount: number
  note: string | null
  /** When the first override for that date was written. */
  declaredAt: string
}

/**
 * The currently-declared office days.
 *
 * There is no `office_days` table — an office day IS its override rows, so the
 * list is DERIVED from them. That keeps one source of truth: a day cannot show
 * as "declared" while the overrides that make it real have been rolled back,
 * and undo needs to delete exactly one thing.
 *
 * The DISTINCT date has to be computed in JS rather than in SQL. `checkin_at`
 * is UTC and the day an event belongs to is a WORKSPACE-LOCAL day; SQLite has
 * no IANA timezone support, so `date(checkin_at)` would put every evening
 * check-in in an Asia/Kolkata workspace on the wrong day. `dateKeyInTimezone()`
 * — the same helper `summarizeAttendanceDays()` buckets by — is the only
 * correct answer, and it only exists in TypeScript. The row set is bounded by
 * (team size x declared days), so grouping in memory is cheap.
 */
export async function listDeclaredOfficeDays(
  workspaceId: string,
  timezone: string,
): Promise<DeclaredOfficeDay[]> {
  const rows = await db.query<{
    user_id: string
    checkin_at: string
    note: string | null
    created_at: string
  }>(
    `SELECT pe.user_id, pe.checkin_at, ao.note, ao.created_at
     FROM admin_overrides ao
     JOIN presence_events pe ON pe.id = ao.presence_event_id
     WHERE ao.workspace_id = ? AND ao.source = ?
     ORDER BY ao.created_at ASC`,
    [workspaceId, OFFICE_DAY_SOURCE],
  )

  const byDate = new Map<string, { users: Set<string>; events: number; note: string | null; declaredAt: string }>()

  for (const row of rows) {
    const date = dateKeyInTimezone(row.checkin_at, timezone)
    const bucket = byDate.get(date)
    if (bucket) {
      bucket.users.add(row.user_id)
      bucket.events++
      // First row wins the note and the timestamp - rows are ordered by
      // created_at, so that is the declaration that opened the day.
    } else {
      byDate.set(date, {
        users: new Set([row.user_id]),
        events: 1,
        note: row.note,
        declaredAt: row.created_at,
      })
    }
  }

  return [...byDate.entries()]
    .map(([date, bucket]) => ({
      date,
      eventCount: bucket.events,
      peopleCount: bucket.users.size,
      note: bucket.note,
      declaredAt: bucket.declaredAt,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
