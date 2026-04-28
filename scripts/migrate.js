#!/usr/bin/env node
// Consolidated database migration - single script, fully idempotent.
//
// Local SQLite:  node scripts/migrate.js
// Turso (prod):  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate.js
//
// Behaviour:
//   Fresh DB  - creates every table + all columns; ALTER TABLE statements silently skip.
//   Existing  - CREATE TABLE IF NOT EXISTS skips; ALTER TABLE adds missing columns.
//   DB rename - if checkmark.db absent but checkmark.db present, copies it automatically.

const path = require('path')
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
]

// ─── SQLite runner (local dev) ────────────────────────────────────────────────

function runSQLite() {
  const Database = require('better-sqlite3')
  const dbPath   = path.join(__dirname, '../checkmark.db')
  const oldPath = path.join(__dirname, "../checkmark.db");

  if (!fs.existsSync(dbPath) && fs.existsSync(oldPath)) {
    fs.copyFileSync(oldPath, dbPath)
    console.log("✓ Copied checkmark.db → checkmark.db");
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const baseStatements = BASE_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)

  let ran = 0, skipped = 0
  for (const stmt of baseStatements) {
    try { db.prepare(stmt).run(); ran++ }
    catch (err) { console.error(`Failed:\n${stmt}\n`, err); process.exit(1) }
  }
  for (const stmt of ADDITIVE_MIGRATIONS) {
    try { db.prepare(stmt).run(); ran++ }
    catch (err) {
      const msg = err.message ?? ''
      if (msg.includes('duplicate column') || msg.includes('already exists')) { skipped++ }
      else { console.error(`Failed:\n${stmt}\n`, err); process.exit(1) }
    }
  }

  db.close()
  console.log(`✓ SQLite migration complete - ${ran} executed, ${skipped} skipped - ${dbPath}`)
}

// ─── Turso runner (production) ────────────────────────────────────────────────

async function runTurso() {
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
      if (msg.includes('duplicate column') || msg.includes('already exists')) { skipped++ }
      else { console.error(`Failed:\n${stmt}\n`, err); process.exit(1) }
    }
  }

  await client.close()
  console.log(`✓ Turso migration complete - ${ran} executed, ${skipped} skipped - ${process.env.TURSO_DATABASE_URL}`)
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (process.env.TURSO_DATABASE_URL) {
  runTurso().catch(err => { console.error(err); process.exit(1) })
} else {
  runSQLite()
}
