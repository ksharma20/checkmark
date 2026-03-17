-- CheckMark QA/Fix migrations
-- Safe to run on existing DB: all ALTER TABLE statements are idempotent when wrapped in try/catch
-- Run via: node scripts/run-migrate-updates.js

-- 1. Users table additions
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN timezone_updated_at TEXT;
ALTER TABLE users ADD COLUMN timezone_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deactivated_at TEXT;
ALTER TABLE users ADD COLUMN deactivation_reason TEXT;

-- 2. Workspace table additions (org_type already present from previous migration)
-- ALTER TABLE workspaces ADD COLUMN org_type TEXT; -- already added

-- 3. Presence events: checkout signals
ALTER TABLE presence_events ADD COLUMN checkout_gps_lat REAL;
ALTER TABLE presence_events ADD COLUMN checkout_gps_lng REAL;
ALTER TABLE presence_events ADD COLUMN checkout_gps_accuracy_m INTEGER;
ALTER TABLE presence_events ADD COLUMN checkout_wifi_ssid TEXT;
ALTER TABLE presence_events ADD COLUMN checkout_ip_address TEXT;
ALTER TABLE presence_events ADD COLUMN checkout_ip_geo_lat REAL;
ALTER TABLE presence_events ADD COLUMN checkout_ip_geo_lng REAL;

-- 4. OTP codes: attempt tracking
ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

-- 5. New tables
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens ON revoked_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_presence_source ON presence_events(source);
