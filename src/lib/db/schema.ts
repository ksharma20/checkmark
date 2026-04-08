// Authoritative schema — every table and every column.
// scripts/migrate.js reads this implicitly (inlines compatible SQL) and runs
// additive ALTER TABLE statements for columns added after initial table creation.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email                  TEXT NOT NULL UNIQUE,
  email_verified         INTEGER NOT NULL DEFAULT 0,
  password_hash          TEXT NOT NULL,
  full_name              TEXT,
  avatar_url             TEXT,
  timezone               TEXT NOT NULL DEFAULT 'UTC',
  timezone_updated_at    TEXT,
  timezone_confirmed     INTEGER NOT NULL DEFAULT 0,
  deactivated_at         TEXT,
  deactivation_reason    TEXT,
  deleted_at             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted  ON users(deleted_at);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS user_api_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL,
  scopes      TEXT NOT NULL DEFAULT 'checkin:write',
  last_used_at TEXT,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presence_events (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type            TEXT NOT NULL DEFAULT 'office_checkin',
  checkin_at            TEXT NOT NULL DEFAULT (datetime('now')),
  checkout_at           TEXT,
  checkout_reason       TEXT,
  note                  TEXT,
  location_label        TEXT,
  wifi_ssid             TEXT,
  ip_address            TEXT NOT NULL,
  ip_geo_lat            REAL,
  ip_geo_lng            REAL,
  gps_lat               REAL,
  gps_lng               REAL,
  gps_accuracy_m        INTEGER,
  checkout_gps_lat      REAL,
  checkout_gps_lng      REAL,
  checkout_gps_accuracy_m INTEGER,
  checkout_wifi_ssid    TEXT,
  checkout_ip_address   TEXT,
  checkout_ip_geo_lat   REAL,
  checkout_ip_geo_lng   REAL,
  source                TEXT NOT NULL DEFAULT 'user_app',
  api_token_id          TEXT REFERENCES user_api_tokens(id),
  deleted_at            TEXT,
  checkout_location_mismatch INTEGER,
  device_info           TEXT,
  trust_flags           TEXT,
  device_timezone       TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_presence_user_time      ON presence_events(user_id, checkin_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_checkin_at     ON presence_events(checkin_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_source         ON presence_events(source);
CREATE INDEX IF NOT EXISTS idx_presence_events_deleted ON presence_events(deleted_at);

CREATE TABLE IF NOT EXISTS workspaces (
  id                         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug                       TEXT NOT NULL UNIQUE,
  name                       TEXT NOT NULL,
  plan                       TEXT NOT NULL DEFAULT 'free',
  org_type                   TEXT,
  display_timezone           TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  domain_verified            INTEGER NOT NULL DEFAULT 0,
  verification_token         TEXT,
  verification_token_expires_at TEXT,
  archived_at                TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
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
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id            TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                 TEXT REFERENCES users(id) ON DELETE CASCADE,
  email                   TEXT NOT NULL,
  role                    TEXT NOT NULL DEFAULT 'member',
  status                  TEXT NOT NULL DEFAULT 'active',
  consent_token           TEXT,
  consent_token_expires_at TEXT,
  added_at                TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, email)
);

CREATE TABLE IF NOT EXISTS workspace_signal_config (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_type     TEXT NOT NULL,
  location_name   TEXT,
  wifi_ssid_hash  TEXT,
  wifi_ssid_display TEXT,
  gps_lat         REAL,
  gps_lng         REAL,
  gps_radius_m    INTEGER DEFAULT 300,
  ip_geo_lat      REAL,
  ip_geo_lng      REAL,
  ip_proximity_m  INTEGER DEFAULT 500,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_overrides (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  presence_event_id TEXT NOT NULL REFERENCES presence_events(id),
  admin_user_id    TEXT NOT NULL REFERENCES users(id),
  note             TEXT,
  effective_checkout_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id                    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak             INTEGER NOT NULL DEFAULT 0,
  longest_streak             INTEGER NOT NULL DEFAULT 0,
  total_checkins             INTEGER NOT NULL DEFAULT 0,
  total_hours_logged         REAL NOT NULL DEFAULT 0,
  checkins_this_month        INTEGER NOT NULL DEFAULT 0,
  distinct_locations_this_month INTEGER NOT NULL DEFAULT 0,
  last_checkin_date          TEXT,
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens(expires_at);
`;
