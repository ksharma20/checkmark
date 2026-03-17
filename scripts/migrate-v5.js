#!/usr/bin/env node
/**
 * migrate-v5.js
 *  - presence_events.location_label TEXT  — human-readable location stored at check-in
 *  - otp_codes.attempts INTEGER            — brute-force protection
 * Idempotent: skips "duplicate column" / "already exists" errors.
 */
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.resolve(__dirname, '../checkmark.db')
const db = new Database(DB_PATH)

const statements = [
  `ALTER TABLE presence_events ADD COLUMN location_label TEXT`,
  `ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose, created_at DESC)`,
]

let executed = 0, skipped = 0, errors = 0

for (const sql of statements) {
  try {
    db.prepare(sql).run()
    console.log(`✓  ${sql.slice(0, 72).replace(/\n/g, ' ')}`)
    executed++
  } catch (err) {
    const msg = err.message ?? ''
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log(`—  (skip) ${sql.slice(0, 60).replace(/\n/g, ' ')}`)
      skipped++
    } else {
      console.error(`✗  ${sql.slice(0, 72)}\n   ${msg}`)
      errors++
    }
  }
}

db.close()
console.log(`\nMigrate-v5: ${executed} executed, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)
