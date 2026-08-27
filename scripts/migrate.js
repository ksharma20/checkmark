#!/usr/bin/env node
// Consolidated database migration - single script, fully idempotent.
//
// Local SQLite:  node scripts/migrate.js
// Turso (prod):  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate.js
//
// Behaviour:
//   Fresh DB  - creates every table + all columns; ALTER TABLE statements silently skip.
//   Existing  - CREATE TABLE IF NOT EXISTS skips; ALTER TABLE adds missing columns.
//   DB rename - if venzio.db absent but venzio.db present, copies it automatically.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs   = require('fs')

// Load .env.local so TURSO_* vars are available when running locally
try {
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
    })
} catch { /* .env.local absent - fine */ }

// ─── Schema ───────────────────────────────────────────────────────────────────

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email         TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL,
  scopes       TEXT NOT NULL DEFAULT 'checkin:write',
  last_used_at TEXT,
  revoked_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presence_events (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL DEFAULT 'office_checkin',
  checkin_at     TEXT NOT NULL DEFAULT (datetime('now')),
  checkout_at    TEXT,
  note           TEXT,
  wifi_ssid      TEXT,
  ip_address     TEXT NOT NULL,
  ip_geo_lat     REAL,
  ip_geo_lng     REAL,
  gps_lat        REAL,
  gps_lng        REAL,
  gps_accuracy_m INTEGER,
  source         TEXT NOT NULL DEFAULT 'user_app',
  api_token_id   TEXT REFERENCES user_api_tokens(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presence_user_time  ON presence_events(user_id, checkin_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_checkin_at ON presence_events(checkin_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_source     ON presence_events(source);

CREATE TABLE IF NOT EXISTS workspaces (
  id                            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug                          TEXT NOT NULL UNIQUE,
  name                          TEXT NOT NULL,
  plan                          TEXT NOT NULL DEFAULT 'free',
  org_type                      TEXT,
  display_timezone              TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  domain_verified               INTEGER NOT NULL DEFAULT 0,
  verification_token            TEXT,
  verification_token_expires_at TEXT,
  created_at                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_domains (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain       TEXT NOT NULL,
  verified_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, domain)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id             TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                  TEXT REFERENCES users(id) ON DELETE CASCADE,
  email                    TEXT NOT NULL,
  role                     TEXT NOT NULL DEFAULT 'member',
  status                   TEXT NOT NULL DEFAULT 'active',
  consent_token            TEXT,
  consent_token_expires_at TEXT,
  added_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS workspace_roles (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  permissions  TEXT NOT NULL DEFAULT '{}',
  scope        TEXT NOT NULL DEFAULT 'self',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_roles_key
  ON workspace_roles(workspace_id, key) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_roles_ws ON workspace_roles(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_signal_config (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_type       TEXT NOT NULL,
  location_name     TEXT,
  wifi_ssid_hash    TEXT,
  wifi_ssid_display TEXT,
  gps_lat           REAL,
  gps_lng           REAL,
  gps_radius_m      INTEGER DEFAULT 300,
  ip_geo_lat        REAL,
  ip_geo_lng        REAL,
  ip_proximity_m    INTEGER DEFAULT 500,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_overrides (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  presence_event_id TEXT NOT NULL REFERENCES presence_events(id),
  admin_user_id     TEXT NOT NULL REFERENCES users(id),
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id                       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak                INTEGER NOT NULL DEFAULT 0,
  longest_streak                INTEGER NOT NULL DEFAULT 0,
  total_checkins                INTEGER NOT NULL DEFAULT 0,
  total_hours_logged            REAL NOT NULL DEFAULT 0,
  checkins_this_month           INTEGER NOT NULL DEFAULT 0,
  distinct_locations_this_month INTEGER NOT NULL DEFAULT 0,
  last_checkin_date             TEXT,
  updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key        TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_action ON rate_limit_log(key, action, created_at DESC);
`

// ─── System role seeds ────────────────────────────────────────────────────────
//
// Read from src/lib/permissions/system-roles.json - the SAME file the app reads
// via src/lib/permissions/system-roles.ts. Plain JSON precisely so this
// CommonJS script and the TypeScript app can share one definition: they used to
// be separate copies, and the app half was never written, which shipped every
// newly created workspace with no roles at all.
//
// admin = owner minus the things that take the workspace away: no `ownership`
// (transfer / archive / billing).
// member = deliberately empty. Members live on /me and have no org access.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SYSTEM_ROLE_SEED = require("../src/lib/permissions/system-roles.json");

/**
 * Seed the three system roles into every workspace, then backfill owners.
 *
 * Idempotent twice over:
 *   - roles use INSERT OR IGNORE against the partial unique index on
 *     (workspace_id, key) WHERE deleted_at IS NULL
 *   - the owner backfill runs ONLY for workspaces that have no owner yet, so
 *     re-running after admins exist can never mint a second owner
 *
 * Why "earliest-added active admin": transfer-ownership is a swap, so before
 * this migration every workspace has exactly one admin - its creator. That
 * makes the answer unambiguous today and unanswerable once multiple admins
 * become possible, which is why this ships in the same release.
 */
async function seedRolesAndOwners(all, exec) {
  const workspaces = await all(`SELECT id FROM workspaces`)
  let seeded = 0, refreshed = 0, owners = 0, ownerless = 0

  for (const ws of workspaces) {
    for (const role of SYSTEM_ROLE_SEED) {
      const res = await exec(
        `INSERT OR IGNORE INTO workspace_roles
           (id, workspace_id, key, name, description, permissions, scope)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
        [ws.id, role.key, role.name, role.description, JSON.stringify(role.permissions), role.scope]
      )
      if (res && res.changes) seeded += res.changes

      // Refresh the grid on rows that already exist. The three system roles are
      // Venzio's to define - when their permissions change (or a new resource is
      // added to the catalogue) every workspace must pick it up, not just the
      // ones created after the change. Scoped by key, so custom roles the
      // customer created are never touched.
      const upd = await exec(
        `UPDATE workspace_roles
            SET description = ?, permissions = ?, scope = ?, updated_at = datetime('now')
          WHERE workspace_id = ? AND key = ? AND deleted_at IS NULL
            AND permissions != ?`,
        [
          role.description,
          JSON.stringify(role.permissions),
          role.scope,
          ws.id,
          role.key,
          JSON.stringify(role.permissions),
        ]
      )
      if (upd && upd.changes) refreshed += upd.changes
    }

    const existingOwner = await all(
      `SELECT id FROM workspace_members
       WHERE workspace_id = ? AND role = 'owner' AND status = 'active' LIMIT 1`,
      [ws.id]
    )
    if (existingOwner.length > 0) continue

    const candidate = await all(
      `SELECT id FROM workspace_members
       WHERE workspace_id = ? AND role = 'admin' AND status = 'active'
       ORDER BY added_at ASC, id ASC LIMIT 1`,
      [ws.id]
    )
    if (candidate.length === 0) {
      ownerless++
      continue
    }

    await exec(`UPDATE workspace_members SET role = 'owner' WHERE id = ?`, [candidate[0].id])
    owners++
  }

  console.log(
    `✓ Roles seeded - ${workspaces.length} workspace(s), ${seeded} inserted, ${refreshed} system grid(s) refreshed, ${owners} owner(s) backfilled`
  )
  if (ownerless > 0) {
    console.warn(
      `⚠ ${ownerless} workspace(s) have no active admin and therefore no owner - inspect these manually`
    )
  }
}

const ADDITIVE_MIGRATIONS = [
  // users
  `ALTER TABLE users ADD COLUMN deleted_at TEXT`,
  `ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'`,
  `ALTER TABLE users ADD COLUMN timezone_updated_at TEXT`,
  `ALTER TABLE users ADD COLUMN timezone_confirmed INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN deactivated_at TEXT`,
  `ALTER TABLE users ADD COLUMN deactivation_reason TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at)`,

  // otp_codes
  `ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose, created_at DESC)`,

  // presence_events
  `ALTER TABLE presence_events ADD COLUMN deleted_at TEXT`,
  `ALTER TABLE presence_events ADD COLUMN location_label TEXT`,
  `ALTER TABLE presence_events ADD COLUMN checkout_reason TEXT`,
  `ALTER TABLE presence_events ADD COLUMN checkout_gps_lat REAL`,
  `ALTER TABLE presence_events ADD COLUMN checkout_gps_lng REAL`,
  `ALTER TABLE presence_events ADD COLUMN checkout_gps_accuracy_m INTEGER`,
  `ALTER TABLE presence_events ADD COLUMN checkout_wifi_ssid TEXT`,
  `ALTER TABLE presence_events ADD COLUMN checkout_ip_address TEXT`,
  `ALTER TABLE presence_events ADD COLUMN checkout_ip_geo_lat REAL`,
  `ALTER TABLE presence_events ADD COLUMN checkout_ip_geo_lng REAL`,
  `ALTER TABLE presence_events ADD COLUMN checkout_location_label TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_presence_events_deleted ON presence_events(deleted_at)`,

  // workspaces
  `ALTER TABLE workspaces ADD COLUMN archived_at TEXT`,

  // presence_events - feedback round 1
  `ALTER TABLE presence_events ADD COLUMN checkout_location_mismatch INTEGER`,
  `ALTER TABLE presence_events ADD COLUMN device_info TEXT`,
  `ALTER TABLE presence_events ADD COLUMN trust_flags TEXT`,
  `ALTER TABLE presence_events ADD COLUMN device_timezone TEXT`,

  // admin_overrides - effective checkout for regularization
  `ALTER TABLE admin_overrides ADD COLUMN effective_checkout_at TEXT`,

  // user_api_tokens - fast prefix lookup (O(1) instead of O(n) bcrypt scan)
  `ALTER TABLE user_api_tokens ADD COLUMN token_prefix TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_api_tokens_prefix ON user_api_tokens(token_prefix)`,

  // presence_events - scheduled midnight auto-checkout
  `ALTER TABLE presence_events ADD COLUMN scheduled_checkout_at TEXT`,

  // presence_events - push reminder tracking
  `ALTER TABLE presence_events ADD COLUMN push_reminders_sent TEXT`,

  // workspaces - remote work toggle
  `ALTER TABLE workspaces ADD COLUMN allow_remote INTEGER NOT NULL DEFAULT 0`,

  // workspaces - leaves & holidays feature toggle
  `ALTER TABLE workspaces ADD COLUMN leaves_enabled INTEGER NOT NULL DEFAULT 1`,

  // workspaces - working days configuration
  `ALTER TABLE workspaces ADD COLUMN working_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]'`,

  // push_subscriptions - Web Push
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`,

  // workspace_holidays - company holiday calendar
  `CREATE TABLE IF NOT EXISTS workspace_holidays (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  date         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_holidays_ws_date ON workspace_holidays(workspace_id, date)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_holidays_ws_name_date_active ON workspace_holidays(workspace_id, name, date) WHERE deleted_at IS NULL`,

  // workspace_leave_types - per-workspace configurable leave types
  `CREATE TABLE IF NOT EXISTS workspace_leave_types (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  accrual_frequency TEXT NOT NULL DEFAULT 'monthly',
  accrual_credits   INTEGER NOT NULL DEFAULT 1,
  credit_timing     TEXT NOT NULL DEFAULT 'start',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at        TEXT
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wlt_ws_name_active
   ON workspace_leave_types(workspace_id, name) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_wlt_workspace ON workspace_leave_types(workspace_id)`,

  // leave_requests - employee leave submissions
  `CREATE TABLE IF NOT EXISTS leave_requests (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id),
  leave_type_id        TEXT NOT NULL REFERENCES workspace_leave_types(id),
  start_date           TEXT NOT NULL,
  end_date             TEXT NOT NULL,
  reason               TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  rejection_reason     TEXT,
  actioned_by_user_id  TEXT REFERENCES users(id),
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_leave_requests_ws_user
   ON leave_requests(workspace_id, user_id)`,

  // leave_cutover_date - workspace-level migration anchor date for opening balances
  `ALTER TABLE workspaces ADD COLUMN leave_cutover_date TEXT`,

  // leave_opening_balances - carried-over balances when migrating from another system
  `CREATE TABLE IF NOT EXISTS leave_opening_balances (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id),
  leave_type_id   TEXT NOT NULL REFERENCES workspace_leave_types(id),
  balance_days    REAL NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_lob_ws_user_type
   ON leave_opening_balances (workspace_id, user_id, leave_type_id)`,

  // employees - core identity + contact (Zoho People compatible)
  `CREATE TABLE IF NOT EXISTS employees (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id),
  employee_id       TEXT,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  gender            TEXT CHECK(gender IN ('male','female','non_binary','prefer_not_to_say')),
  date_of_birth     TEXT,
  marital_status    TEXT CHECK(marital_status IN ('single','married','divorced','widowed','separated')),
  number_of_children INTEGER,
  blood_group       TEXT CHECK(blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  photo_url         TEXT,
  personal_email    TEXT,
  work_email        TEXT NOT NULL,
  phone             TEXT,
  alternate_phone   TEXT,
  current_address   TEXT,
  permanent_address TEXT,
  employee_status              TEXT NOT NULL DEFAULT 'active' CHECK(employee_status IN ('active','terminated','suspended','on_leave','notice_period')),
  emergency_contact_name       TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone      TEXT,
  deleted_at                   TEXT,
  created_at                   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_ws_emp_id
   ON employees(workspace_id, employee_id)
   WHERE employee_id IS NOT NULL AND deleted_at IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_ws_work_email
   ON employees(workspace_id, work_email)
   WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_employees_workspace ON employees(workspace_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_status    ON employees(workspace_id, employee_status)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_user      ON employees(user_id)`,

  // employment_details - job/HR data (1:1 with employees, ready for history later)
  `CREATE TABLE IF NOT EXISTS employment_details (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id           TEXT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  workspace_id          TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  designation           TEXT,
  department            TEXT,
  work_location         TEXT,
  work_mode             TEXT CHECK(work_mode IN ('office','remote','hybrid')),
  reporting_manager_id  TEXT REFERENCES employees(id),
  employment_type       TEXT CHECK(employment_type IN ('full_time','part_time','contract','intern','consultant')),
  source_of_hire        TEXT CHECK(source_of_hire IN ('direct','referral','job_portal','consultancy','campus')),
  total_work_experience REAL,
  date_of_joining       TEXT,
  confirmation_date     TEXT,
  probation_end_date    TEXT,
  exit_date             TEXT,
  exit_reason           TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_employee ON employment_details(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_dept     ON employment_details(workspace_id, department)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_location ON employment_details(workspace_id, work_location)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_doj      ON employment_details(workspace_id, date_of_joining)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_exit     ON employment_details(workspace_id, exit_date)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_type     ON employment_details(workspace_id, employment_type)`,
  `CREATE INDEX IF NOT EXISTS idx_employment_details_manager  ON employment_details(workspace_id, reporting_manager_id)`,

  // employee_sensitive - financial + statutory IDs, all AES-256-GCM encrypted (1:1 with employees)
  `CREATE TABLE IF NOT EXISTS employee_sensitive (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id            TEXT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  workspace_id           TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pan_encrypted          TEXT,
  aadhaar_encrypted      TEXT,
  uan                    TEXT,
  passport_number        TEXT,
  bank_account_encrypted TEXT,
  bank_ifsc              TEXT,
  bank_name              TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_employee_sensitive_employee ON employee_sensitive(employee_id)`,

  // notifications - in-app notification feed
  `CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  ref_id       TEXT,
  ref_type     TEXT,
  read_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_list ON notifications(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id, created_at DESC)`,

  // regularization_requests - employee-initiated attendance correction requests
  `CREATE TABLE IF NOT EXISTS regularization_requests (
  id                         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id               TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                    TEXT NOT NULL REFERENCES users(id),
  target_date                TEXT NOT NULL,
  presence_event_id          TEXT REFERENCES presence_events(id),
  requested_type             TEXT NOT NULL CHECK(requested_type IN ('office','remote')),
  reason                     TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'pending',
  rejection_reason           TEXT,
  actioned_by_user_id        TEXT REFERENCES users(id),
  resulting_presence_event_id TEXT REFERENCES presence_events(id),
  created_at                 TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_regularization_ws_user ON regularization_requests(workspace_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_regularization_ws_status ON regularization_requests(workspace_id, status)`,
  // Superseded by idx_regularization_ws_user_date_active below, which also covers 'approved'
  // so a second request can't be inserted for a date that's already approved.
  `DROP INDEX IF EXISTS idx_regularization_ws_user_date_pending`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_regularization_ws_user_date_active
   ON regularization_requests(workspace_id, user_id, target_date) WHERE status IN ('pending','approved')`,
];

// ─── SQLite runner (local dev) ────────────────────────────────────────────────

async function runSQLite() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  const dbPath = path.join(__dirname, "../venzio.db");
  const oldPath = path.join(__dirname, "../venzio.db");

  if (!fs.existsSync(dbPath) && fs.existsSync(oldPath)) {
    fs.copyFileSync(oldPath, dbPath);
    console.log("✓ Copied venzio.db → venzio.db");
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const baseStatements = BASE_SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  let ran = 0,
    skipped = 0;
  for (const stmt of baseStatements) {
    try {
      db.prepare(stmt).run();
      ran++;
    } catch (err) {
      console.error(`Failed:\n${stmt}\n`, err);
      process.exit(1);
    }
  }
  for (const stmt of ADDITIVE_MIGRATIONS) {
    try {
      db.prepare(stmt).run();
      ran++;
    } catch (err) {
      const msg = err.message ?? "";
      const isDropColumn = stmt.trim().toUpperCase().includes('DROP COLUMN')
      if (
        msg.includes("duplicate column") ||
        msg.includes("already exists") ||
        (isDropColumn && msg.includes("no such column"))
      ) {
        skipped++;
      } else {
        console.error(`Failed:\n${stmt}\n`, err);
        process.exit(1);
      }
    }
  }

  await seedRolesAndOwners(
    (sql, params = []) => db.prepare(sql).all(...params),
    (sql, params = []) => db.prepare(sql).run(...params),
  );

  db.close();
  console.log(
    `✓ SQLite migration complete - ${ran} executed, ${skipped} skipped - ${dbPath}`,
  );
}

// ─── Turso runner (production) ────────────────────────────────────────────────

async function runTurso() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@libsql/client')
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  const baseStatements = BASE_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)

  let ran = 0, skipped = 0
  for (const stmt of baseStatements) {
    try { await client.execute(stmt); ran++ }
    catch (err) { console.error(`Failed:\n${stmt}\n`, err); process.exit(1) }
  }
  for (const stmt of ADDITIVE_MIGRATIONS) {
    try { await client.execute(stmt); ran++ }
    catch (err) {
      const msg = err.message ?? ''
      const isDropColumn = stmt.trim().toUpperCase().includes('DROP COLUMN')
      if (
        msg.includes('duplicate column') ||
        msg.includes('already exists') ||
        (isDropColumn && msg.includes('no such column'))
      ) { skipped++ }
      else { console.error(`Failed:\n${stmt}\n`, err); process.exit(1) }
    }
  }

  await seedRolesAndOwners(
    async (sql, args = []) => (await client.execute({ sql, args })).rows,
    async (sql, args = []) => {
      const r = await client.execute({ sql, args })
      return { changes: r.rowsAffected }
    },
  )

  await client.close()
  console.log(`✓ Turso migration complete - ${ran} executed, ${skipped} skipped - ${process.env.TURSO_DATABASE_URL}`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (process.env.TURSO_DATABASE_URL) {
  runTurso().catch(err => { console.error(err); process.exit(1) })
} else {
  runSQLite().catch(err => { console.error(err); process.exit(1) })
}
