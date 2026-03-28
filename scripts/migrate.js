#!/usr/bin/env node
// Consolidated database migration — single script, fully idempotent.
// Usage: node scripts/migrate.js
//
// Fresh install: creates every table with all columns, then ALTER TABLE
//   statements are silently skipped (duplicate column).
// Existing DB:   CREATE TABLE IF NOT EXISTS is skipped, ALTER TABLE adds
//   any columns that didn't exist yet.
// DB rename:     if checkmark.db is absent but checkmark.db is present,
//   the old file is copied automatically before migrating.

const path = require('path')
const fs   = require('fs')

// Load env from .env.local (needed only for Postgres; SQLite path is local)
try {
  fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
    })
} catch { /* .env.local absent — fine for local SQLite */ }

const Database = require('better-sqlite3')
const dbPath   = path.join(__dirname, '../checkmark.db')
const oldPath  = path.join(__dirname, '../checkmark.db')

// One-time rename: copy existing data to new filename
if (!fs.existsSync(dbPath) && fs.existsSync(oldPath)) {
  fs.copyFileSync(oldPath, dbPath)
  console.log('✓ Copied checkmark.db → checkmark.db')
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Base schema — CREATE TABLE IF NOT EXISTS ─────────────────────────────────
// Includes all columns that existed at initial creation.
// Columns added after the fact are listed in ADDITIVE_MIGRATIONS below.
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
`

// ─── Additive column migrations — idempotent ─────────────────────────────────
// On a fresh DB these are skipped (columns already present from CREATE TABLE).
// On an existing DB they add columns that were missing.
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
]

// ─── Run base schema ──────────────────────────────────────────────────────────
const baseStatements = BASE_SCHEMA
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)

let ran = 0
for (const stmt of baseStatements) {
  try {
    db.prepare(stmt).run()
    ran++
  } catch (err) {
    console.error(`Failed on:\n${stmt}\n`)
    console.error(err)
    process.exit(1)
  }
}

// ─── Run additive migrations ──────────────────────────────────────────────────
let skipped = 0
for (const stmt of ADDITIVE_MIGRATIONS) {
  try {
    db.prepare(stmt).run()
    ran++
  } catch (err) {
    const msg = err.message ?? ''
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      skipped++
    } else {
      console.error(`Failed on:\n${stmt}\n`)
      console.error(err)
      process.exit(1)
    }
  }
}

db.close()
console.log(`✓ Migration complete — ${ran} executed, ${skipped} skipped — ${dbPath}`)
