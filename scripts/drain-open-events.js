#!/usr/bin/env node
// One-off backlog drain - closes presence events the cron should have closed.
//
//   Dry run (default):  node scripts/drain-open-events.js
//   Apply:              node scripts/drain-open-events.js --apply
//   Turso (prod):       TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/drain-open-events.js --apply
//
// Why this exists
// ───────────────
// `POST /api/push/cron` was unreachable for months, so nothing ever ran the
// auto-checkout branch. The result is thousands of `presence_events` rows still
// open with a `scheduled_checkout_at` long in the past - the oldest from April.
// The cron route now refuses to touch anything older than 48h
// (`CRON_MAX_EVENT_AGE_H` in src/lib/db/queries/events.ts) precisely so a future
// outage cannot rebuild that backlog and then fire thousands of pushes on
// recovery. That guard also means these old rows will never be closed by the
// cron: they have to be closed here, once, by hand.
//
// THIS SCRIPT SENDS NO PUSH NOTIFICATIONS. That is the whole point of doing it
// out-of-band rather than letting the cron catch up. It writes:
//
//   checkout_at         = the scheduled checkout time (not "now" - the honest
//                         answer is when the auto-checkout was due, and using
//                         now would invent hours nobody worked)
//   checkout_reason     = 'backlog_drain'  (distinguishable forever from a real
//                         'auto_checkout' the cron performed on time)
//   push_reminders_sent = every dedupe key the cron could ever want to claim
//
// The last one is belt-and-braces: a closed row is already invisible to
// `getOpenEventsForCron()`, so nothing would fire anyway. But if some future
// query ever revisits these rows, every milestone, the auto-checkout key and the
// warning key are already marked as sent, so no push can be produced from them.
//
// Invariant 4 (events are immutable) is respected in spirit: this writes the
// checkout columns the auto-checkout path owns. It never deletes a row, never
// touches `checkin_at`, and never rewrites a note.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')

// Load .env.local so TURSO_* vars are available when running locally
try {
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
    })
} catch { /* .env.local absent - fine */ }

const APPLY = process.argv.includes('--apply')

// Every dedupe key any ladder could ever claim for a row, as a UNION across all
// of them rather than a copy of the current one. The point of this list is that a
// drained row can never produce a push: a row this script wrote is immutable, so
// a reader that resurrects a retired key must still find it claimed.
//
// The ladder is no longer a fixed list. `resolveLadder()` in
// src/lib/presence-ladder.ts builds it per member from their own hours, so the
// keys are now `half`, `full` and `ot-<n>` rather than `<hours>h`. The numeric
// keys below are retired but stay here for exactly the reason above - and note
// that `normaliseLadderKey()` maps only '5h' and '10h' onto the modern names, so
// the rest would otherwise be unclaimed by anything.
//
// `OT_MAX` is derived, not guessed: overtime rungs run while
// `full + n * repeat < autoCheckout`, so the worst case is the smallest legal
// `full` and `repeat` (MIN_RUNG_H / MIN_REPEAT_H, both 0.5) against the largest
// legal close (MAX_AUTO_CHECKOUT_H, 24) - i.e. 0.5 + 0.5n < 24, giving n <= 46.
// Those constants live in src/lib/presence-ladder.ts; this file is plain JS and
// cannot import the TypeScript module, so changing any of the three means
// changing this number too.
const MILESTONES_H = [4, 5, 8, 10, 12, 16, 18, 20, 22]
const OT_MAX = 46

const SELECT_OPEN = `
  SELECT id, user_id, checkin_at, scheduled_checkout_at
  FROM presence_events
  WHERE checkout_at IS NULL AND deleted_at IS NULL
  ORDER BY checkin_at ASC
`

// Guarded on `checkout_at IS NULL` so a re-run, or a real checkout that landed
// between the SELECT and the UPDATE, is a no-op rather than an overwrite.
const CLOSE_ONE = `
  UPDATE presence_events
  SET checkout_at = ?, checkout_reason = 'backlog_drain', push_reminders_sent = ?
  WHERE id = ? AND checkout_at IS NULL
`

/** Every dedupe key the cron could ever claim for this row. */
function remindersFor(scheduledCheckoutAt) {
  return JSON.stringify([
    ...MILESTONES_H.map((h) => `${h}h`),
    // The member-configured ladder: two named rungs plus every reachable
    // overtime rung. Cheap to over-claim - this array is only ever read as a
    // membership test - and the cost of under-claiming is a push to somebody
    // whose session was closed by a backlog drain months ago.
    'half',
    'full',
    ...Array.from({ length: OT_MAX }, (_, i) => `ot-${i + 1}`),
    // Same shape the cron builds: `warn_${scheduled_checkout_at.slice(0, 16)}`.
    `warn_${String(scheduledCheckoutAt).slice(0, 16)}`,
    'autocheckedout',
  ])
}

/**
 * Split the open rows into what this script may close and what it must leave.
 * `scheduled_checkout_at` is written as a full ISO string, so Date.parse is the
 * right reader; anything unparseable is left alone rather than guessed at.
 */
function plan(rows, now) {
  const closable = []
  let noSchedule = 0
  let notYetDue = 0
  let unparseable = 0

  for (const row of rows) {
    const scheduled = row.scheduled_checkout_at
    if (!scheduled) { noSchedule++; continue }
    const ms = Date.parse(scheduled)
    if (Number.isNaN(ms)) { unparseable++; continue }
    if (ms > now) { notYetDue++; continue }
    closable.push({ id: row.id, checkoutAt: new Date(ms).toISOString(), scheduled })
  }

  return { closable, noSchedule, notYetDue, unparseable }
}

function report(rows, result) {
  const oldest = rows.length ? rows[0].checkin_at : null
  console.log('')
  console.log(`  open events            ${rows.length}`)
  console.log(`  oldest check-in        ${oldest ?? '-'}`)
  console.log(`  → closable (due)       ${result.closable.length}`)
  console.log(`  · no scheduled time    ${result.noSchedule}`)
  console.log(`  · checkout not yet due ${result.notYetDue}`)
  if (result.unparseable) console.log(`  · unreadable timestamp ${result.unparseable}`)
  console.log('')
  if (!APPLY) {
    console.log('  DRY RUN - nothing written. Re-run with --apply to close them.')
    console.log('')
  }
}

async function drain(queryRows, execute, label) {
  const rows = await queryRows(SELECT_OPEN)
  const now = Date.now()
  const result = plan(rows, now)

  report(rows, result)
  if (!APPLY) return

  let closed = 0
  let skipped = 0
  for (const row of result.closable) {
    const { changes } = await execute(CLOSE_ONE, [row.checkoutAt, remindersFor(row.scheduled), row.id])
    if (changes > 0) closed++
    else skipped++
  }

  console.log(`✓ Drain complete - ${closed} closed, ${skipped} already closed - ${label}`)
  console.log('  No push notifications were sent.')
  console.log('')
}

// ─── SQLite runner (local) ────────────────────────────────────────────────────

async function runSQLite() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  const dbPath = process.env.LOCAL_DATABASE_PATH || path.join(__dirname, '../venzio.db')

  if (!fs.existsSync(dbPath)) {
    console.error(`No database at ${dbPath}`)
    process.exit(1)
  }

  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')

  await drain(
    async (sql, args = []) => db.prepare(sql).all(...args),
    async (sql, args = []) => ({ changes: db.prepare(sql).run(...args).changes }),
    dbPath,
  )

  db.close()
}

// ─── Turso runner (production) ────────────────────────────────────────────────

async function runTurso() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client')
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  await drain(
    async (sql, args = []) => (await client.execute({ sql, args })).rows,
    async (sql, args = []) => {
      const r = await client.execute({ sql, args })
      return { changes: r.rowsAffected }
    },
    process.env.TURSO_DATABASE_URL,
  )

  await client.close()
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (process.env.TURSO_DATABASE_URL) {
  runTurso().catch((err) => { console.error(err); process.exit(1) })
} else {
  runSQLite().catch((err) => { console.error(err); process.exit(1) })
}
