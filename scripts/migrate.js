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
  manager_user_id          TEXT REFERENCES users(id),
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

  // workspace_members - reporting hierarchy
  //
  // One nullable column IS the org chart: no join table, one manager per person.
  // NULL means "not explicitly assigned" and is resolved to the workspace owner
  // at READ time (src/lib/hierarchy.ts), never written here - storing the
  // owner's id on every unassigned row would need a rewrite of them all on each
  // ownership transfer, and would make "never assigned" indistinguishable from
  // "deliberately reports to the owner".
  `ALTER TABLE workspace_members ADD COLUMN manager_user_id TEXT REFERENCES users(id)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_manager
     ON workspace_members(workspace_id, manager_user_id)`,

  // presence_events - feedback round 1
  `ALTER TABLE presence_events ADD COLUMN checkout_location_mismatch INTEGER`,
  `ALTER TABLE presence_events ADD COLUMN device_info TEXT`,
  `ALTER TABLE presence_events ADD COLUMN trust_flags TEXT`,
  `ALTER TABLE presence_events ADD COLUMN device_timezone TEXT`,

  // admin_overrides - effective checkout for regularization
  `ALTER TABLE admin_overrides ADD COLUMN effective_checkout_at TEXT`,

  // admin_overrides - tell an office day apart from a regularization
  //
  // Both write this table, and undoing a bulk office day must not delete an
  // approved regularization. Mirrors `presence_events.source`, which already
  // carries 'regularization' / 'user_app'. Backfilled to 'regularization'
  // because that route was the only writer before office days existed.
  `ALTER TABLE admin_overrides ADD COLUMN source TEXT`,
  `UPDATE admin_overrides SET source = 'regularization' WHERE source IS NULL`,

  // The UNIQUE index IS the idempotency guarantee for the bulk office-day
  // insert - re-declaring the same day becomes INSERT OR IGNORE and a no-op.
  // A pre-read would be two statements and a race. Verified 0 duplicate
  // (workspace_id, presence_event_id) pairs before adding this.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_overrides_event
     ON admin_overrides(workspace_id, presence_event_id)`,
  // getOverrideEventIds() runs on EVERY queryWorkspaceEvents call, i.e. every
  // workspace API request, and this table had no index at all.
  `CREATE INDEX IF NOT EXISTS idx_admin_overrides_ws ON admin_overrides(workspace_id)`,

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

  // workspace_announcements - workspace-wide notices (policy updates, office days)
  //
  // The canonical record, so an admin can see and retract what they posted.
  // DELIVERY is a fan-out of ordinary `notifications` rows referencing this id,
  // which is what gives every recipient their own read state, bell count and
  // feed entry with no new machinery. Retracting hides the announcement; it
  // does not unsend what was already delivered.
  `CREATE TABLE IF NOT EXISTS workspace_announcements (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_announcements_ws
     ON workspace_announcements(workspace_id, created_at DESC)`,

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

  // employee_sensitive - financial + statutory IDs. The columns carrying a
  // number that identifies an account are AES-256-GCM encrypted (the
  // `_encrypted` suffix says which); the descriptive ones beside them - IFSC,
  // bank name, account holder name - are plaintext, because they identify a
  // branch or repeat a name the employees row already stores in the clear.
  `CREATE TABLE IF NOT EXISTS employee_sensitive (
  id                       TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  employee_id              TEXT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  workspace_id             TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pan_encrypted            TEXT,
  aadhaar_encrypted        TEXT,
  uan                      TEXT,
  passport_number          TEXT,
  bank_account_encrypted   TEXT,
  bank_ifsc                TEXT,
  bank_name                TEXT,
  bank_account_holder_name TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
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

  // workspace_assets - company hardware/equipment register, optionally assigned
  // to an employee. Soft-deleted so an asset's history survives retirement.
  `CREATE TABLE IF NOT EXISTS workspace_assets (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category             TEXT,
  name                 TEXT NOT NULL,
  serial_number        TEXT,
  condition            TEXT,
  status               TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('assigned','available','repair','retired')),
  assigned_employee_id TEXT REFERENCES employees(id),
  assigned_at          TEXT,
  purchase_value       REAL,
  notes                TEXT,
  deleted_at           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_assets_ws       ON workspace_assets(workspace_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_assets_status   ON workspace_assets(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_assets_assignee ON workspace_assets(assigned_employee_id)`,

  // employee_documents - METADATA ONLY. Bytes never live here; they live in
  // employee_document_blobs so listing a folder never drags megabytes of
  // base64 through the query.
  `CREATE TABLE IF NOT EXISTS employee_documents (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id   TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_key       TEXT NOT NULL,
  name          TEXT NOT NULL,
  owner         TEXT NOT NULL CHECK(owner IN ('admin','employee')),
  status        TEXT NOT NULL CHECK(status IN ('missing','pending','verified','rejected','issued')),
  file_name     TEXT,
  mime_type     TEXT,
  size_bytes    INTEGER,
  reject_reason TEXT,
  uploaded_by   TEXT,
  verified_by   TEXT,
  uploaded_at   TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_documents_slot
   ON employee_documents(workspace_id, employee_id, doc_key)
   WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_employee_documents_status   ON employee_documents(workspace_id, status)`,

  // employee_document_blobs - the bytes, base64-encoded, one row per document.
  // Split from the metadata table on purpose (see lib/storage.ts): every list
  // query reads employee_documents and never touches this table.
  `CREATE TABLE IF NOT EXISTS employee_document_blobs (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id  TEXT NOT NULL UNIQUE REFERENCES employee_documents(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_base64  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_employee_document_blobs_ws ON employee_document_blobs(workspace_id)`,

  // maternity_cases - maternity leave tracking, separate from leave_requests
  // because a case spans months and moves through stages rather than being a
  // single immutable request.
  `CREATE TABLE IF NOT EXISTS maternity_cases (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  employee_id  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  due_date     TEXT,
  start_date   TEXT,
  end_date     TEXT,
  weeks        INTEGER NOT NULL DEFAULT 26,
  status       TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','onleave','returned')),
  returned_on  TEXT,
  notes        TEXT,
  deleted_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_maternity_cases_ws       ON maternity_cases(workspace_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_maternity_cases_employee ON maternity_cases(employee_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_maternity_cases_status   ON maternity_cases(workspace_id, status)`,
  // "One running case per employee" - the rule the POST route documents, given
  // an actual constraint. The route's findOpenCaseForEmployee() check is
  // check-then-act: two concurrent POSTs both read "no open case" and both
  // inserted. Partial on purpose - a 'returned' case is history and a
  // soft-deleted one is gone, so an employee may accumulate any number of
  // either; only the OPEN statuses are constrained. Keep the status list in
  // step with OPEN_MATERNITY_STATUSES in lib/db/queries/maternity.ts.
  //
  // If this statement ever fails on an existing database it is because that
  // database already holds two open cases for one employee. That is a data
  // problem to be looked at, not one to be papered over, so it is left to fail
  // loudly rather than being added to the tolerated-error list below.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_maternity_cases_one_open
   ON maternity_cases(workspace_id, employee_id)
   WHERE deleted_at IS NULL AND status IN ('requested','approved','onleave')`,

  // workspaces - scheduled check-in / check-out reminder times.
  // 'HH:MM' wall-clock in the workspace's display_timezone. NULL means the
  // reminder is off, and NULL is deliberately the default: migrating an
  // existing workspace must never silently start notifying its members.
  `ALTER TABLE workspaces ADD COLUMN checkin_reminder_at TEXT`,
  `ALTER TABLE workspaces ADD COLUMN checkout_reminder_at TEXT`,

  // reminder_log - dedupe anchor for the wall-clock reminder pass in
  // /api/push/cron. The event-anchored reminders dedupe on
  // presence_events.push_reminders_sent, but a "you never checked in" reminder
  // has no event to hang that column off, and the cron ticks every 30 minutes.
  // One row per (workspace, user, kind, local_date) is what stops it nagging.
  `CREATE TABLE IF NOT EXISTS reminder_log (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK(kind IN ('checkin','checkout')),
  local_date   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  // The dedupe guarantee itself. Partial so it only constrains the rows that
  // carry a real kind - a row that somehow lands with a NULL kind is a bug to
  // be seen, not a row that silently blocks a legitimate reminder.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_once
   ON reminder_log(workspace_id, user_id, kind, local_date)
   WHERE kind IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_reminder_log_ws_date ON reminder_log(workspace_id, local_date)`,

  // workspaces - which notification categories this workspace has switched off.
  // A JSON array of category keys (see src/lib/notifications/categories.ts).
  //
  // It stores the DISABLED set, not the enabled one, and the default is '[]'.
  // That way every existing workspace keeps every notification it has today,
  // and a category added to the catalogue later is on everywhere with no
  // backfill - the inverse (storing the enabled set) would mean a new category
  // is silently off for every workspace that predates it.
  `ALTER TABLE workspaces ADD COLUMN notification_categories_off TEXT NOT NULL DEFAULT '[]'`,

  // notification_prefs - per-member category push preferences.
  //
  // RETAINED, AND CURRENTLY UNREAD. The catalogue is now exactly two categories,
  // `approvals` and `announcements`, and both are memberMutable: false - so no
  // category is member-mutable today and this table has no live reader or
  // writer. That is deliberate, and the same statement is made from the query
  // side in the header of src/lib/db/queries/notification-prefs.ts. It is a
  // retained mechanism, not dead code awaiting deletion; read on for why it
  // cannot be dropped and re-added later.
  //
  // A ROW IS AN EXPLICIT CHOICE, and `muted` is what it chose. Absence means
  // "never touched it" and falls back to `CATEGORY_DEFS[category].defaultOn` in
  // the catalogue, so nothing is ever seeded and a member who has never opened
  // the settings screen still has no rows at all. That shape is correct
  // independently of which categories happen to exist.
  //
  // It did NOT always carry the boolean: a row used to MEAN muted and un-muting
  // was a DELETE. THAT SHAPE CAN EXPRESS ONE DEFAULT ONLY. Under it, "off by
  // default" and "never chose" are spelled identically - both are absence - and
  // no query can tell them apart. So the column is the precondition for ever
  // adding a default-OFF member-mutable category: adding it after such a
  // category shipped would mean reinterpreting every row already stored, and
  // there is no rule that reinterprets them correctly, because the two meanings
  // were never distinguishable in the first place. Keeping an unread column is
  // cheap; recovering a distinction that was never recorded is not.
  //
  // The two categories that originally motivated the column, `reminders` and
  // `presence`, have since left the catalogue entirely - they became SCHEDULES
  // (member_reminder_prefs and member_presence_prefs, added below), where the
  // configured time or rung hour IS the opt-in and there is no boolean to
  // store. They are not examples of this column any more; the argument above
  // is, and it survives them.
  //
  // workspace_id NULL means an account-level preference rather than a
  // per-workspace one - the shape `presence` needed while it was a category,
  // because presence_events carries no workspace_id and a check-in session
  // therefore belongs to no workspace. Nothing writes a NULL today; the column
  // and its partial indexes stay for the same reason the boolean does.
  `CREATE TABLE IF NOT EXISTS notification_prefs (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  muted        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  // The additive half, for a database that predates the column. DEFAULT 1 is
  // not a neutral choice of filler - it is exactly what every pre-existing row
  // already meant, back when a row's existence WAS the mute. So the backfill
  // reinterprets nothing: a member who had muted a category before this runs is
  // still muted after it. That remains exactly right even though the rows it
  // would have converted are now deleted further down (the `reminders` /
  // `presence` retirement) - the ALTER has to be correct for any database that
  // runs it before reaching that statement, and for any row a future
  // member-mutable category writes.
  `ALTER TABLE notification_prefs ADD COLUMN muted INTEGER NOT NULL DEFAULT 1`,
  // TWO partial unique indexes, not one. SQLite treats NULLs as DISTINCT in a
  // unique index, so a single UNIQUE(user_id, workspace_id, category) would not
  // constrain the account-level rows at all - the same NULL = NULL trap that
  // silently detached invited people's HR records from their memberships.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_ws
   ON notification_prefs(user_id, workspace_id, category)
   WHERE workspace_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_acct
   ON notification_prefs(user_id, category)
   WHERE workspace_id IS NULL`,
  // The bulk read path: "who in this workspace has muted reminders?", run once
  // per workspace per reminder pass rather than once per member.
  `CREATE INDEX IF NOT EXISTS idx_notif_prefs_lookup
   ON notification_prefs(workspace_id, category, user_id)`,

  // member_reminder_prefs - one member's check-in / check-out reminder times in
  // one workspace. This is the MEMBER half of the notification split: the
  // organisation broadcasts categories, the member sets schedules.
  //
  // Both times are 'HH:MM' wall-clock in the WORKSPACE's display_timezone. NULL
  // means that kind is off; no row at all means both are off. There is
  // deliberately NO `enabled` or `muted` column anywhere in this table - THE
  // TIME IS THE SWITCH. Two representations of "is this on" drift the moment
  // one write path updates one of them, and then no code can say which is true:
  // a row with checkin_at = '09:30' and enabled = 0 is a question, not an
  // answer. One column, one meaning.
  //
  // Scoped per-workspace, and that is not a convenience. Everything the
  // reminder pass gates on is the workspace's: the timezone the time is read
  // in, working_days, the holiday calendar, and whether this member is on
  // approved leave there. A member of two workspaces genuinely wants two
  // schedules - one office starts at 09:00 in Asia/Kolkata, the other at 10:00
  // in Europe/London - and collapsing them to one account-level time would make
  // the second one wrong every single day. (Contrast member_presence_prefs
  // below, which is account-scoped for the exactly opposite structural reason.)
  //
  // checkin_at / checkout_at are NULL-able on purpose and workspaces.checkin_
  // reminder_at / checkout_reminder_at are deliberately NOT backfilled into
  // this table. Reminders are opt-in now, so silence until a member asks for
  // them is the intended default, not a gap - backfilling would start pushing
  // to every member of every workspace that ever set an admin-side time, which
  // is the nag that makes people revoke push permission and lose their approval
  // notifications with it. The old workspace value survives only as a
  // pre-filled SUGGESTION on the settings screen, never as a delivery fallback.
  `CREATE TABLE IF NOT EXISTS member_reminder_prefs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  checkin_at   TEXT,
  checkout_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  // ONE plain UNIQUE index here, where notification_prefs above needs two
  // PARTIAL ones - and the difference is entirely that workspace_id is NOT NULL
  // in this table. SQLite treats NULLs as DISTINCT in a unique index, so a
  // nullable column in the key constrains nothing: the rows you most need to
  // deduplicate are the ones it silently lets through. Forbidding the NULL is
  // what makes the simple spelling correct; it is not that this table is
  // simpler, it is that it removed the trap rather than working around it.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_member_reminder_prefs_one
   ON member_reminder_prefs(user_id, workspace_id)`,
  // The reminder pass iterates WORKSPACES, not members: once per tick it asks
  // "who in this workspace has a time set for now?". Without this index that is
  // a full scan of every member's schedule in the product, every 30 minutes.
  `CREATE INDEX IF NOT EXISTS idx_member_reminder_prefs_ws
   ON member_reminder_prefs(workspace_id)`,

  // member_presence_prefs - the member-configured session ladder: how long an
  // open check-in runs before it nudges, and when it is closed for them.
  //
  // ACCOUNT-scoped, keyed on user_id alone, and the reason is structural rather
  // than a preference. presence_events carries no workspace_id and deliberately
  // never will, so a member of two workspaces has ONE check-in session, not
  // two. There is no workspace to key this on: asking "which workspace's ladder
  // applies to this open session" has no answer, and inventing one would mean
  // two ladders racing to push about the same session.
  //
  // user_id is the PRIMARY KEY rather than a surrogate id plus a unique index,
  // because there is exactly one row per member BY DEFINITION - the id would be
  // a second key to the same fact and a second thing to get wrong.
  //
  // The three rung columns are nullable: NULL means that rung is off, and no
  // row at all means no ladder pushes whatsoever. That absence IS the opt-in
  // default, the same argument as member_reminder_prefs above.
  //
  // auto_checkout_after_h is NOT NULL DEFAULT 12 while every rung beside it is
  // nullable, and THE ASYMMETRY IS THE POINT. The three rungs are NUDGES; a
  // member may switch all of them off and lose nothing but a buzz. Auto-
  // checkout is a MECHANIC: a session that never closes leaves an open
  // presence_events row that corrupts that day's attendance - no checkout
  // signals, no hours, and invariant 4 means the row can never be repaired by
  // editing it. So it has no off value, and the column refuses to express one.
  // 12 is exactly what src/app/api/checkin/route.ts hardcoded before this
  // table existed, so the default reinterprets nobody's existing session.
  //
  // REAL, not INTEGER, throughout: a 4.5h rung has to be expressible, and an
  // integer column would round it to a different nudge without saying so.
  //
  // repeat_every_h repeats AFTER full_day_after_h and is meaningless without
  // it - there is no anchor to repeat from. The API route refuses that
  // combination, and the route is the ONLY guard: the constraint is conditional
  // on another nullable column, and SQLite cannot attach a CHECK to a column
  // added by ALTER TABLE in any case. Exactly like case_type in
  // maternity_cases, every write path must run its input through the check in
  // code, because the database will not.
  `CREATE TABLE IF NOT EXISTS member_presence_prefs (
  user_id               TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  half_day_after_h      REAL,
  full_day_after_h      REAL,
  repeat_every_h        REAL,
  auto_checkout_after_h REAL NOT NULL DEFAULT 12,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // approvals_inbox + approvals_outcome were merged into one `approvals`
  // category. Two data migrations, and the first one is load-bearing.
  //
  // parseCategoriesOff() filters the stored array through the catalogue, so a
  // key it no longer recognises is silently DROPPED - which for this column
  // means "not disabled", i.e. switched back ON. Without this rewrite, every
  // workspace that had deliberately switched approval notifications off would
  // start sending them again at deploy, with nothing to show it happened.
  //
  // REPLACE rather than JSON surgery because the outcome is the same and this
  // is legible: a workspace that had BOTH keys off ends up with the array
  // ["approvals","approvals"], which is harmless - parseCategoriesOff returns a
  // Set, and serialiseCategoriesOff rewrites the column clean on the next save.
  // Idempotent: a second run finds no old keys and changes nothing.
  `UPDATE workspaces SET notification_categories_off =
     REPLACE(REPLACE(notification_categories_off, 'approvals_inbox', 'approvals'),
             'approvals_outcome', 'approvals')
   WHERE notification_categories_off LIKE '%approvals_inbox%'
      OR notification_categories_off LIKE '%approvals_outcome%'`,

  // The merged category is not member-mutable, and invariant 25 says a
  // preference row may not exist for one that is not. getMutedCategories()
  // already filters unknown keys so these rows are inert either way - but a row
  // whose category no longer exists is dead weight that contradicts the
  // invariant on its face, and the mute it once expressed has no meaning now
  // that the category cannot be muted at all.
  `DELETE FROM notification_prefs WHERE category IN ('approvals_inbox', 'approvals_outcome')`,

  // Same reasoning, one category split further on. `reminders` and `presence`
  // left the catalogue entirely when notification control was split by WHO the
  // message is for: the organisation broadcasts categories, the member sets
  // SCHEDULES, and those two now live in member_reminder_prefs and
  // member_presence_prefs above. getMutedCategories() filters every row through
  // isNotificationCategory, so these rows are already inert - but a preference
  // row naming a category that no longer exists contradicts invariant 25 on its
  // face, and the mute it once expressed has no meaning now that HAVING A
  // SCHEDULE is the switch: there is nothing left to mute, only a time to clear.
  // Idempotent: a second run finds nothing.
  `DELETE FROM notification_prefs WHERE category IN ('reminders', 'presence')`,

  // workspace_logos - a workspace's own mark, shown in both app shells.
  //
  // Bytes and metadata share ONE table here, unlike employee documents where
  // they are deliberately split. The split exists there because every folder
  // view lists metadata and would otherwise drag megabytes through the query.
  // A workspace has exactly one logo, nothing ever lists logos, and the only
  // read is "give me this workspace's bytes" - so a second table would buy a
  // join and nothing else.
  //
  // PRIMARY KEY on workspace_id is what makes replacing a logo an upsert rather
  // than a delete-then-insert with a window where the workspace has none.
  `CREATE TABLE IF NOT EXISTS workspace_logos (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  data_base64  TEXT NOT NULL,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // Backfill: give every orphaned employee record a membership row.
  //
  // The directory reads `FROM workspace_members` and the person page is keyed on
  // `workspace_members.id`, so an employee record with no membership is both
  // invisible and unreachable. `POST /api/ws/[slug]/employees` now writes the
  // membership alongside the record so none can be created again; this closes
  // the ones that already exist (two in the live data at the time of writing).
  //
  // `status = 'no_access'` - they have a record, they were never invited, they
  // cannot sign in. NOT `pending_consent`, which would claim an invitation was
  // sent while the consent token columns sat null.
  //
  // Idempotent by construction: the NOT EXISTS is false on every later run. The
  // email clause is what actually matches, because `wm.user_id = e.user_id` is
  // NULL rather than true when both sides are null - the same NULL = NULL trap
  // that detached invited people's HR records from their memberships.
  `INSERT INTO workspace_members (id, workspace_id, user_id, email, role, status)
   SELECT lower(hex(randomblob(16))), e.workspace_id, e.user_id, lower(e.work_email), 'member', 'no_access'
   FROM employees e
   WHERE e.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM workspace_members wm
       WHERE wm.workspace_id = e.workspace_id
         AND (wm.user_id = e.user_id OR lower(wm.email) = lower(e.work_email))
     )`,

  // employee_sensitive - the name the bank account is held in.
  //
  // Plaintext, like bank_ifsc and bank_name beside it and unlike
  // bank_account_encrypted. It is a name, and the employees row already stores
  // first_name / last_name in the clear, so encrypting this one would cost a
  // decrypt on every read of the record to protect nothing new. It is likewise
  // not masked on read-only screens - masking a name that is legible two fields
  // above it is theatre.
  `ALTER TABLE employee_sensitive ADD COLUMN bank_account_holder_name TEXT`,

  // maternity_cases - the table now carries paternity too.
  //
  // Two statutory entitlements, one lifecycle: requested → approved → onleave →
  // returned is the same walk whichever parent takes it, and splitting them into
  // two tables would duplicate the stage machine, the reminder gate that reads
  // start_date/end_date, and every query that joins the employee. A discriminator
  // column is the smaller thing.
  //
  // NOT NULL DEFAULT 'maternity' so every existing row keeps its meaning with no
  // backfill statement. SQLite cannot attach a CHECK to a column added by ALTER
  // TABLE, so the allowed values are enforced in the query layer instead -
  // isParentalCaseType() in src/lib/db/queries/maternity.ts. Keep the two in step.
  `ALTER TABLE maternity_cases ADD COLUMN case_type TEXT NOT NULL DEFAULT 'maternity'`,

  // The "one open case per employee" index has to become "one open case per
  // employee PER TYPE", or someone who has ever taken maternity leave can never
  // open a paternity case.
  //
  // THE RENAME IS LOAD-BEARING. Re-issuing
  // `CREATE UNIQUE INDEX IF NOT EXISTS idx_maternity_cases_one_open` with a third
  // column would be swallowed: the runner below tolerates "already exists", so
  // the statement is counted as skipped and the OLD two-column index survives -
  // silently, with no error and no failed run to notice. A DROP followed by a
  // CREATE under a NEW name is the only spelling where the outcome is observable.
  // The old name must never be reused for a different definition.
  //
  // Ordering matters: the original CREATE for idx_maternity_cases_one_open is
  // still above (migration history is append-only), so on a fresh database the
  // old index is created and then dropped here. Do not move these two entries
  // earlier in the array.
  `DROP INDEX IF EXISTS idx_maternity_cases_one_open`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_parental_cases_one_open
   ON maternity_cases(workspace_id, employee_id, case_type)
   WHERE deleted_at IS NULL AND status IN ('requested','approved','onleave')`,

  // announcement_attachments - a file hung off a workspace announcement.
  //
  // Metadata only, mirroring employee_documents: the bytes live in
  // announcement_attachment_blobs so listing an announcement feed never drags
  // base64 through the query. Soft-deleted, because retracting an announcement
  // must leave the record of what was posted.
  //
  // file_name / mime_type / size_bytes are NULLABLE ON PURPOSE. The row is
  // created empty, the bytes are written second, and only then does the row
  // claim the file - the same write order employee documents use, so a crash
  // between the two leaves an honest empty slot rather than a metadata row
  // naming bytes that were never stored.
  `CREATE TABLE IF NOT EXISTS announcement_attachments (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  announcement_id TEXT NOT NULL REFERENCES workspace_announcements(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  file_name       TEXT,
  mime_type       TEXT,
  size_bytes      INTEGER,
  uploaded_by     TEXT,
  deleted_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement
   ON announcement_attachments(announcement_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_attachments_ws
   ON announcement_attachments(workspace_id, deleted_at)`,

  // announcement_attachment_blobs - the bytes, base64-encoded, one row per
  // attachment. Exactly the shape of employee_document_blobs and for the same
  // reason: every list read touches the metadata table and never this one.
  // UNIQUE on attachment_id is what makes replacing a file an upsert rather than
  // an accumulation of orphaned bytes.
  `CREATE TABLE IF NOT EXISTS announcement_attachment_blobs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  attachment_id TEXT NOT NULL UNIQUE REFERENCES announcement_attachments(id) ON DELETE CASCADE,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_base64   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_announcement_attachment_blobs_ws
   ON announcement_attachment_blobs(workspace_id)`,

  // parental_leave_extensions - an employee asking to stay away longer than the
  // statutory entitlement, as UNPAID days.
  //
  // A separate table rather than an editable end_date on the case, because the
  // request and the case are different things: the case's dates are what the
  // reminder gate reads, and an admin moving them is an administrative act,
  // while this is a member-filed request that can be refused. Append-only in the
  // same sense as leave_requests - the dates, the day count and the case are
  // fixed at insert, and the ONLY mutation is the approve/reject transition out
  // of 'pending' (status, rejection_reason, actioned_by_user_id). A correction is
  // a reject plus a new request, never an edit.
  //
  // previous_end_date is stored rather than derived so the request still records
  // what it was extending from after the case's end_date has moved on.
  `CREATE TABLE IF NOT EXISTS parental_leave_extensions (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  case_id              TEXT NOT NULL REFERENCES maternity_cases(id) ON DELETE CASCADE,
  user_id              TEXT NOT NULL REFERENCES users(id),
  previous_end_date    TEXT NOT NULL,
  requested_end_date   TEXT NOT NULL,
  unpaid_days          INTEGER NOT NULL,
  reason               TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  rejection_reason     TEXT,
  actioned_by_user_id  TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  // The approvals queue reads "every pending extension in this workspace"; the
  // case screen reads "every extension on this case".
  `CREATE INDEX IF NOT EXISTS idx_parental_extensions_ws_status
   ON parental_leave_extensions(workspace_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_parental_extensions_case
   ON parental_leave_extensions(case_id)`,
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
