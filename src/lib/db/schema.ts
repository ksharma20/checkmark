// Authoritative schema - every table and every column.
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
  token_prefix TEXT, -- first 8 chars of raw token for fast lookup
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
  scheduled_checkout_at TEXT,
  checkout_reason       TEXT,
  note                  TEXT,
  location_label        TEXT,
  ip_address            TEXT NOT NULL,
  ip_geo_lat            REAL,
  ip_geo_lng            REAL,
  gps_lat               REAL,
  gps_lng               REAL,
  gps_accuracy_m        INTEGER,
  checkout_gps_lat      REAL,
  checkout_gps_lng      REAL,
  checkout_gps_accuracy_m INTEGER,
  checkout_ip_address   TEXT,
  checkout_ip_geo_lat   REAL,
  checkout_ip_geo_lng   REAL,
  checkout_location_label TEXT,
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

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key        TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_action ON rate_limit_log(key, action, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS workspace_holidays (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  date         TEXT NOT NULL,
  description  TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_holidays_ws_date ON workspace_holidays(workspace_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_holidays_ws_name_date_active ON workspace_holidays(workspace_id, name, date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  ref_id       TEXT,
  ref_type     TEXT,
  read_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_list ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employees (
  id                             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  workspace_id                   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id                        TEXT REFERENCES users(id),

  first_name                     TEXT NOT NULL,
  last_name                      TEXT NOT NULL,
  gender                         TEXT CHECK(gender IN ('male','female','non_binary','prefer_not_to_say')),
  date_of_birth                  TEXT,
  marital_status                 TEXT CHECK(marital_status IN ('single','married','divorced','widowed','separated')),
  number_of_children             INTEGER,
  photo_url                      TEXT,
  blood_group                    TEXT CHECK(blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),

  personal_email                 TEXT,
  work_email                     TEXT NOT NULL,
  phone                          TEXT,
  alternate_phone                TEXT,
  current_address                TEXT,
  permanent_address              TEXT,

  employee_id                    TEXT,
  designation                    TEXT,
  department                     TEXT,
  work_location                  TEXT,
  work_mode                      TEXT CHECK(work_mode IN ('office','remote','hybrid')),
  reporting_manager_id           TEXT REFERENCES employees(id),
  total_work_experience          REAL,
  employment_type                TEXT NOT NULL CHECK(employment_type IN ('full_time','part_time','contract','intern','consultant')),
  employee_status                TEXT NOT NULL DEFAULT 'active' CHECK(employee_status IN ('active','terminated','suspended','on_leave','notice_period')),
  source_of_hire                 TEXT CHECK(source_of_hire IN ('direct','referral','job_portal','consultancy','campus')),

  date_of_joining                TEXT,
  confirmation_date              TEXT,
  probation_end_date             TEXT,
  exit_date                      TEXT,
  exit_reason                    TEXT,

  pan_encrypted                  TEXT,
  aadhaar_encrypted              TEXT,
  uan                            TEXT,
  passport_number                TEXT,

  bank_account_encrypted         TEXT,
  bank_ifsc                      TEXT,
  bank_name                      TEXT,

  emergency_contact_name         TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone        TEXT,

  deleted_at                     TEXT,
  created_at                     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_ws_emp_id
  ON employees(workspace_id, employee_id)
  WHERE employee_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_ws_work_email
  ON employees(workspace_id, work_email)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_workspace        ON employees(workspace_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_employees_department       ON employees(workspace_id, department);
CREATE INDEX IF NOT EXISTS idx_employees_work_location    ON employees(workspace_id, work_location);
CREATE INDEX IF NOT EXISTS idx_employees_doj              ON employees(workspace_id, date_of_joining);
CREATE INDEX IF NOT EXISTS idx_employees_exit_date        ON employees(workspace_id, exit_date);
CREATE INDEX IF NOT EXISTS idx_employees_status           ON employees(workspace_id, employee_status);
CREATE INDEX IF NOT EXISTS idx_employees_employment_type  ON employees(workspace_id, employment_type);
CREATE INDEX IF NOT EXISTS idx_employees_manager          ON employees(workspace_id, reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_user             ON employees(user_id);
`;
