#!/usr/bin/env node
/**
 * migrate-v4.js — soft delete for users + presence_events
 * Idempotent: skips "duplicate column" / "already exists" errors.
 */
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.resolve(__dirname, '../checkmark.db')
const db = new Database(DB_PATH)

const statements = [
  // Users: soft delete column
  `ALTER TABLE users ADD COLUMN deleted_at TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at)`,

  // Presence events: soft delete column (may already exist from v3 if not reverted)
  `ALTER TABLE presence_events ADD COLUMN deleted_at TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_presence_events_deleted ON presence_events(deleted_at)`,
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
console.log(`\nMigrate-v4: ${executed} executed, ${skipped} skipped, ${errors} errors`)
if (errors > 0) process.exit(1)
