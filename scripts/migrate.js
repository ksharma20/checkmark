#!/usr/bin/env node
// Run database migrations
// Usage: node scripts/migrate.js

const path = require('path')

// Load env from .env.local
try {
  require('fs').readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=')
      if (key && rest.length) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    })
} catch {
  // .env.local doesn't exist yet — that's fine for SQLite
}

const Database = require('better-sqlite3')
const dbPath = path.join(__dirname, '../checkmark.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Read schema from compiled or source
// We inline the SQL here to avoid needing ts-node for migrations
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'checkin:write',
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presence_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'office_checkin',
  checkin_at TEXT NOT NULL DEFAULT (datetime('now')),
  checkout_at TEXT,
  note TEXT,
  wifi_ssid TEXT,
  ip_address TEXT NOT NULL,
  ip_geo_lat REAL,
  ip_geo_lng REAL,
  gps_lat REAL,
  gps_lng REAL,
  gps_accuracy_m INTEGER,
  source TEXT NOT NULL DEFAULT 'user_app',
  api_token_id TEXT REFERENCES user_api_tokens(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presence_user_time
  ON presence_events(user_id, checkin_at DESC);

CREATE INDEX IF NOT EXISTS idx_presence_checkin_at
  ON presence_events(checkin_at DESC);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  org_type TEXT,
  display_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  domain_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  verification_token_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_domains (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, domain)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  consent_token TEXT,
  consent_token_expires_at TEXT,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS workspace_signal_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  location_name TEXT,
  wifi_ssid_hash TEXT,
  wifi_ssid_display TEXT,
  gps_lat REAL,
  gps_lng REAL,
  gps_radius_m INTEGER DEFAULT 300,
  ip_geo_lat REAL,
  ip_geo_lng REAL,
  ip_proximity_m INTEGER DEFAULT 500,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_overrides (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  presence_event_id TEXT NOT NULL REFERENCES presence_events(id),
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  total_hours_logged REAL NOT NULL DEFAULT 0,
  checkins_this_month INTEGER NOT NULL DEFAULT 0,
  distinct_locations_this_month INTEGER NOT NULL DEFAULT 0,
  last_checkin_date TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

const statements = SCHEMA_SQL
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

let ran = 0
for (const statement of statements) {
  try {
    db.prepare(statement).run()
    ran++
  } catch (err) {
    console.error(`Failed on statement:\n${statement}\n`)
    console.error(err)
    process.exit(1)
  }
}

// Additive column migrations (idempotent — ignore "duplicate column" errors)
const COLUMN_MIGRATIONS = [
  `ALTER TABLE workspaces ADD COLUMN org_type TEXT`,
]
for (const stmt of COLUMN_MIGRATIONS) {
  try {
    db.prepare(stmt).run()
    ran++
  } catch {
    // Column already exists — safe to ignore
  }
}

db.close()
console.log(`✓ Migration complete — ran ${ran} statement(s) against ${dbPath}`)
